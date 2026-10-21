import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const read=f=>fs.readFileSync(new URL('../'+f,import.meta.url),'utf8');
const context=vm.createContext({window:{}});
for(const file of ['js/services/upset-badges.js','js/ui/results-heatmap.js','js/services/match-halftime.js','js/data/season-archives.js'])vm.runInContext(read(file),context);
const w=context.window,heat=w.uclHeatmap,upsets=w.uclUpsets;
const row=(h,a,s,half='—',md=1,source='unverified',date='2026-09-10',stage='league')=>[date,h,a,s,half,stage,'',md,'','03:00',source];
const cell=(s,key)=>s.cells.find(c=>c.key===key),sum=(s,key)=>[...s.values()].reduce((n,c)=>n+c[key],0);
const catalog=[{name:'A',pot:1},{name:'B',pot:2},{name:'C',pot:3},{name:'D',pot:4},{name:'Unknown',pot:0}];

test('UCL heatmap shares denominators, has exhaustive score/goal buckets and retains exact drilldown samples',()=>{
  const s=heat.summarize([row('A','B','2-0','1-0',1,'official'),row('B','C','1-1','0-1',1,'archive'),row('C','D','0-2','0-0',1,'snapshot'),row('D','A','5-2','0-1',1,'events'),row('E','F','4-4','2-0',1,'official')]);
  assert.equal(s.total,5);assert.equal(s.half.total,5);assert.equal(s.score.cells.length,31);assert.equal(s.goals.cells.length,8);assert.equal(s.half.cells.length,9);
  for(const key of ['had','score','goals','half'])assert.equal(s[key].cells.reduce((n,c)=>n+c.count,0),5);
  for(const key of ['goals','half'])for(const c of s[key].cells)assert.equal(c.count,c.matches.length);
  assert.equal(cell(s.score,'平其他').count,1);assert.equal(cell(s.goals,'7+').count,2);assert.equal(cell(s.half,'负胜').count,1);
});

test('half/full excludes unverifiable and impossible halves, and zero-zero does not require guessed event data',()=>{
  const s=heat.summarize([row('A','B','1-0','0-0'),row('C','D','1-0','2-0',1,'official'),row('E','F','0-0')]);
  assert.equal(s.total,3);assert.equal(s.half.total,1);assert.equal(s.halfMissing,2);assert.equal(cell(s.half,'平平').count,1);
});

test('heatmap filters season/phase, rejects impossible dates and penalties, and applies latest fixture corrections',()=>{
  const rows=[row('A','B','0-1'),row('AliasA','B','1-1','0-0',2,'events','2026-10-21'),row('C','D','2-0','—',1,'unverified','2026-08-01','qualifying'),row('E','F','2-0','—',1,'unverified','2027-03-01','knockout'),row('G','H','1-0','—',1,'unverified','2025-10-01'),row('I','J','2-1 (pens)'),row('K','L','3-0','—',1,'unverified','2026-02-30')];
  const s=heat.summarize(rows,{seasonKey:'2026-27',canonicalize:n=>n==='AliasA'?'A':n,matchday:2});
  assert.equal(s.total,1);assert.equal(cell(s.had,'平局').count,1);assert.equal(s.latest,'2026-10-21');
});

test('official schedule supplies matchday even after postponement; zero samples mean undefined proportions',()=>{
  const s=heat.summarize([row('A','B','1-0','—',null)],{fixtures:[{home:'A',away:'B',matchday:3}],matchday:3});assert.equal(s.total,1);
  const empty=heat.summarize([]);for(const key of ['had','score','goals','half'])assert.ok(empty[key].cells.every(c=>c.percent===null));
});

test('shared heat colors maintain readable contrast across the frequency scale',()=>{
  const lum=rgb=>rgb.map(x=>{x/=255;return x<=.04045?x/12.92:((x+.055)/1.055)**2.4;}).reduce((n,x,i)=>n+x*[.2126,.7152,.0722][i],0);
  for(let p=0;p<=100;p++){const t=heat.tone(p),bg=t.background.match(/\d+/g).map(Number),fg=t.foreground.slice(1).match(/.{2}/g).map(x=>parseInt(x,16));const [a,b]=[lum(bg),lum(fg)].sort((a,b)=>b-a);assert.ok((a+.05)/(b+.05)>=4.5);}
});

test('bulls and rabbits count lower-pot wins at either venue; a club can earn both',()=>{
  const s=upsets.calculate([row('D','B','2-0'),row('A','C','0-1'),row('C','D','0-1')],catalog,n=>n,'2026-27');
  assert.equal(s.get('D').bull,2);assert.equal(s.get('C').bull,1);assert.equal(s.get('C').rabbit,1);assert.equal(s.get('A').rabbit,1);
  assert.equal(sum(s,'bull'),3);assert.equal(sum(s,'rabbit'),3);
});

