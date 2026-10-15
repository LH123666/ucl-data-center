import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),api=require('../js/services/prediction-journal.js'),base=require('../js/services/prediction-baseline.js');
const now='2026-10-15T10:00:00Z',kickoff='2026-10-20T19:00:00Z';
const p=base.forecast(base.buildModel([{season:'2026-27',date:'2026-10-01',home:'A',away:'B',score:'2-1',stage:'league'}],'2026-10-15'),'A','B',{includeHalfFull:false});
const input=()=>({id:'snapshot-1',fixture:{season:'2026-27',date:'2026-10-21',home:'A',away:'B',kickoff},prediction:p,model:{kind:'official',version:p.version,checkpointId:'checkpoint-1'},generatedAt:now,lineupStatus:'unknown'});
const result=(score=[1,0],observedAt='2026-10-20T22:00:00Z',id='result-1')=>api.createResult({id,fixture:input().fixture,goals:score,observedAt,source:'espn-observed',sourceUrl:'https://site.api.espn.com/apis/site/v2/sports/soccer/uefa.champions/scoreboard',status:'full-time'},{now:observedAt});
test('forecast snapshots are immutable, preserve probability distribution and validate cutoff',()=>{
 const s=api.createSnapshot(input(),{now});assert.ok(Object.isFrozen(s.prediction.result));assert.equal(s.independentlyCertified,false);assert.equal(s.leadBucket,'24h-plus');assert.equal(s.distribution.matrix.length,21);
 assert.throws(()=>api.createSnapshot({...input(),generatedAt:kickoff},{now:kickoff}),/开球/);
 assert.throws(()=>api.createSnapshot({...input(),prediction:{...p,lastDate:p.cutoffDate}},{now}),/泄漏/);
 assert.throws(()=>api.createSnapshot({...input(),prediction:{...p,result:{home:1,draw:0,away:0}}},{now}),/不一致/);
 assert.throws(()=>api.createSnapshot({...input(),fixture:{...input().fixture,date:'2026-10-20'}},{now}),/不一致/);
 assert.throws(()=>api.createSnapshot(input(),{now:'2026-10-21T00:00:00Z'}),/开球/);
 const later=api.createSnapshot(input(),{now:'2026-10-20T18:30:00Z'});assert.equal(later.leadBucket,'under-1h');assert.equal(later.frozenAt,'2026-10-20T18:30:00.000Z');
});
test('journal roundtrip, ID conflict and corrupted storage never silently replace data',()=>{
 const s=api.createSnapshot(input(),{now}),d=api.append(api.empty(),s);assert.deepEqual(api.read(JSON.stringify(d)),d);assert.deepEqual(api.append(d,s),d);
 assert.throws(()=>api.append(d,{...s,lineupStatus:'confirmed'}),/冲突/);assert.throws(()=>api.read('{broken'));
 const changed=structuredClone(d);changed.records[0].prediction.result.home=.9;assert.throws(()=>api.read(JSON.stringify(changed)),/不一致/);
});
test('imported backups are all unverified and excluded, duplicate imports atomic',()=>{
 const d=api.append(api.empty(),api.createSnapshot(input(),{now})),merged=api.importBackup(api.empty(),d,{now});assert.equal(merged.records[0].evaluationEligible,false);assert.equal(api.evaluate(merged).excluded.length,1);
 assert.throws(()=>api.importBackup(d,d,{now}),/冲突/);assert.equal(d.records.length,1);
});
test('only observed completed regular-time result evidence is accepted',()=>{
 assert.throws(()=>api.createResult({...result(),status:'live'},{now:'2026-10-21T00:00:00Z'}),/90分钟/);
 assert.throws(()=>api.createResult({...result(),observedAt:now},{now}),/开球后/);
 assert.throws(()=>api.createResult({...result(),source:'cache'},{now:'2026-10-21T00:00:00Z'}),/来源/);
});
test('automatic evaluation uses exact fixture, earliest snapshot per time bucket, and preserves corrections',()=>{
 let d=api.append(api.empty(),api.createSnapshot(input(),{now}));d=api.append(d,api.createSnapshot({...input(),id:'snapshot-2',generatedAt:'2026-10-16T10:00:00Z'},{now:'2026-10-16T10:00:00Z'}));
 assert.equal(api.evaluate(d).pending.length,2);d=api.append(d,result(),'results');let e=api.evaluate(d);assert.equal(e.scored.length,1);assert.equal(e.excluded.length,1);assert.equal(e.groups[0].matches,1);assert.ok(Number.isFinite(e.scored[0].scoreLogLoss));
 const original=JSON.stringify(d.records);d=api.append(d,result([2,2],'2026-10-21T00:00:00Z','correction'),'results');e=api.evaluate(d);assert.equal(e.scored[0].resultRevisions,2);assert.equal(e.scored[0].h,2);assert.equal(JSON.stringify(d.records),original);
});
test('conflicting final evidence and changed kickoff leave predictions pending',()=>{
 let d=api.append(api.empty(),api.createSnapshot(input(),{now}));d=api.append(d,result(),'results');d=api.append(d,result([2,0],'2026-10-20T22:00:00Z','other'),'results');assert.equal(api.evaluate(d).scored.length,0);assert.equal(api.evaluate(d).pending[0].reason,'conflicting-result');
});
test('totals diagnostics preserve all bins, empty samples and market monotonicity',()=>{
 let d=api.append(api.empty(),api.createSnapshot(input(),{now}));d=api.append(d,result(),'results');const diag=api.diagnostics(api.evaluate(d).scored);assert.equal(diag.matches,1);assert.equal(diag.bins.over25.length,5);assert.equal(diag.segments[2].matches,0);assert.equal(api.diagnostics([]).summary.logLoss,null);assert.ok(diag.summary.markets.over35.predicted<=diag.summary.markets.over25.predicted);
});
