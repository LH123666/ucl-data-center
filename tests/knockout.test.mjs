import assert from 'node:assert/strict';
import {access,readFile} from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

const root=new URL('../',import.meta.url);

test('all 36 league clubs resolve to a local crest through the identity catalog',async()=>{
  const source=await readFile(new URL('js/data/matches-data.js',root),'utf8');
  const context=vm.createContext({});vm.runInContext(source,context);
  const logos=vm.runInContext('leagueTeamCatalog.map(team=>team.logo)',context);
  assert.equal(logos.length,36);assert.equal(new Set(logos).size,36);
  await Promise.all(logos.map(path=>access(new URL(path,root))));
});

test('knockout routes cover every live qualification rank exactly once',async()=>{
  const source=await readFile(new URL('js/data/knockout-data.js',root),'utf8');
  const context=vm.createContext({});vm.runInContext(source,context);
  const routes=JSON.parse(vm.runInContext('JSON.stringify(uclKnockoutRoutes.map(route=>({direct:[...route.direct],seeded:[...route.seeded],unseeded:[...route.unseeded]})))',context));
  const ranks=routes.flatMap(route=>[...route.direct,...route.seeded,...route.unseeded]).sort((a,b)=>a-b);
  assert.deepEqual(ranks,Array.from({length:24},(_,index)=>index+1));
  assert.deepEqual({...routes[0]},{direct:[1,2],seeded:[15,16],unseeded:[17,18]});
  assert.deepEqual({...routes[3]},{direct:[7,8],seeded:[9,10],unseeded:[23,24]});
});

test('knockout endpoint normalizes a live match and its event timeline',async()=>{
  const source=await readFile(new URL('functions/api/ucl-knockout-live.js',root),'utf8');
  const module=await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
  const event={id:'401',date:'2027-03-09T20:00:00Z',status:{type:{completed:false,state:'in',shortDetail:"67'"}},competitions:[{competitors:[{id:'h',homeAway:'home',score:'2',team:{displayName:'FC Barcelona'}},{id:'a',homeAway:'away',score:'1',team:{displayName:'Bayern München'}}],details:[{scoringPlay:true,clock:{displayValue:"61'"},team:{id:'h'},type:{text:'Goal'},athletes:[{displayName:'测试球员'}]}]}]};
  const originalFetch=globalThis.fetch;let call=0;
  globalThis.fetch=async()=>new Response(JSON.stringify({events:call++?[]:[event]}),{headers:{'content-type':'application/json'}});
  try{
    const response=await module.onRequestGet(),payload=await response.json();
    assert.equal(response.status,200);assert.equal(payload.matches.length,1);
    assert.deepEqual(payload.matches[0],{id:'401',date:'2027-03-09',round:'round16',home:'Barcelona',away:'Bayern Munich',homeScore:2,awayScore:1,completed:false,inProgress:true,status:"67'",timeline:[{clock:"61'",type:'Goal',text:'Goal · 测试球员 · FC Barcelona'}]});
  }finally{globalThis.fetch=originalFetch}
});
