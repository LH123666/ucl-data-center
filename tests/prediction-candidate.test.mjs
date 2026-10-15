import test from 'node:test';
import assert from 'node:assert/strict';
import {hash,mergeHistory,normalizeUpdate,buildCandidate} from '../scripts/prediction-candidate-lib.mjs';
const row={season:'2025-26',date:'2025-10-01',home:'Arsenal',away:'Barcelona',score:'1-0',stage:'league',scoreStatus:'normal'};
const data={source:'OpenFootball',license:'CC0-1.0',rows:[row]};
function source(score='1-0'){const raw='= UEFA Champions League\n# Matches 1\n▪ League, Matchday 1\n  Wed Oct 1 2025\n    Arsenal FC v FC Barcelona '+score+' (0-0)\n';return {season:'2025-26',license:'CC0-1.0',url:'https://raw.githubusercontent.com/openfootball/champions-league/master/2025-26/cl.txt',raw,sha256:hash(raw)};}
test('candidate source validates license, hash, identity, season and regular-time scores',()=>{
 assert.equal(normalizeUpdate(source()).length,1);assert.throws(()=>normalizeUpdate({...source(),sha256:'bad'}),/哈希/);assert.throws(()=>normalizeUpdate({...source(),url:'https://other.test'}),/来源/);
 assert.throws(()=>mergeHistory({...data,license:'unknown'},[]),/授权/);assert.throws(()=>mergeHistory({...data,rows:[row,row]},[]),/重复/);
 assert.throws(()=>mergeHistory({...data,rows:[{...row,date:'2025-02-30'}]},[]),/日期/);
});
test('corrections require explicit approval and original input stays unchanged',()=>{
 const original=JSON.stringify(data);assert.throws(()=>mergeHistory(data,[source('2-0')]),/修订/);assert.equal(JSON.stringify(data),original);
 const m=mergeHistory(data,[source('2-0')],{acceptCorrections:true});assert.equal(m.rows.length,1);assert.equal(m.corrected,1);assert.equal(m.rows[0].score,'2-0');
});
test('candidate distinguishes check time from latest score and never promotes on fetch success',()=>{
 const c=buildCandidate({...data,rows:[{...row,score:'2-1'}]},[],{cutoffDate:'2026-10-15',generatedAt:'2026-10-15T10:00:00Z',attempts:[{season:'2026-27',status:'unavailable',message:'HTTP 404'}]});
 assert.equal(c.state.latestTrainingResult,'2025-10-01');assert.equal(c.state.status,'partial-source-unavailable');assert.equal(c.state.promotionEnabled,false);assert.equal(c.state.officialModelChanged,false);assert.equal(c.model.releaseGate.enabled,false);
 assert.throws(()=>buildCandidate(data,[],{cutoffDate:'2027-01-01',generatedAt:'2026-10-15T10:00:00Z'}),/未来/);
});
