import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const context=vm.createContext({window:{},canonicalTeamName:name=>name,leaguePotFor:name=>({A:1,B:4,C:2,D:2}[name]||0)});
vm.runInContext(fs.readFileSync(new URL('../js/ui/team-context.js',import.meta.url),'utf8'),context);
vm.runInContext(fs.readFileSync(new URL('../js/ui/league-phase.js',import.meta.url),'utf8').split('(function(){')[0],context);
test('round statistics count each fixture once, exclude live scores and use known pots for upsets',()=>{
  const match=(home,away,score,state='complete')=>({home,away,score,state});
  const stats=context.window.uclRoundStats([match('A','B','1-2'),match('A','B','1-2'),match('C','D','1-1'),match('E','F','0-2'),match('X','Y','4-0','live'),match('G','H','—')]);
  assert.deepEqual(JSON.parse(JSON.stringify(stats)),{played:3,goals:7,draws:1,homeWins:0,awayWins:2,bothScore:2,overTwo:1,upsets:1,knownPots:2});
  assert.equal(context.window.uclRoundStats([]).played,0);
});
