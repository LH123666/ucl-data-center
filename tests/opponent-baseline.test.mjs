import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import fs from 'node:fs';
const require = createRequire(import.meta.url), api = require('../js/services/opponent-baseline.js');
const rows = [
  { season: '2025-26', date: '2025-10-01', home: 'A', away: 'B', score: '2-0', stage: 'league' },
  { season: '2025-26', date: '2025-10-02', home: 'B', away: 'C', score: '2-1', stage: 'league' },
  { season: '2025-26', date: '2025-10-03', home: 'C', away: 'A', score: '0-2', stage: 'group' },
  { season: '2025-26', date: '2025-10-04', home: 'B', away: 'A', score: '1-3', stage: 'league' }
];
test('opponent fit excludes target day, future, knockout, malformed dates/results and duplicates', () => {
  const model = api.fit([...rows, rows[0], { ...rows[0], date: '2025-02-30' }, { ...rows[0], stage: 'knockout', score: '20-0' },
    { ...rows[0], date: '2025-10-03', score: 'x-y' }, { ...rows[0], date: '2025-10-03', home: 'A', away: 'A' }], '2025-10-04');
  assert.equal(model.count, 3); assert.equal(model.lastDate, '2025-10-03');
  assert.deepEqual(model, api.fit(rows, '2025-10-04'));
  assert.throws(() => api.fit(rows, '2025-02-30'), /cutoff/);
  assert.throws(() => api.fit(rows, '2025-10-05', { ridge: 0 }), /parameters/);
});
test('joint attack and defense estimates have centered identifiable effects and converge', () => {
  const model = api.fit(rows, '2025-10-05');
  for (const effect of ['attack', 'defense']) assert.ok(Math.abs(model.teams.reduce((sum, [, team]) => sum + team[effect], 0)) < 1e-10);
  assert.equal(model.fitDiagnostics.converged, true);
  assert.ok(model.teams.find(([name]) => name === 'A')[1].attack > model.teams.find(([name]) => name === 'C')[1].attack);
});
test('joint effects respond to opponent network rather than only own goals averages', () => {
  const base = [
    { season: 's', date: '2025-01-01', home: 'A', away: 'B', score: '2-0', stage: 'league' },
    { season: 's', date: '2025-01-02', home: 'C', away: 'D', score: '2-0', stage: 'league' },
    { season: 's', date: '2025-01-03', home: 'B', away: 'D', score: '0-0', stage: 'league' }
  ];
  const changed = base.map((r, i) => i === 2 ? { ...r, score: '5-0' } : r);
  const m1 = api.fit(base, '2025-02-01'), m2 = api.fit(changed, '2025-02-01');
  const difference = model => model.teams.find(([name]) => name === 'A')[1].attack - model.teams.find(([name]) => name === 'C')[1].attack;
  assert.ok(Math.abs(difference(m1) - difference(m2)) > 0.005);
});
test('larger ridge shrinks relative team effects and unknown clubs have zero effects', () => {
  const small = api.fit(rows, '2025-10-05', { ridge: 1 }), large = api.fit(rows, '2025-10-05', { ridge: 100 });
  const magnitude = model => model.teams.reduce((s, [, t]) => s + t.attack ** 2 + t.defense ** 2, 0);
  assert.ok(magnitude(large) < magnitude(small));
  const prediction = api.forecast(small, 'Unknown A', 'Unknown B');
  assert.deepEqual(prediction.rates.samples, { home: 0, away: 0 });
  assert.equal(prediction.rates.factors.home.attack, 0); assert.equal(prediction.rates.factors.away.defense, 0);
});
test('JSON roundtrip preserves forecasts and all markets derive consistently from the same distribution', () => {
  const model = api.fit(rows, '2025-10-05'), p = api.forecast(model, 'A', 'B');
  assert.deepEqual(p, api.forecast(JSON.parse(JSON.stringify(model)), 'A', 'B'));
  assert.ok(Math.abs(Object.values(p.result).reduce((s, v) => s + v, 0) - 1) < 1e-10);
  assert.ok(Math.abs(p.totals.reduce((s, v) => s + v, 0) - 1) < 1e-10);
  assert.equal(p.markets.over25, p.totals.slice(3).reduce((s, v) => s + v, 0));
  assert.equal(p.markets.over35, p.totals.slice(4).reduce((s, v) => s + v, 0));
  assert.ok(p.markets.over35 <= p.markets.over25);
  const hp = api.poisson(p.rates.home), ap = api.poisson(p.rates.away);
  assert.ok(Math.abs(p.markets.btts - (1 - hp[0]) * (1 - ap[0])) < 1e-10);
  assert.ok(p.scores.every((score, i) => i === 0 || score.probability <= p.scores[i - 1].probability));
});
test('empty and zero-goal datasets produce finite conservative rates', () => {
  for (const training of [[], rows.map(r => ({ ...r, score: '0-0' }))]) {
    const model = api.fit(training, '2025-10-05');
    const p = api.forecast(model, 'A', 'B');
    assert.ok(Number.isFinite(p.rates.home) && Number.isFinite(p.rates.away));
    assert.ok(p.rates.home >= 0.15 && p.rates.away >= 0.15);
  }
});
test('published experiment contains aggregates only, strict cutoff, source coverage and closed release gate', () => {
  const model = JSON.parse(fs.readFileSync('js/data/prediction/opponent-model.json', 'utf8'));
  const report = JSON.parse(fs.readFileSync('js/data/prediction/opponent-backtest.json', 'utf8'));
  assert.equal(model.version, api.VERSION); assert.equal(model.releaseGate.enabled, false); assert.equal(report.releaseGate.enabled, false);
  assert.equal(model.count, 864); assert.equal(model.trainingCutoff, '2026-10-15'); assert.ok(model.latestObservedDate < model.trainingCutoff);
  assert.equal(model.rows, undefined); assert.equal(model.license, 'CC0-1.0'); assert.equal(model.sourceSet.length, 1);
  assert.equal(report.selection.season, '2023-24'); assert.equal(report.evaluation.designation, 'development-comparison');
  assert.equal(report.evaluation.opponent.matches, 288); assert.equal(report.evaluation.baseline.matches, 288);
  assert.equal(report.bySeason.reduce((s, row) => s + row.opponent.matches, 0), 288);
  assert.deepEqual(report.params, model.params); assert.equal(report.fitAudit.unconverged, 0);
  for (const kind of ['opponent', 'baseline']) {
    const m = report.evaluation[kind];
    assert.equal(m.calibration.reduce((s, b) => s + b.count, 0), 288 * 3);
    assert.ok(Number.isFinite(m.logLoss) && Number.isFinite(m.scoreLogLoss));
    for (const market of ['over25', 'over35', 'btts']) assert.equal(m.markets[market].calibration.reduce((s, b) => s + b.count, 0), 288);
  }
});
