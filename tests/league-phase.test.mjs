import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

const root=new URL('../',import.meta.url);

test('league phase hub covers all eight official matchdays',async()=>{
  const [script,index,styles]=await Promise.all([
    readFile(new URL('js/ui/league-phase.js',root),'utf8'),
    readFile(new URL('index.html',root),'utf8'),
    readFile(new URL('css/league-phase.css',root),'utf8')
  ]);
  assert.equal((script.match(/\{n:\d,label:/g)||[]).length,8);
  assert.match(script,/36队 · 8比赛日全景矩阵/);
  assert.match(script,/144-completed-live/);
  assert.match(script,/leaguePhaseTeamOrbitMarkup/);
  assert.match(script,/轮次待同步/);
  assert.ok(index.indexOf('js/data-manager.js')<index.indexOf('js/ui/league-phase.js'));
  assert.ok(index.indexOf('js/data/league-phase-schedule.js')<index.indexOf('js/ui/league-phase.js'));
  assert.match(styles,/grid-template-columns:42px 188px repeat\(8/);
  assert.match(styles,/\.orbit-stage/);
  assert.match(styles,/@media\(max-width:760px\)/);
  assert.match(styles,/@media\(max-width:760px\)\{\.league-phase-hub\{overflow:hidden\}\}/);
});

test('official static fallback contains one route for every league-phase match',async()=>{
  const source=await readFile(new URL('js/data/league-phase-schedule.js',root),'utf8');
  const context=vm.createContext({});
  const schedule=vm.runInContext(`${source};uclLeaguePhaseSchedule`,context);
  assert.equal(schedule.length,144);
  assert.equal(new Set(schedule.map(([,home,away])=>[home,away].sort().join('|'))).size,144);
  const appearances=new Map();
  schedule.forEach(([,home,away])=>{appearances.set(home,(appearances.get(home)||0)+1);appearances.set(away,(appearances.get(away)||0)+1)});
  assert.equal(appearances.size,36);
  assert.ok([...appearances.values()].every(count=>count===8));
});

test('live refresh exposes future and in-progress league fixtures',async()=>{
  const manager=await readFile(new URL('js/data-manager.js',root),'utf8');
  assert.match(manager,/getUclLeaguePhaseFeed/);
  assert.match(manager,/liveLeagueFixtures/);
  assert.match(manager,/status\?\.type\?\.state==='in'/);
  assert.match(manager,/refreshLeaguePhaseView/);
  assert.match(manager,/leaguePhaseTeamOrbitMarkup/);
  assert.match(manager,/bindLeaguePhaseOrbit/);
});
