import {createRequire} from 'node:module';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url),{chromium}=require(process.argv[2]||'playwright'),base=process.argv[3]||'http://127.0.0.1:8086';
const browser=await chromium.launch({channel:'msedge',headless:true}),errors=[],key='ucl:forecast-journal:v1';
const start='2026-10-15T10:00:00Z',url=base+'/?season=2026-27&view=predictor&tab=validation';
async function context(){const c=await browser.newContext({viewport:{width:1440,height:1000}});await c.route('**/*',r=>new URL(r.request().url()).hostname==='127.0.0.1'?r.continue():r.abort());return c;}
async function open(c,time=start){const p=await c.newPage();p.on('pageerror',e=>errors.push(e.message));await p.clock.setFixedTime(new Date(time));await p.goto(url);await p.locator('.validation-head').waitFor();return p;}
async function view(p,name){await p.locator('[data-validation-tab="'+name+'"]').click();}
try{
 const ctx=await context(),page=await open(ctx);
 assert.match(await page.locator('#validationBody').innerText(),/尚未冻结预测/);
 await view(page,'pipeline');assert.match(await page.locator('#validationBody').innerText(),/2026-01-28/);assert.match(await page.locator('#validationBody').innerText(),/404/);
 await view(page,'totals');assert.match(await page.locator('#validationBody').innerText(),/288/);assert.match(await page.locator('#validationBody').innerText(),/区间跨零/);
 await page.locator('[data-predictor-view="forecast"]').click();await page.locator('.predictor-matchup').waitFor();
 // Give the isolated test a precise fixture time. Ambiguous real feed times must remain blocked.
 const initial=await page.evaluate(()=>window.UclPredictorPage.getForecast());
 const forecast=await page.evaluate(async f=>{window.getUclLeaguePhaseFeed=()=>({upcoming:[{...f.fixture,time:'03:00'}],live:[]});await window.UclPredictorPage.selectFixture(f.fixture);return window.UclPredictorPage.getForecast();},initial);
 const originalProbability=JSON.stringify(forecast.prediction);
 await page.locator('#validationFreeze summary').click();await page.locator('#validationSaveCandidate').check();await page.locator('#validationFreezeSave').click();
 await page.waitForFunction(()=>document.querySelector('#validationFreezeMessage').textContent.includes('已冻结'));
 const data=await page.evaluate(()=>window.UclPredictionValidation.getJournal());assert.equal(data.records.length,2);assert.equal(data.records[0].model.kind,'official');assert.equal(data.records[1].model.kind,'candidate');assert.equal(data.records[0].prediction.result.home,forecast.prediction.result.home);
 assert.equal(await page.evaluate(()=>JSON.stringify(window.UclPredictorPage.getForecast().prediction)),originalProbability);
 const immutable=JSON.stringify(data.records),fixture=data.records[0].fixture;
 await page.locator('#validationOpenJournal').click();assert.equal(await page.locator('#validationBody tbody tr').count(),2);assert.equal(await page.evaluate(()=>window.UclPredictionValidation.getEvaluation().scored.length),0);
 const [download]=await Promise.all([page.waitForEvent('download'),page.locator('[data-validation-export]').click()]);assert.equal(download.suggestedFilename(),'ucl-forecast-journal.json');
 // Exercise the real scoreboard adapter with deterministic full-time evidence, not direct stored result injection.
 let goals=[1,0],status='STATUS_FULL_TIME';
 await ctx.route('**/scoreboard?**',async route=>{
  const events=route.request().url().includes('dates='+fixture.kickoff.slice(0,4))?[{id:'qa-journal-only',date:fixture.kickoff,season:{slug:'league-phase'},status:{type:{completed:true,state:'post',name:status}},competitions:[{id:'qa-journal-only',competitors:[{id:'home',homeAway:'home',team:{displayName:fixture.home},score:String(goals[0])},{id:'away',homeAway:'away',team:{displayName:fixture.away},score:String(goals[1])}]}]}]:[];
  await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({events})});
 });
 await page.clock.setFixedTime(new Date(Date.parse(fixture.kickoff)+3*3600000));
 await page.locator('[data-validation-update]').click();await page.waitForFunction(()=>window.UclPredictionValidation.getEvaluation().scored.length===2);
 const scored=await page.evaluate(()=>window.UclPredictionValidation.getEvaluation());assert.equal(scored.groups.length,2);assert.equal(scored.scored[0].h,1);assert.equal(await page.evaluate(()=>JSON.stringify(window.UclPredictionValidation.getJournal().records)),immutable);
 const evidenceCount=await page.evaluate(()=>window.UclPredictionValidation.getJournal().results.length);await page.locator('[data-validation-update]').click();await page.waitForFunction(()=>!document.querySelector('#updateBtn').disabled);assert.equal(await page.evaluate(()=>window.UclPredictionValidation.getJournal().results.length),evidenceCount);
 goals=[2,2];await page.clock.setFixedTime(new Date(Date.parse(fixture.kickoff)+3*3600000+60000));await page.locator('[data-validation-update]').click();await page.waitForFunction(()=>window.UclPredictionValidation.getEvaluation().scored[0]?.h===2);
 assert.equal(await page.evaluate(()=>window.UclPredictionValidation.getEvaluation().scored[0].resultRevisions),2);assert.equal(await page.evaluate(()=>JSON.stringify(window.UclPredictionValidation.getJournal().records)),immutable);
 const saved=await page.evaluate(()=>window.UclPredictionValidation.getJournal());
 await page.locator('#validationImport').setInputFiles({name:'duplicate.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(saved))});await page.waitForFunction(()=>document.querySelector('#validationMessage').textContent.includes('冲突'));assert.equal(await page.evaluate(()=>window.UclPredictionValidation.getJournal().records.length),2);
 const importedCtx=await context(),importedPage=await open(importedCtx,'2026-11-01T10:00:00Z');
 await importedPage.locator('#validationImport').setInputFiles({name:'backup.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(saved))});await importedPage.waitForFunction(()=>window.UclPredictionValidation.getJournal().records.length===2);
 assert.equal(await importedPage.evaluate(()=>window.UclPredictionValidation.getEvaluation().scored.length),0);assert.equal(await importedPage.evaluate(()=>window.UclPredictionValidation.getJournal().records.every(r=>!r.evaluationEligible)),true);await importedCtx.close();
 await page.reload();await page.locator('.validation-head').waitFor();assert.equal(await page.evaluate(()=>window.UclPredictionValidation.getJournal().records.length),2);
 await view(page,'totals');assert.match(await page.locator('#validationBody').innerText(),/1场/);
 await fs.mkdir('research/ucl-history',{recursive:true});await page.locator('.validation-head').scrollIntoViewIfNeeded();await page.screenshot({path:'research/ucl-history/prediction-validation-desktop.png',fullPage:true});
 await page.setViewportSize({width:390,height:844});for(const name of ['journal','pipeline','totals']){await view(page,name);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth)<=391,name);}
 await view(page,'journal');await page.locator('.validation-head').scrollIntoViewIfNeeded();await page.screenshot({path:'research/ucl-history/prediction-validation-mobile.png'});
 const corruptCtx=await context();await corruptCtx.addInitScript(k=>localStorage.setItem(k,'{broken'),key);const corruptPage=await open(corruptCtx);assert.match(await corruptPage.locator('#validationBody').innerText(),/原内容保留/);assert.equal(await corruptPage.evaluate(k=>localStorage.getItem(k),key),'{broken');await corruptCtx.close();
 const missingCtx=await context();await missingCtx.route('**/candidate-model.json',r=>r.fulfill({status:503,body:'Unavailable'}));const missingPage=await open(missingCtx);await missingPage.locator('[data-predictor-view="forecast"]').click();await missingPage.locator('.predictor-matchup').waitFor();assert.ok(await missingPage.evaluate(()=>window.UclPredictorPage.getForecast().prediction.result.home)>0);await missingCtx.close();
 const concurrentCtx=await context(),concurrentPages=[await open(concurrentCtx),await open(concurrentCtx)];
 async function prepareFreeze(p){await p.locator('[data-predictor-view="forecast"]').click();await p.locator('.predictor-matchup').waitFor();await p.evaluate(async()=>{const f=window.UclPredictorPage.getForecast().fixture;window.getUclLeaguePhaseFeed=()=>({upcoming:[{...f,time:'03:00'}],live:[]});await window.UclPredictorPage.selectFixture(f);});await p.locator('#validationFreeze summary').click();}
 await Promise.all(concurrentPages.map(prepareFreeze));await Promise.all(concurrentPages.map(p=>p.locator('#validationFreezeSave').click()));for(const p of concurrentPages)await p.waitForFunction(()=>document.querySelector('#validationFreezeMessage').textContent.includes('已冻结'));assert.equal(await concurrentPages[0].evaluate(()=>window.UclPredictionValidation.getJournal().records.length),2);await concurrentCtx.close();
 const quotaCtx=await context();await quotaCtx.addInitScript(({key,data})=>{localStorage.setItem(key,JSON.stringify(data));const set=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k===key)throw new DOMException('Storage full','QuotaExceededError');return set.call(this,k,v);};},{key,data});const quotaPage=await open(quotaCtx);await prepareFreeze(quotaPage);await quotaPage.locator('#validationFreezeSave').click();await quotaPage.waitForFunction(()=>document.querySelector('#validationFreezeMessage').textContent.includes('配额不足'));assert.equal(await quotaPage.evaluate(k=>localStorage.getItem(k),key),JSON.stringify(data));await quotaCtx.close();
 await page.goto(base+'/?season=2025-26&view=predictor&tab=validation');await page.locator('.predictor-metrics').waitFor();assert.equal(await page.locator('[data-predictor-view="validation"]').isDisabled(),true);assert.equal(await page.locator('#predictorValidation').isVisible(),false);
 await ctx.close();assert.deepEqual(errors,[]);
 console.log('PASS: dual-model immutable pre-match freezes, official probability isolation, real scoreboard adapter, automatic scoring/corrections/deduplication, backup import isolation, source freshness, totals diagnostics, concurrent tabs, quota/corrupt storage safety, archived seasons and 390px mobile.');
}finally{await browser.close();}
