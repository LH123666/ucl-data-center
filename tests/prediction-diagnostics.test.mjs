import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {diagnoseTotals} from '../scripts/diagnose-prediction-totals.mjs';
const report=JSON.parse(fs.readFileSync(new URL('../js/data/prediction/totals-diagnostics.json',import.meta.url),'utf8'));
test('totals comparison keeps adverse metrics, all calibration bins and exploratory uncertainty',()=>{
 assert.ok(report.matches>=288);assert.equal(report.promotionEnabled,false);assert.equal(report.fitConverged,true);
 for(const k of ['over25','over35','btts']){assert.ok(Number.isFinite(report.paired[k].difference));assert.ok(report.paired[k].interval95[0]<=report.paired[k].interval95[1]);assert.equal(report.official.bins[k].length,5);assert.equal(report.candidate.bins[k].reduce((s,b)=>s+b.count,0),report.matches);const actualDifference=report.candidate.summary.markets[k].logLoss-report.official.summary.markets[k].logLoss;assert.ok(Math.abs(actualDifference-report.paired[k].difference)<1e-10);}
 assert.ok(report.bySeason.length>=2);assert.ok(!('rows' in report));
});
test('diagnostic builder refuses empty eligible comparisons rather than returning invented scores',()=>{
 assert.throws(()=>diagnoseTotals([],{halfLifeDays:730,priorGames:8}),/No eligible/);
});
