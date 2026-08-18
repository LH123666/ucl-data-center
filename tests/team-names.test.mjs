import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

const root=new URL('../',import.meta.url);

test('all UCL pages share one canonical team-name catalog',async()=>{
  const [matchData,qualificationData,advancement,index]=await Promise.all([
    readFile(new URL('js/data/matches-data.js',root),'utf8'),
    readFile(new URL('js/data/qualification-data.js',root),'utf8'),
    readFile(new URL('js/ui/advancement.js',root),'utf8'),
    readFile(new URL('index.html',root),'utf8')
  ]);
  const context=vm.createContext({});
  vm.runInContext(matchData,context);
  vm.runInContext(qualificationData,context);
  const audit=vm.runInContext(`(()=>{
    const names=new Set([
      ...rawMatches.flatMap(match=>[match[1],match[2]]),
      ...rawUpcoming.flatMap(match=>[match.home,match.away]),
      ...qualificationResults.flatMap(match=>[match[3],match[4]]),
      ...qualificationFixtures.flatMap(match=>[match[4],match[5]]),
      ...qualificationActiveChampion,
      ...qualificationActiveLeague
    ].map(canonicalTeamName));
    return {
      sameCatalog:qualificationNames===uclNames,
      unknown:[...names].filter(name=>!uclNames[name]),
      unknownAliasTargets:Object.values(aliases).filter(name=>!uclNames[name])
    };
  })()`,context);
  assert.equal(audit.sameCatalog,true);
  assert.equal(audit.unknown.length,0,`未登记球队：${[...audit.unknown].join('、')}`);
  assert.equal(audit.unknownAliasTargets.length,0,`别名指向未登记球队：${[...audit.unknownAliasTargets].join('、')}`);
  assert.ok(index.indexOf('js/data/matches-data.js')<index.indexOf('js/data/qualification-data.js'));
  assert.doesNotMatch(advancement,/\{path:'(?:冠军|联赛)路径',a:'[\u4e00-\u9fff]/);
  assert.match(advancement,/a:'Slovan Bratislava',b:'Celje'/);
});
