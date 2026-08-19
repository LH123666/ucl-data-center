import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';

const root=new URL('../',import.meta.url);

test('Pages Function parses and canonicalizes UEFA playoff results',async()=>{
  const source=await readFile(new URL('functions/api/ucl-qualification-live.js',root),'utf8');
  const module=await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
  const originalFetch=globalThis.fetch;
  globalThis.fetch=async()=>new Response('Levski Sofia 0-0 AEK Athens\nGNK Dinamo 2-2 Viking\nFenerbahçe 1-1 Lyon');
  try{
    const response=await module.onRequestGet();
    assert.equal(response.status,200);
    assert.equal(response.headers.get('cache-control'),'no-store, max-age=0');
    const payload=await response.json();
    assert.equal(payload.live,true);
    assert.equal(payload.matches.length,3);
    assert.deepEqual(payload.matches.map(match=>[match.home,match.away,match.homeScore,match.awayScore]),[
      ['Levski Sofia','AEK Athens',0,0],['Dinamo Zagreb','Viking',2,2],['Fenerbahce','Lyon',1,1]
    ]);
  }finally{globalThis.fetch=originalFetch}
});

test('advancement page rerenders playoff scores after every refresh',async()=>{
  const [source,manager]=await Promise.all([
    readFile(new URL('js/ui/advancement.js',root),'utf8'),readFile(new URL('js/data-manager.js',root),'utf8')
  ]);
  assert.match(source,/function renderPlayoffs\(liveMatches=\[\]\)/);
  assert.match(source,/renderRound3\(matches\);renderPlayoffs\(matches\)/);
  assert.doesNotMatch(source,/advancePlayoffs'\)\.innerHTML=playoffs\.map/);
  assert.match(source,/\['2026-08-18','Levski Sofia','AEK Athens',0,0\]/);
  assert.match(source,/window\.refreshUclAdvancement=update/);
  assert.match(manager,/fresh\.push\(\.\.\.await fetchOfficialRows\(\)\)/);
  assert.doesNotMatch(manager,/if\(!seasonEvents\.length\)fresh\.push\(\.\.\.await fetchOfficialRows\(\)\)/);
  assert.match(manager,/window\.refreshUclAdvancement\?\.\(\)/);
});
