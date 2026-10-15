/* Reproducible, regular-time score model. Uses strictly earlier calendar dates. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.UclPredictionBaseline = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const VERSION = 'score-poisson-1.0';
  const DEFAULT_PARAMS = Object.freeze({ halfLifeDays: 730, priorGames: 16 });
  const DAY = 86400000;
  const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
  const outcome = (h, a) => h > a ? 'home' : h < a ? 'away' : 'draw';
  const validDate = value => /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value + 'T00:00:00Z'))
    && new Date(value + 'T00:00:00Z').toISOString().slice(0,10) === value;
  const score = value => {
    const match = /^(\d+)\s*[-–]\s*(\d+)$/.exec(String(value ?? ''));
    if (!match) return null;
    const h = Number(match[1]), a = Number(match[2]);
    return h <= 20 && a <= 20 ? [h, a] : null;
  };
  function buildModel(rows, cutoffDate, seed = null, options = {}) {
    if (!validDate(cutoffDate)) throw new Error('Invalid prediction cutoff');
    if (seed && (seed.version !== VERSION || cutoffDate < seed.cutoffDate)) throw new Error('Model snapshot is incompatible with cutoff');
    const params = { ...DEFAULT_PARAMS, ...(seed?.params || {}), ...options };
    if (!(params.halfLifeDays > 0 && params.priorGames > 0)) throw new Error('Invalid model parameters');
    const decay = date => Math.pow(0.5, (Date.parse(cutoffDate) - Date.parse(date)) / DAY / params.halfLifeDays);
    const teams = new Map(), seen = new Set();
    let count = seed?.count || 0, weightedGames = 0, homeGoals = 0, awayGoals = 0;
    let firstDate = seed?.firstDate || null, lastDate = seed?.lastDate || null;
    if (seed) {
      const factor = decay(seed.cutoffDate);
      weightedGames = seed.weightedGames * factor; homeGoals = seed.homeGoals * factor; awayGoals = seed.awayGoals * factor;
      for (const [name, entry] of seed.teams) teams.set(name, {
        games: entry.games, effectiveGames: entry.effectiveGames * factor,
        scored: entry.scored * factor, conceded: entry.conceded * factor
      });
    }
    for (const row of rows) {
      if (!['league','group'].includes(row.stage) || !row.home || !row.away || row.home === row.away
        || !validDate(row.date) || row.date >= cutoffDate || (seed && row.date < seed.cutoffDate)) continue;
      const goals = score(row.score);
      const key = [row.season, row.date, row.home, row.away].join('|');
      if (!goals || seen.has(key)) continue;
      seen.add(key);
      const weight = decay(row.date), [h, a] = goals;
      weightedGames += weight; homeGoals += h * weight; awayGoals += a * weight; count++;
      firstDate = !firstDate || row.date < firstDate ? row.date : firstDate;
      lastDate = !lastDate || row.date > lastDate ? row.date : lastDate;
      for (const [name, scored, conceded] of [[row.home,h,a],[row.away,a,h]]) {
        const entry = teams.get(name) || { games: 0, effectiveGames: 0, scored: 0, conceded: 0 };
        entry.games++; entry.effectiveGames += weight; entry.scored += scored * weight; entry.conceded += conceded * weight;
        teams.set(name, entry);
      }
    }
    return { version: VERSION, params, cutoffDate, firstDate, lastDate, count, weightedGames, homeGoals, awayGoals, teams,
      homeAverage: weightedGames ? Math.max(0.05, homeGoals / weightedGames) : 1.48,
      awayAverage: weightedGames ? Math.max(0.05, awayGoals / weightedGames) : 1.20,
      pooledAverage: weightedGames ? Math.max(0.05, (homeGoals + awayGoals) / (2 * weightedGames)) : 1.34 };
  }
  function serializeModel(model) {
    return { ...model, teams: [...model.teams].sort(([a],[b]) => a.localeCompare(b)) };
  }
  function expectedGoals(model, homeName, awayName, mode = 'teams') {
    const pooled = model.pooledAverage, prior = model.params.priorGames;
    const strength = name => {
      const entry = model.teams.get(name);
      if (!entry || mode === 'pooled') return { attack: 1, defense: 1, games: entry?.games || 0, effectiveGames: entry?.effectiveGames || 0 };
      const denominator = entry.effectiveGames + prior;
      return { attack: (entry.scored + prior * pooled) / denominator / pooled,
        defense: (entry.conceded + prior * pooled) / denominator / pooled, games: entry.games, effectiveGames: entry.effectiveGames };
    };
    const home = strength(homeName), away = strength(awayName);
    return { home: clamp(model.homeAverage * home.attack * away.defense, 0.15, 5),
      away: clamp(model.awayAverage * away.attack * home.defense, 0.15, 5),
      samples: { home: home.games, away: away.games }, effectiveSamples: { home: home.effectiveGames, away: away.effectiveGames },
      factors: { home, away, homeAverage: model.homeAverage, awayAverage: model.awayAverage } };
  }
  function poisson(lambda, max) {
    if (!(Number.isFinite(lambda) && lambda >= 0)) throw new Error('Invalid goal rate');
    const distribution = [Math.exp(-lambda)];
    for (let goals = 1; goals <= max; goals++) distribution.push(distribution[goals - 1] * lambda / goals);
    const total = distribution.reduce((sum, probability) => sum + probability, 0);
    return distribution.map(probability => probability / total);
  }
  function forecast(model, homeName, awayName, options = {}) {
    const rates = expectedGoals(model, homeName, awayName, options.mode);
    const homeScores = poisson(rates.home, 20), awayScores = poisson(rates.away, 20);
    const result = { home: 0, draw: 0, away: 0 }, totals = Array(7).fill(0), scores = [];
    for (let h = 0; h < homeScores.length; h++) for (let a = 0; a < awayScores.length; a++) {
      const probability = homeScores[h] * awayScores[a];
      result[outcome(h,a)] += probability; totals[Math.min(h+a,6)] += probability; scores.push({ home:h, away:a, probability });
    }
    scores.sort((a,b) => b.probability - a.probability);
    let halfFull = null;
    if (options.includeHalfFull !== false) {
      const hs = poisson(rates.home / 2, 14), as = poisson(rates.away / 2, 14);
      halfFull = { home: {home:0,draw:0,away:0}, draw: {home:0,draw:0,away:0}, away: {home:0,draw:0,away:0} };
      for (let h=0;h<hs.length;h++) for (let a=0;a<as.length;a++)
        for (let sh=0;sh<hs.length;sh++) for (let sa=0;sa<as.length;sa++)
          halfFull[outcome(h,a)][outcome(h+sh,a+sa)] += hs[h]*as[a]*hs[sh]*as[sa];
    }
    return { version: model.version, rates, result, totals, scores: scores.slice(0,5), halfFull,
      trainingGames: model.count, cutoffDate: model.cutoffDate, lastDate: model.lastDate };
  }
  return { VERSION, DEFAULT_PARAMS, buildModel, serializeModel, expectedGoals, forecast, poisson, outcome };
});
