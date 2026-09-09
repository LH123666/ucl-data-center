import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

const context=vm.createContext({});
for(const file of ['../js/data/matches-data.js','../js/ui/team-context.js']){
  vm.runInContext(await readFile(new URL(file,import.meta.url),'utf8'),context);
}
const classify=(home,away,score)=>context.resultPotOutcome(home,away,score).kind;

test('result colors cover each rule regardless of home/away order',()=>{
  const cases=[
    [1,4,'2-0','green'],[4,1,'0-2','green'],
    [1,4,'0-2','red'],[4,1,'2-0','red'],
    [1,4,'0-0','red'],[4,1,'1-1','red'],
    [2,2,'0-0','yellow'],[2,2,'2-2','yellow'],
    [3,3,'2-0','blue'],[3,3,'0-2','blue'],
    [0,1,'2-0','unknown'],[2,undefined,'1-0','unknown'],
    [1,5,'2-0','unknown'],[1,2,'待赛','unknown'],
    [1,2,'—','unknown'],[1,2,'2–0','green']
  ];
  for(const [home,away,score,expected] of cases){
    assert.equal(classify(home,away,score),expected,JSON.stringify([home,away,score]));
  }
});

test('club labels share canonical identity and distinguish missing history',()=>{
  const markup=name=>vm.runInContext('fixtureClubMarkup('+JSON.stringify(name)+')',context);
  assert.equal(markup('LASK Linz'),markup('LASK'));
  assert.match(markup('Arsenal'),/上季英超第1/);
  assert.match(markup('Arsenal'),/2025\/26 欧冠联赛阶段/);
  assert.match(markup('AEK Athens'),/♞/);
  assert.match(markup('Viking'),/2025 国内联赛/);
  assert.match(markup('Como'),/上季意甲第4/);
  const unknown=markup('<unknown>');
  assert.match(unknown,/国内排名待核实/);
  assert.match(unknown,/欧冠待核实/);
  assert.doesNotMatch(unknown,/♞|<unknown>/);
});
