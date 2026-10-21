import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {chromium}=require(process.argv[2]||'playwright');
const screenshotDir='research/ucl-history/result-statistics';fs.mkdirSync(screenshotDir,{recursive:true});
const base=process.argv[3]||process.env.UCL_STATS_QA_URL||'http://127.0.0.1:8086/';
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'msedge'}),summary=[];
 try{
  for(const width of [1440,390])for(const season of ['2025-26','2024-25','2026-27']){
   const page=await browser.newPage({viewport:{width,height:1040}}),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.emulateMedia({reducedMotion:'reduce'});
   await page.route('**/fonts.googleapis.com/**',r=>r.abort());await page.route('**/fonts.gstatic.com/**',r=>r.abort());
   let revision=0,scoreCalls=0;
   await page.route('**/api/ucl-qualification-live**',r=>r.fulfill({contentType:'application/json',body:JSON.stringify({matches:[],live:true,source:'QA simulated qualification',checkedAt:'2026-10-21T01:00:00Z'})}));
   await page.route('**/api/ucl-knockout-live**',r=>r.fulfill({contentType:'application/json',body:JSON.stringify({matches:[],status:'not-started',source:'QA simulated knockout',checkedAt:'2026-10-21T01:00:00Z'})}));
   await page.route('**/site.api.espn.com/**',r=>{
    const url=r.request().url();let events=[];
    if(season==='2026-27'&&url.includes('dates=2026')){
     scoreCalls++;events=[{id:'QA-UCL-001',date:'2026-10-20T19:00:00Z',season:{slug:'league-phase'},status:{type:{completed:true,name:'STATUS_FULL_TIME'}},competitions:[{competitors:[{id:'1',homeAway:'home',score:revision?'1':'2',team:{displayName:'Paris Saint-Germain',id:'1'},linescores:[{period:1,value:revision?0:1},{period:2,value:1}]},{id:'2',homeAway:'away',score:revision?'1':'5',team:{displayName:'Slovan Bratislava',id:'2'},linescores:[{period:1,value:0},{period:2,value:revision?1:5}]}]}]}];
    }
    return r.fulfill({contentType:'application/json',body:JSON.stringify({events})});
   });
   assert.equal((await page.goto(base+'?season='+season,{waitUntil:'networkidle'})).status(),200);
   await page.waitForSelector('#resultsHeatmap');await page.waitForFunction(()=>!document.querySelector('#updateBtn')?.disabled);
   assert.equal(await page.locator('.heatmap-panel').count(),4);assert.equal(await page.locator('[data-heatmap-kind="handicap"]').count(),0);
   const counts=await page.evaluate(()=>{const s=window.uclHeatmap.render(matches);return {total:s.total,half:s.half.total,bulls:[...window.uclUpsets.refresh(matches).values()].reduce((n,x)=>n+x.bull,0),rabbits:[...window.uclUpsets.refresh(matches).values()].reduce((n,x)=>n+x.rabbit,0)};});
   assert.equal(counts.bulls,counts.rabbits);assert.ok(counts.bulls>0);
   if(season!=='2026-27'){assert.equal(counts.total,144);assert.equal(counts.half,144);assert.equal(scoreCalls,0);}
   assert.ok(await page.locator('#standings .upset-badge').count()>0);assert.ok(await page.locator('.upset-legend').count()===1);
   for(const[kind,key]of [['goals','7+'],['half','负胜']]){
    const button=page.locator(`[data-heatmap-select="${kind}"][data-key="${key}"]`),expected=Number(await button.getAttribute('data-count'));
    await button.focus();await page.keyboard.press('Enter');assert.equal(await page.locator('#heatmapMatchDetails [data-heatmap-match]').count(),expected);
    assert.equal(await button.getAttribute('aria-expanded'),'true');assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
    if(expected){
     assert.equal(await page.locator('#heatmapMatchDetails .fixture-context').count(),expected*2);
     await page.locator('#heatmapMatchDetails [data-heatmap-match]').first().click();await page.waitForSelector('#drawer.open');await page.locator('#close').click();await page.waitForSelector('#drawer:not(.open)');
     assert.equal(await page.locator('#heatmapMatchDetails [data-heatmap-match]').count(),expected);
    }
    if(season==='2025-26'&&kind==='goals'){await page.locator('#resultsHeatmap').screenshot({path:path.join(screenshotDir,`ucl-heatmap-${width}.png`)});await page.locator('#heatmapMatchDetails').screenshot({path:path.join(screenshotDir,`ucl-detail-${width}.png`)});}
    await page.locator('#heatmapMatchDetails').focus();await page.keyboard.press('Escape');assert.equal(await button.evaluate(el=>el===document.activeElement),true);
   }
   if(season==='2025-26')await page.locator('.table-card').screenshot({path:path.join(screenshotDir,`ucl-badges-${width}.png`)});
   await page.locator('#latestBtn').click();assert.equal(await page.locator('#resultsHeatmap').isVisible(),false);assert.ok(await page.locator('#resultGrid .upset-badge').count()>0);
   await page.locator('#advancementBtn').click();await page.locator('[data-advance-view="league"]').click();assert.ok(await page.locator('#leaguePhaseHub .upset-badge').count()>0);await page.locator('[data-advance-view="knockout"]').click();assert.ok(await page.locator('#koRouteGrid .upset-badge').count()>0);
   if(season!=='2026-27'){await page.locator('#scheduleBtn').click();assert.ok(await page.locator('#scheduleGrid .upset-badge').count()>0);}
   await page.locator('#predictorBtn').click();assert.equal(await page.locator('#resultsHeatmap').isVisible(),false);
   await page.locator('nav button').first().click();assert.equal(await page.locator('#resultsHeatmap').isVisible(),true);
   const team=await page.evaluate(()=>[...window.uclUpsets.refresh(matches)].find(([,x])=>x.bull>0)[0]);await page.evaluate(n=>window.openTeam(n),team);
   assert.ok(await page.locator('.team-hero .upset-badge').count()>0);await page.locator('#close').click();
   if(season==='2026-27'){
    const b=page.locator('[data-heatmap-select="goals"][data-key="7+"]');await page.locator('#heatmapRound').selectOption('0');await b.click();assert.equal(await page.locator('#heatmapMatchDetails [data-heatmap-match]').count(),1);
    revision=1;await page.locator('#updateBtn').click();await page.waitForFunction(()=>!document.querySelector('#updateBtn').disabled);assert.equal(await page.locator('#heatmapMatchDetails [data-heatmap-match]').count(),0);
    assert.equal(await page.locator('#drawer').evaluate(el=>el.classList.contains('open')),false);assert.equal(await page.evaluate(()=>window.uclUpsets.get('Slovan Bratislava').bull),0);assert.equal(await page.evaluate(()=>window.uclUpsets.get('Paris Saint-Germain').rabbit),0);
    const n=await page.evaluate(()=>window.uclHeatmap.render(matches).total);await page.locator('#updateBtn').click();await page.waitForFunction(()=>!document.querySelector('#updateBtn').disabled);assert.equal(await page.evaluate(()=>window.uclHeatmap.render(matches).total),n);
   }else{
    await page.locator('#heatmapRound').selectOption('1');assert.match(await page.locator('#heatmapSampleStatus').textContent(),/已获取18场/);await page.locator('#updateBtn').click();await page.waitForFunction(()=>!document.querySelector('#updateBtn').disabled);assert.equal(await page.locator('#heatmapRound').inputValue(),'1');assert.equal(scoreCalls,0);
   }
   assert.deepEqual(errors,[]);summary.push({width,season,...counts,errors:0});await page.close();
  }
  console.log(JSON.stringify({base,passed:true,summary},null,2));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