test('qualifiers, same-pot wins, draws, missing pots, unplayed and penalty descriptions do not count',()=>{
  const s=upsets.calculate([row('A','B','2-0'),row('C','D','1-1'),row('D','Same','2-0'),row('D','A','2-0','—',1,'unverified','2026-08-01','qualifying'),row('Unknown','A','1-0'),row('D','A','1-1 (5-4 pens)'),row('D','A','VS'),row('D','A','3-0','—',1,'unverified','2026-02-30')],[...catalog,{name:'Same',pot:4}],n=>n,'2026-27');
  assert.equal(sum(s,'bull'),0);assert.equal(sum(s,'rabbit'),0);
});

test('aliases, duplicate refreshes, postponements and corrections cannot accumulate badges',()=>{
  const canonical=n=>n==='AliasD'?'D':n;
  const rows=[row('D','A','2-0'),row('AliasD','A','2-0'),row('D','A','3-0','—',1,'unverified','2026-09-11')];
  const s=upsets.calculate(rows,catalog,canonical,'2026-27');assert.equal(sum(s,'bull'),1);assert.equal(s.get('D').wins[0].date,'2026-09-11');
  assert.equal(sum(upsets.calculate([...rows,row('D','A','1-1','—',1,'unverified','2026-09-11')],catalog,canonical,'2026-27'),'bull'),0);
});

test('knockout individual legs count separately, not aggregate or shoot-out wins',()=>{
  const s=upsets.calculate([row('D','A','1-0','—',1,'unverified','2027-03-01','knockout'),row('A','D','0-1','—',1,'unverified','2027-03-08','knockout'),row('C','B','1-1','—',1,'unverified','2027-03-08','knockout')],catalog,n=>n,'2026-27');
  assert.equal(s.get('D').bull,2);assert.equal(s.get('A').rabbit,2);
});

for(const [key,archive] of Object.entries(w.uclSeasonArchives))test(`${key} archives have independent 144-match heatmaps and balanced badge counts`,()=>{
  const seasonCatalog=Object.entries(archive.pots).flatMap(([pot,names])=>names.map(name=>({name,pot:Number(pot)}))),rows=archive.matches.map(r=>{const x=[...r];x[10]='archive';return x;});
  const h=heat.summarize(rows,{seasonKey:key});assert.equal(h.total,144);assert.equal(h.half.total,144);
  const counts=upsets.calculate(rows,seasonCatalog,n=>n,key);assert.ok(sum(counts,'bull')>0);assert.equal(sum(counts,'bull'),sum(counts,'rabbit'));
  const pots=new Map(seasonCatalog.map(t=>[t.name,t.pot]));const expected=rows.filter(r=>{const [a,b]=r[3].split('-').map(Number);return a!==b&&pots.has(r[1])&&pots.has(r[2])&&(a>b?pots.get(r[1])>pots.get(r[2]):pots.get(r[2])>pots.get(r[1]));}).length;
  assert.equal(sum(counts,'bull'),expected);
});

const competitor=(id,score,linescores)=>({id:String(id),score:String(score),linescores});
test('missing event details do not become a fabricated 0-0 halftime',()=>{
  const r=w.uclHalftime.resolve({},competitor(1,2),competitor(2,1));assert.equal(r.score,'—');assert.equal(r.source,'unverified');
  assert.equal(w.uclHalftime.resolve({},competitor(1,0),competitor(2,0)).source,'zero-zero');
});
test('halftime uses complete period scores and rejects nulls and totals that fail reconciliation',()=>{
  const h=competitor(1,2,[{period:1,value:1},{period:2,value:1}]),a=competitor(2,1,[{period:1,value:0},{period:2,value:1}]);
  assert.equal(w.uclHalftime.resolve({},h,a).score,'1-0');assert.equal(w.uclHalftime.resolve({},h,a).source,'official');
  h.linescores[0].value=null;assert.equal(w.uclHalftime.resolve({},h,a).score,'—');h.linescores[0].value=3;assert.equal(w.uclHalftime.resolve({},h,a).score,'—');
});
test('complete scoring events include first-half stoppage time; partial lists and unknown own-goal attribution stay missing',()=>{
  const h=competitor(1,1),a=competitor(2,1),details=[{scoringPlay:true,team:{id:'1'},period:{number:1},clock:{value:2820}},{scoringPlay:true,team:{id:'2'},period:{number:2},clock:{value:3600}}];
  assert.equal(w.uclHalftime.resolve({details},h,a).score,'1-0');assert.equal(w.uclHalftime.resolve({details:details.slice(0,1)},h,a).score,'—');
  details[0].ownGoal=true;assert.equal(w.uclHalftime.resolve({details},h,a).score,'—');
});
