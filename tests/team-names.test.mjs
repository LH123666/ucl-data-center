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
      ...leagueTeams.map(([name])=>name),
      ...rawMatches.flatMap(match=>[match[1],match[2]]),
      ...rawUpcoming.flatMap(match=>[match.home,match.away]),
      ...qualificationResults.flatMap(match=>[match[3],match[4]]),
      ...qualificationFixtures.flatMap(match=>[match[4],match[5]]),
      ...qualificationActiveChampion,
      ...qualificationActiveLeague
    ].map(canonicalTeamName));
    return {
      sameCatalog:qualificationNames===uclNames,
      leagueTeamCount:leagueTeams.length,
      catalogCount:leagueTeamCatalog.length,
      uniqueLeagueNames:new Set(leagueTeamCatalog.map(team=>team.name)).size,
      chineseNames:leagueTeamCatalog.map(team=>team.zh),
      potSizes:Object.fromEntries(Object.entries(leaguePots).map(([pot,names])=>[pot,names.length])),
      aliases:['LASK Linz','Feyenoord Rotterdam','Viking FK','Sabah FK'].map(canonicalTeamName),
      draw:Object.fromEntries(Object.entries(leagueDraw).map(([name,fixtures])=>[name,{count:fixtures.length,home:fixtures.filter(f=>f.venue==='home').length,away:fixtures.filter(f=>f.venue==='away').length,pots:Object.fromEntries([1,2,3,4].map(pot=>[pot,fixtures.filter(f=>leaguePotFor(f.opponent)===pot).length]))}])),
      unknown:[...names].filter(name=>!uclNames[name]),
      unknownAliasTargets:Object.values(aliases).filter(name=>!uclNames[name])
    };
  })()`,context);
  assert.equal(audit.sameCatalog,true);
  assert.equal(audit.leagueTeamCount,36);
  assert.equal(audit.catalogCount,36);
  assert.equal(audit.uniqueLeagueNames,36);
  assert.equal(new Set(audit.chineseNames).size,36);
  assert.ok(audit.chineseNames.every(name=>/[\u4e00-\u9fff]/.test(name)),`中文名缺失：${audit.chineseNames.join('、')}`);
  assert.deepEqual({...audit.potSizes},{1:9,2:9,3:9,4:9});
  assert.deepEqual([...audit.aliases],['LASK','Feyenoord','Viking','Sabah']);
  assert.equal(Object.keys(audit.draw).length,36);
  Object.entries(audit.draw).forEach(([name,draw])=>{
    assert.equal(draw.count,8,`${name} 对手数错误`);
    assert.equal(draw.home,4,`${name} 主场数错误`);
    assert.equal(draw.away,4,`${name} 客场数错误`);
    assert.deepEqual({...draw.pots},{1:2,2:2,3:2,4:2},`${name} 各档对手数错误`);
  });
  assert.equal(audit.unknown.length,0,`未登记球队：${[...audit.unknown].join('、')}`);
  assert.equal(audit.unknownAliasTargets.length,0,`别名指向未登记球队：${[...audit.unknownAliasTargets].join('、')}`);
  assert.ok(index.indexOf('js/data/matches-data.js')<index.indexOf('js/data/qualification-data.js'));
  assert.doesNotMatch(advancement,/\{path:'(?:冠军|联赛)路径',a:'[\u4e00-\u9fff]/);
  assert.match(advancement,/a:'Slovan Bratislava',b:'Celje'/);
  assert.match(advancement,/label:'第一轮晋级',className:'origin-round1-winner'/);
  assert.match(advancement,/label:'第二轮新加入',className:'origin-round2-entry'/);
  assert.match(advancement,/label:'第三轮晋级',className:'origin-round3-winner'/);
  assert.match(advancement,/label:'附加赛新加入',className:'origin-playoff-entry'/);
  assert.match(advancement,/<strong>\$\{zh\(team\)\}<\/strong><small>\$\{canonicalTeamName\(team\)\}<\/small>\$\{origin\?/);
});

test('live ingestion cannot append a 37th league-phase team',async()=>{
  const [manager,app,styles]=await Promise.all([
    readFile(new URL('js/data-manager.js',root),'utf8'),
    readFile(new URL('js/app.js',root),'utf8'),
    readFile(new URL('css/enhancements.css',root),'utf8')
  ]);
  assert.doesNotMatch(manager,/teams\.push\(/);
  assert.match(manager,/incoming\.size!==36/);
  assert.match(manager,/leagueTeamInfo\(homeName\)/);
  assert.match(manager,/teamDrawFixtures/);
  assert.match(manager,/8 场/);
  assert.match(app,/leagueTeamCatalog\.map/);
  assert.match(app,/pot-\$\{t\[11\]\}/);
  assert.match(styles,/\.bilingual\{display:inline-flex;flex-direction:column/);
  assert.match(styles,/#standings tr\.pot-4/);
});
