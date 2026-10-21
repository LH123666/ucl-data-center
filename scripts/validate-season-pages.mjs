import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {JSDOM}=require(process.argv[2]||'jsdom');
const html=fs.readFileSync('index.html','utf8');
for(const season of ['2026-27','2025-26','2024-25']){
  const dom=new JSDOM(html,{url:'https://ucl-data-center.pages.dev/?season='+season,runScripts:'outside-only'});
  const w=dom.window,context=dom.getInternalVMContext(),timers=[],requests=[];
  w.scrollTo=()=>{};w.HTMLElement.prototype.scrollIntoView=()=>{};
  w.setTimeout=(fn,delay)=>{if(delay<100)timers.push(fn);return 1};w.setInterval=()=>1;
  w.fetch=async url=>{requests.push(url);throw new Error('Offline validation')};
  if(season==='2024-25'){w.sessionStorage.setItem('ucl-advance-view','league');w.sessionStorage.setItem('ucl-return-view','advancementBtn')}
  if(season==='2026-27')w.localStorage.setItem('ucl36-match-predictions-v1',JSON.stringify({'2026-09-10|Paris Saint-Germain|Arsenal':[{note:'saved prediction'}]}));
  const run=(source,name)=>new vm.Script(source,{filename:name}).runInContext(context);
  const load=path=>run(fs.readFileSync(path.split('?')[0],'utf8'),path);
  let selected='';
  w.document.write=text=>{selected=text;for(const match of text.matchAll(/src="([^"]+)"/g))load(match[1])};
  for(const tag of html.matchAll(/<script(?: src="([^"]+)")?>([\s\S]*?)<\/script>/g))tag[1]?load(tag[1]):run(tag[2],'inline-loader');
  timers.forEach(fn=>fn());await new Promise(resolve=>setImmediate(resolve));
  assert.equal(w.uclSeason.key,season);
  if(season==='2024-25'){assert.equal(w.document.querySelector('#leagueStatisticsView').hidden,false);assert.ok(w.document.querySelector('#advancementPage').classList.contains('active'))}
  assert.equal(w.document.querySelectorAll('#standings tr').length,36);
  assert.equal(w.document.querySelectorAll('.season-option').length,3);
  assert.equal(w.document.querySelectorAll('.heatmap-panel').length,4);
  assert.equal(w.document.querySelectorAll('[data-heatmap-kind="handicap"]').length,0);
  assert.equal(w.document.querySelectorAll('.upset-legend').length,1);
  const distribution=run('window.uclHeatmap.render(matches)','heatmap-distribution');
  const tally=run('window.uclUpsets.refresh(matches)','upset-counts');
  assert.equal([...tally.values()].reduce((n,x)=>n+x.bull,0),[...tally.values()].reduce((n,x)=>n+x.rabbit,0));
  if(!w.uclSeason.current){assert.equal(distribution.total,144);assert.equal(distribution.half.total,144);assert.ok(w.document.querySelectorAll('#standings .upset-badge').length>0)}
  assert.equal(w.document.querySelectorAll('[data-heatmap-select="score"]').length,31);
  for(const [kind,key] of [['score','2:1'],['score','胜其他'],['score','平其他'],['score','负其他'],['goals','7+'],['half','负胜']]){
    const button=w.document.querySelector(`[data-heatmap-select="${kind}"][data-key="${key}"]`),expected=Number(button.dataset.count);
    button.click();assert.equal(w.document.querySelectorAll('#heatmapMatchDetails [data-heatmap-match]').length,expected);
    assert.equal(w.document.querySelectorAll('#heatmapMatchDetails .fixture-context').length,expected*2);
    if(!expected)assert.ok(w.document.querySelector('.heatmap-matches-empty'));
    if(kind==='score'){
      assert.match(w.document.querySelector('#heatmapMatchTitle').textContent,new RegExp('比分 '+key));
      assert.equal(w.document.querySelector('[data-heatmap-kind="score"]').nextElementSibling.id,'heatmapMatchDetails');
    }
    w.document.querySelector(`[data-heatmap-select="${kind}"][data-key="${key}"]`).focus();run('renderResults()','refresh-with-keyboard-focus');assert.equal(w.document.activeElement,w.document.querySelector(`[data-heatmap-select="${kind}"][data-key="${key}"]`));
    w.document.querySelector('#heatmapMatchDetails').focus();run('renderResults()','refresh-detail-focus');assert.equal(w.document.activeElement.id,'heatmapMatchDetails');
    w.document.querySelector('[data-close-heatmap]').click();assert.equal(w.document.activeElement,w.document.querySelector(`[data-heatmap-select="${kind}"][data-key="${key}"]`));
  }
  const resultCount=()=>w.document.querySelectorAll('#resultGrid .match').length;
  const eligible=run('matches.filter(row=>["league","knockout"].includes(row[5])).length','result-count');
  assert.equal(resultCount(),Math.min(8,eligible));
  w.document.querySelector('#latestBtn').click();
  assert.equal(w.document.querySelector('#latest').style.display,'block');
  assert.equal(w.document.querySelector('.layout').style.display,'none');
  assert.equal(w.document.querySelector('#resultsHeatmap').hidden,true);
  assert.equal(w.document.querySelector('#leaguePhaseHub').parentElement.id,'leagueStatisticsView');
  assert.ok(!w.document.querySelector('#advancementPage').classList.contains('active'));
  w.document.querySelector('#advancementBtn').click();
  w.document.querySelector('[data-advance-view="league"]').click();
  assert.equal(w.document.querySelector('#leagueStatisticsView').hidden,false);
  assert.equal(w.document.querySelector('#qualificationAdvanceView').hidden,true);
  assert.equal(w.document.querySelectorAll('.phase-stat-grid article').length,8);
  w.document.querySelector('.matchday-node[data-round="1"]').click();
  assert.match(w.document.querySelector('.phase-statistics h3').textContent,/第1轮/);
  w.refreshLeaguePhaseView();assert.match(w.document.querySelector('.phase-statistics h3').textContent,/第1轮/);
  assert.equal(w.sessionStorage.getItem('ucl-advance-view'),'league');
  w.document.querySelector('#latestBtn').click();
  if(eligible>8){
    w.document.querySelector('.results-toggle').click();assert.equal(resultCount(),eligible);
    run('renderResults()','refresh-results');assert.equal(resultCount(),eligible);
    for(const day of w.document.querySelectorAll('.result-date')){
      const date=day.querySelector('time').dateTime;
      assert.ok([...day.querySelectorAll('.match')].every(card=>card.dataset.date===date));
    }
    w.document.querySelector('.results-toggle').click();assert.equal(resultCount(),8);
  }
  for(const id of ['infoBtn','qualificationBtn','advancementBtn','scheduleBtn']){
    w.document.getElementById(id).click();assert.equal(w.document.querySelector('#latest').style.display,'none');
    w.document.querySelector('#latestBtn').click();assert.equal(w.document.querySelector('#latest').style.display,'block');
    assert.equal(w.document.querySelectorAll('#competitionInfo.active,#qualificationPage.active,#advancementPage.active,#schedulePage.active').length,0);
  }
  w.document.querySelector('nav button').click();assert.equal(w.document.querySelector('#latest').style.display,'none');
  assert.equal(w.document.querySelector('#resultsHeatmap').hidden,false);
  const trigger=w.document.querySelector('.season-trigger');trigger.click();
  assert.equal(trigger.getAttribute('aria-expanded'),'true');
  trigger.dispatchEvent(new w.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
  assert.equal(trigger.getAttribute('aria-expanded'),'false');
  if(season!=='2026-27'){
    assert.match(selected,/archive-runtime/);assert.doesNotMatch(selected,/matches-data/);
    assert.equal(requests.length,0,'Archive must never fetch current-season data');
    assert.equal(w.document.querySelectorAll('.matchday-node.done').length,8);
    assert.equal(w.document.querySelectorAll('#scheduleGrid .fixture').length,144);
    assert.equal(w.document.querySelectorAll('.phase-matrix-row:not(.header)').length,36);
    const comparison=[...w.document.querySelectorAll('.round-comparison tbody tr')];
    assert.equal(comparison.length,8);
    assert.ok(comparison.every(row=>row.children[1].textContent==='18/18'));
    const archiveGoals=run('matches.filter(m=>m[5]==="league").reduce((sum,m)=>sum+m[3].split("-").reduce((a,b)=>a+Number(b),0),0)','archive-goals');
    assert.equal(comparison.reduce((sum,row)=>sum+Number(row.children[2].textContent),0),archiveGoals);
    const colors=new Map();
    for(const cell of w.document.querySelectorAll('.phase-match.complete')){
      const key=[cell.dataset.home,cell.dataset.away].sort().join('|');
      const color=[...cell.classList].find(value=>value.startsWith('result-'));
      assert.ok(color);if(colors.has(key))assert.equal(color,colors.get(key));else colors.set(key,color);
    }
    assert.equal(colors.size,144);
    w.document.querySelector('#scheduleBtn').click();assert.ok(w.document.querySelector('#schedulePage').classList.contains('active'));
    w.document.querySelector('#qualificationBtn').click();assert.ok(w.document.querySelector('#qualificationPage').classList.contains('active'));
    w.document.querySelector('#advancementBtn').click();assert.ok(w.document.querySelector('#advancementPage').classList.contains('active'));
    w.document.querySelector('[data-advance-view="knockout"]').click();
    assert.equal(w.document.querySelectorAll('.ko-match').length,45);
    w.openTeam('Paris Saint-Germain');
    assert.match(w.document.querySelector('.team-hero .eyebrow').textContent,new RegExp(w.uclSeason.label));
    assert.equal(w.document.querySelectorAll('.draw-opponent').length,8);
    await w.openFixtureDetail('Paris Saint-Germain','Arsenal');
    assert.match(w.document.querySelector('.match-detail-head').textContent,new RegExp(w.uclSeason.label));
    await w.document.querySelector('#updateBtn').onclick();
    assert.equal(requests.length,0,'Archive refresh/details must remain season-isolated');
  }else {assert.match(selected,/matches-data/);assert.match(w.localStorage.getItem('ucl36-match-predictions-v1-2026-27'),/saved prediction/)}
  console.log(season+': page initialization, navigation, season menu and data isolation passed');
  w.close();
}
