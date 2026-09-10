import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

const root=new URL('../',import.meta.url);

test('Pages Function parses the complete UEFA playoff results and publishes 36 teams',async()=>{
  const source=await readFile(new URL('functions/api/ucl-qualification-live.js',root),'utf8');
  const module=await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
  const officialText=[
    'Levski Sofia 0-0 AEK Athens','GNK Dinamo 2-2 Viking','Fenerbahçe 1-1 Lyon',
    'Celtic 3-0 LASK','N.E.C. 1-3 Bodø/Glimt','Slovan Bratislava 1-1 Celje',
    'Hapoel Beer-Sheva 2-1 Sabah','Sabah 5-2 aet Hapoel Beer-Sheva','LASK 5-1 aet Celtic',
    'Bodø/Glimt 3-0 N.E.C.','AEK Athens 4-0 Levski Sofia','Viking 3-1 GNK Dinamo',
    'Celje 1-2 aet Slovan Bratislava','Lyon 1-2 Fenerbahçe'
  ].join('\n');
  const originalFetch=globalThis.fetch;
  globalThis.fetch=async()=>new Response(officialText);
  try{
    const response=await module.onRequestGet();
    assert.equal(response.status,200);
    assert.equal(response.headers.get('cache-control'),'no-store, max-age=0');
    const payload=await response.json();
    assert.equal(payload.live,true);
    assert.equal(payload.qualificationComplete,true);
    assert.equal(payload.sourceUpdatedAt,'2026-08-27');
    assert.equal(payload.resultsUpdatedAt,'2026-08-26');
    assert.equal(payload.matches.length,14);
    assert.equal(payload.leagueTeams.length,36);
    assert.deepEqual(payload.matches.slice(0,3).map(match=>[match.home,match.away,match.homeScore,match.awayScore]),[
      ['Levski Sofia','AEK Athens',0,0],['Dinamo Zagreb','Viking',2,2],['Fenerbahce','Lyon',1,1]
    ]);
    assert.ok(payload.matches.some(match=>match.home==='Sabah'&&match.away==='Hapoel Beer-Sheva'&&match.homeScore===5&&match.awayScore===2));
  }finally{globalThis.fetch=originalFetch}
});

test('refresh flow uses the UCL API first and the correct 2026/27 date window',async()=>{
  const [advancement,manager]=await Promise.all([
    readFile(new URL('js/ui/advancement.js',root),'utf8'),readFile(new URL('js/data-manager.js',root),'utf8')
  ]);
  assert.match(advancement,/function renderPlayoffs\(liveMatches=\[\]\)/);
  assert.match(advancement,/renderRound3\(matches\);renderPlayoffs\(matches\)/);
  assert.match(advancement,/\['2026-08-25','Sabah','Hapoel Beer-Sheva',5,2\]/);
  assert.match(advancement,/\['2026-08-26','Lyon','Fenerbahce',1,2\]/);
  assert.match(advancement,/window\.refreshUclAdvancement=update/);
  assert.match(manager,/const fetchOfficialPayload=async/);
  assert.match(manager,/official\.leagueTeams\?\.length===36/);
  assert.match(manager,/date>=seasonMeta.start&&date<=seasonMeta.end/);
  assert.match(manager,/seasonMeta.years\.map/);
  assert.doesNotMatch(manager,/静态数据 · 07-12/);
  assert.match(manager,/正在同步官方数据/);
});

test('static first paint contains all qualification results and 36 league-phase teams',async()=>{
  const [matchData,qualificationData,app,qualificationUi]=await Promise.all([
    readFile(new URL('js/data/matches-data.js',root),'utf8'),
    readFile(new URL('js/data/qualification-data.js',root),'utf8'),
    readFile(new URL('js/app.js',root),'utf8'),
    readFile(new URL('js/ui/qualification.js',root),'utf8')
  ]);
  const context=vm.createContext({});
  vm.runInContext(matchData,context);
  vm.runInContext(qualificationData,context);
  const snapshot=vm.runInContext('({teams:leagueTeams.length,upcoming:rawUpcoming.length,results:qualificationResults.length,fixtures:qualificationFixtures.length,qualified:qualificationActiveChampion.length+qualificationActiveLeague.length})',context);
  assert.deepEqual({...snapshot},{teams:36,upcoming:0,results:90,fixtures:14,qualified:7});
  assert.match(app,/verifiedQualificationMatches/);
  assert.match(app,/staticVerified=window.uclSeason.current\?'2026-08-26':window.uclSeason.end/);
  assert.match(qualificationUi,/<b>90<\/b><span>已完成比赛<\/span>/);
  assert.match(qualificationUi,/14 \/ 14场/);
  assert.match(qualificationUi,/附加赛完整赛果/);
});
