import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const context=vm.createContext({window:{}});
vm.runInContext(fs.readFileSync(new URL('../js/data/season-archives.js',import.meta.url),'utf8'),context);
for(const [key,archive] of Object.entries(context.window.uclSeasonArchives)){
  test(key+' archive has complete, unique teams, draws and competition rounds',()=>{
    assert.equal(archive.finalStandings.length,36);
    assert.equal(archive.leagueSchedule.length,144);
    assert.equal(archive.matches.filter(row=>row[5]==='knockout').length,45);
    assert.equal(archive.qualificationFixtures.length,14);
    assert.equal(new Set(archive.leagueSchedule.map(row=>row.slice(1).sort().join('|'))).size,144);
    for(const names of Object.values(archive.pots))assert.equal(names.length,9);
    for(const row of archive.finalStandings){
      assert.equal(row.p,8);
      assert.match(archive.names[row.name],/[\u4e00-\u9fff]/);
      const draw=archive.draw[row.name];assert.equal(draw.length,8);
      assert.equal(draw.filter(match=>match.venue==='home').length,4);
      for(const names of Object.values(archive.pots))assert.equal(draw.filter(match=>names.includes(match.opponent)).length,2);
    }
    assert.deepEqual(['第一轮','第二轮','第三轮','附加赛'].map(round=>archive.qualificationResults.filter(row=>row[1]===round).length),key==='2024-25'?[28,28,20,14]:[28,30,20,14]);
    archive.qualificationResults.forEach(row=>{assert.ok(archive.names[row[3]]&&archive.names[row[4]]);assert.ok(['冠军路径','联赛路径'].includes(row[2]))});
  });
}
