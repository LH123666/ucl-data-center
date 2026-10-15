/* Experimental joint opponent-adjusted Poisson fit. Never replaces the official baseline. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.UclOpponentBaseline = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const VERSION = 'opponent-poisson-0.1';
  const DEFAULT_PARAMS = Object.freeze({ ridge: 6, halfLifeDays: 730, maxIterations: 500, tolerance: 1e-8 });
  const DAY = 86400000;
  const clamp = (v, low, high) => Math.max(low, Math.min(high, v));
  const outcome = (h, a) => h > a ? 'home' : h < a ? 'away' : 'draw';
  const validDate = date => /^\d{4}-\d{2}-\d{2}$/.test(date) && Number.isFinite(Date.parse(date + 'T00:00:00Z'))
    && new Date(date + 'T00:00:00Z').toISOString().slice(0, 10) === date;
  function eligibleRows(rows, cutoffDate) {
    if (!validDate(cutoffDate)) throw new Error('Invalid prediction cutoff');
    const seen = new Set(), selected = [];
    for (const row of rows) {
      if (!['league', 'group'].includes(row.stage) || typeof row.home !== 'string' || typeof row.away !== 'string'
        || !row.home.trim() || !row.away.trim() || row.home === row.away || !validDate(row.date) || row.date >= cutoffDate) continue;
      const match = /^(\d+)\s*[-–]\s*(\d+)$/.exec(String(row.score ?? ''));
      if (!match || +match[1] > 20 || +match[2] > 20) continue;
      const key = [row.season, row.date, row.home, row.away].join('|');
      if (seen.has(key)) continue;
      seen.add(key); selected.push({ ...row, goals: [+match[1], +match[2]] });
    }
    return selected.sort((a, b) => a.date.localeCompare(b.date) || a.home.localeCompare(b.home) || a.away.localeCompare(b.away));
  }
  function fit(rows, cutoffDate, options = {}) {
    const params = { ...DEFAULT_PARAMS, ...options };
    if (!(Number.isFinite(params.ridge) && params.ridge > 0 && Number.isFinite(params.halfLifeDays) && params.halfLifeDays > 0
      && Number.isInteger(params.maxIterations) && params.maxIterations > 0 && Number.isFinite(params.tolerance) && params.tolerance > 0)) throw new Error('Invalid model parameters');
    const selected = eligibleRows(rows, cutoffDate);
    const names = [...new Set(selected.flatMap(r => [r.home, r.away]))].sort();
    const index = new Map(names.map((name, i) => [name, i]));
    const n = names.length, attack = Array(n).fill(0), defense = Array(n).fill(0);
    const appearances = names.map(() => ({ games: 0, effectiveGames: 0 }));
    const observations = [], attackIndices = names.map(() => []), defenseIndices = names.map(() => []), homeIndices = [];
    let weightedGames = 0, homeGoals = 0, awayGoals = 0;
    for (const row of selected) {
      const h = index.get(row.home), a = index.get(row.away);
      const weight = Math.pow(0.5, (Date.parse(cutoffDate) - Date.parse(row.date)) / DAY / params.halfLifeDays);
      weightedGames += weight; homeGoals += weight * row.goals[0]; awayGoals += weight * row.goals[1];
      for (const i of [h, a]) { appearances[i].games++; appearances[i].effectiveGames += weight; }
      for (const [attacker, defender, y, home] of [[h, a, row.goals[0], true], [a, h, row.goals[1], false]]) {
        const id = observations.length;
        observations.push({ y, weight, eta: 0 }); attackIndices[attacker].push(id); defenseIndices[defender].push(id);
        if (home) homeIndices.push(id);
      }
    }
    let intercept = Math.log(weightedGames ? Math.max(0.05, awayGoals / weightedGames) : 1.20);
    let homeAdvantage = Math.log((weightedGames ? Math.max(0.05, homeGoals / weightedGames) : 1.48) / Math.exp(intercept));
    observations.forEach((row, i) => { row.eta = intercept + (i % 2 === 0 ? homeAdvantage : 0); });
    const allIndices = observations.map((_, i) => i);
    const objective = () => observations.reduce((sum, r) => sum + r.weight * (Math.exp(r.eta) - r.y * r.eta), 0)
      + params.ridge / 2 * [...attack, ...defense].reduce((s, v) => s + v * v, 0);
    // Each coordinate has signs of only +1 or -1. Backtracking ensures the penalized objective decreases.
    function coordinate(ids, sign, beta, penalty) {
      let gradient = penalty * beta, hessian = penalty;
      for (const id of ids) { const r = observations[id], mean = Math.exp(r.eta); gradient += sign * r.weight * (mean - r.y); hessian += r.weight * mean; }
      if (!(hessian > 0)) return beta;
      let step = clamp(gradient / hessian, -1, 1), delta = 0;
      for (let attempt = 0; attempt < 30; attempt++, step /= 2) {
        delta = -step;
        let change = penalty / 2 * ((beta + delta) ** 2 - beta ** 2);
        for (const id of ids) { const r = observations[id]; change += r.weight * (Math.exp(r.eta) * Math.expm1(sign * delta) - r.y * sign * delta); }
        if (change <= 1e-12) { for (const id of ids) observations[id].eta += sign * delta; return beta + delta; }
      }
      return beta;
    }
    let iterations = 0, converged = selected.length === 0, previous = objective();
    for (; iterations < params.maxIterations && !converged; iterations++) {
      intercept = coordinate(allIndices, 1, intercept, 0);
      homeAdvantage = coordinate(homeIndices, 1, homeAdvantage, 0);
      for (let i = 0; i < n; i++) attack[i] = coordinate(attackIndices[i], 1, attack[i], params.ridge);
      for (let i = 0; i < n; i++) defense[i] = coordinate(defenseIndices[i], -1, defense[i], params.ridge);
      // Center both effects, preserving every fitted rate; the ridge prior then prefers zero means.
      const meanAttack = n ? attack.reduce((s, v) => s + v, 0) / n : 0;
      const meanDefense = n ? defense.reduce((s, v) => s + v, 0) / n : 0;
      for (let i = 0; i < n; i++) { attack[i] -= meanAttack; defense[i] -= meanDefense; }
      intercept += meanAttack - meanDefense;
      const current = objective();
      converged = Math.abs(previous - current) <= params.tolerance * (1 + Math.abs(previous)); previous = current;
    }
    return { schemaVersion: 1, version: VERSION, params, cutoffDate, firstDate: selected[0]?.date || null,
      lastDate: selected[selected.length - 1]?.date || null, count: selected.length, weightedGames,
      coefficients: { intercept, homeAdvantage },
      teams: names.map((name, i) => [name, { attack: attack[i], defense: defense[i], ...appearances[i] }]),
      fitDiagnostics: { converged, iterations, penalizedObjectiveWithoutConstants: previous, constraints: 'sum attack = sum defense = 0',
        estimation: 'Joint weighted regularized Poisson maximum likelihood; cyclic coordinate Newton with backtracking.' } };
  }
  function poisson(lambda, max = 20) {
    if (!(Number.isFinite(lambda) && lambda >= 0)) throw new Error('Invalid goal rate');
    const p = [Math.exp(-lambda)];
    for (let i = 1; i <= max; i++) p.push(p[i - 1] * lambda / i);
    const mass = p.reduce((s, v) => s + v, 0);
    return p.map(v => v / mass);
  }
  function forecast(model, homeName, awayName) {
    if(typeof homeName!=='string'||typeof awayName!=='string'||!homeName.trim()||!awayName.trim()||homeName===awayName)throw new Error('A forecast requires two different named teams');
    if (model?.version !== VERSION || !validDate(model.cutoffDate) || !Array.isArray(model.teams)
      || !Number.isFinite(model.coefficients?.intercept) || !Number.isFinite(model.coefficients?.homeAdvantage)) throw new Error('Invalid opponent model');
    const entry = name => model.teams.find(([key]) => key === name)?.[1] || { attack: 0, defense: 0, games: 0, effectiveGames: 0 };
    const home = entry(homeName), away = entry(awayName), { intercept, homeAdvantage } = model.coefficients;
    const rates = { home: clamp(Math.exp(intercept + homeAdvantage + home.attack - away.defense), 0.15, 5),
      away: clamp(Math.exp(intercept + away.attack - home.defense), 0.15, 5),
      samples: { home: home.games, away: away.games }, effectiveSamples: { home: home.effectiveGames, away: away.effectiveGames },
      factors: { home, away, intercept, homeAdvantage } };
    const hp = poisson(rates.home), ap = poisson(rates.away), result = { home: 0, draw: 0, away: 0 }, totals = Array(7).fill(0), scores = [];
    let btts = 0;
    for (let h = 0; h < hp.length; h++) for (let a = 0; a < ap.length; a++) {
      const probability = hp[h] * ap[a]; result[outcome(h, a)] += probability; totals[Math.min(h + a, 6)] += probability;
      if (h > 0 && a > 0) btts += probability;
      scores.push({ home: h, away: a, probability });
    }
    scores.sort((a, b) => b.probability - a.probability);
    return { version: VERSION, rates, result, totals, scores: scores.slice(0, 5),
      markets: { over25: totals.slice(3).reduce((s, v) => s + v, 0), over35: totals.slice(4).reduce((s, v) => s + v, 0), btts },
      trainingGames: model.count, cutoffDate: model.cutoffDate, lastDate: model.lastDate, experimental: true };
  }
  return { VERSION, DEFAULT_PARAMS, fit, forecast, eligibleRows, poisson, outcome };
});
