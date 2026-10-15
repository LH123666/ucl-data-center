import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import { parseScore } from '../scripts/collect-openfootball-history.mjs';

const require = createRequire(import.meta.url);
const baseline = require('../js/services/prediction-baseline.js');

const rows = [
  { season: '2024-25', date: '2024-10-01', home: 'Alpha', away: 'Beta', score: '2-1', stage: 'league' },
  { season: '2025-26', date: '2025-10-01', home: 'Beta', away: 'Alpha', score: '1-1', stage: 'league' },
  { season: '2026-27', date: '2026-10-01', home: 'Alpha', away: 'Beta', score: '3-0', stage: 'league' },
  { season: '2026-27', date: '2026-10-14', home: 'Beta', away: 'Alpha', score: '9-9', stage: 'league' },
  { season: '2026-27', date: '2026-10-15', home: 'Alpha', away: 'Beta', score: '20-0', stage: 'league' },
  { season: '2026-27', date: '2026-10-02', home: 'Alpha', away: 'Beta', score: '8-0', stage: 'qualifying' },
  { season: '2026-27', date: '2026-10-03', home: 'Alpha', away: 'Beta', score: 'x-y', stage: 'league' }
];

test('training uses only past league-phase results, not target-day or future results', () => {
  const model = baseline.buildModel(rows, '2026-10-14');
  assert.equal(model.count, 3);
  assert.equal(model.teams.get('Alpha').games, 3);
  assert.equal(model.teams.get('Beta').games, 3);
  assert.ok(model.homeAverage < 3);
});

test('result, total-goals, and half/full probabilities each sum to one', () => {
  const model = baseline.buildModel(rows, '2026-10-14');
  const prediction = baseline.forecast(model, 'Alpha', 'Beta');
  const sum = values => values.reduce((total, value) => total + value, 0);
  assert.ok(Math.abs(sum(Object.values(prediction.result)) - 1) < 1e-10);
  assert.ok(Math.abs(sum(prediction.totals) - 1) < 1e-10);
  assert.ok(Math.abs(sum(Object.values(prediction.halfFull).flatMap(row => Object.values(row))) - 1) < 1e-10);
  assert.ok(prediction.scores.every(item => item.probability > 0 && item.probability < 1));
});

test('new teams shrink to tournament average rather than fabricated strength', () => {
  const model = baseline.buildModel(rows, '2026-10-14');
  const prediction = baseline.forecast(model, 'New club', 'Also new');
  assert.equal(prediction.rates.samples.home, 0);
  assert.equal(prediction.rates.samples.away, 0);
  assert.equal(prediction.rates.home, model.homeAverage);
  assert.equal(prediction.rates.away, model.awayAverage);
});

test('aggregate snapshot and raw historical reconstruction produce identical rates', () => {
  const historical=rows.slice(0,2);
  const snapshot=baseline.serializeModel(baseline.buildModel(historical,'2026-07-01'));
  const seeded=baseline.buildModel(rows,'2026-10-14',snapshot);
  const direct=baseline.buildModel(rows,'2026-10-14');
  const a=baseline.forecast(seeded,'Alpha','Beta',{includeHalfFull:false});
  const b=baseline.forecast(direct,'Alpha','Beta',{includeHalfFull:false});
  assert.equal(seeded.count,direct.count);
  for(const key of ['home','draw','away'])assert.ok(Math.abs(a.result[key]-b.result[key])<1e-12);
  assert.throws(()=>baseline.buildModel([], '2025-01-01',snapshot),/cutoff/);
});

test('duplicates, future dates and malformed results cannot change the forecast',()=>{
  const original=baseline.buildModel(rows,'2026-10-14');
  const changed=baseline.buildModel([...rows,rows[0],{...rows[4],score:'0-20'}],'2026-10-14');
  assert.equal(changed.count,original.count);
  assert.deepEqual(baseline.expectedGoals(changed,'Alpha','Beta'),baseline.expectedGoals(original,'Alpha','Beta'));
  assert.throws(()=>baseline.buildModel(rows,'2026-02-31'),/cutoff/);
});

test('audited public model contains aggregates only and reproducible holdout results',()=>{
  const model=JSON.parse(fs.readFileSync('js/data/prediction/model.json','utf8'));
  const report=JSON.parse(fs.readFileSync('js/data/prediction/backtest.json','utf8'));
  assert.equal(model.trainingMatches,864);
  assert.equal(model.auditedMatches,1122);
  assert.equal(model.count,864);
  assert.equal(model.crossCheckDifferences,0);
  assert.equal(model.sourceSeasons.length,8);
  assert.equal(new Set(model.teams.map(([name])=>name)).size,model.teams.length);
  assert.equal(model.rows,undefined);
  assert.equal(model.license,'CC0-1.0');
  assert.deepEqual(report.params,model.params);
  assert.equal(report.evaluation.model.matches,288);
  assert.equal(report.bySeason.reduce((n,r)=>n+r.model.matches,0),288);
  assert.ok(report.evaluation.model.logLoss<report.evaluation.pooled.logLoss);
  assert.equal(report.evaluation.model.calibration.reduce((n,b)=>n+b.count,0),864);
});

test('history parser separates regular time, extra time and penalty scores',()=>{
  const normal=parseScore('2','1',' (1-0)','test',1);
  assert.deepEqual([normal.score90Home,normal.score90Away],[2,1]);
  const penalties=parseScore('4','3',' pen. 2-2 a.e.t. (1-1, 0-0)','test',1);
  assert.deepEqual([penalties.score90Home,penalties.score90Away],[1,1]);
  assert.deepEqual(penalties.scoreAfterExtraTime,[2,2]);
  assert.deepEqual(penalties.penaltyShootout,[4,3]);
});

test('historical aliases share the current canonical club identity',()=>{
  const identity=require('../js/services/prediction-identity.js');
  assert.equal(identity.canonical('FC Internazionale Milano (ITA)'),'Internazionale');
  assert.equal(identity.canonical('FK Bodø/Glimt (NOR)'),'Bodo/Glimt');
  assert.equal(identity.canonical('Club Atlético de Madrid (ESP)'),'Atlético Madrid');
  assert.equal(identity.canonical('not a verified club'),null);
  assert.equal(identity.id('Bodo/Glimt'),'bodo-glimt');
});
