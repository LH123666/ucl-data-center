import fs from 'node:fs/promises';
import path from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
const root=path.dirname(path.dirname(fileURLToPath(import.meta.url))),require=createRequire(import.meta.url);
const base=require('../js/services/prediction-baseline.js'),opponent=require('../js/services/opponent-baseline.js'),journal=require('../js/services/prediction-journal.js');
export function diagnoseTotals(inputRows,params,{cutoffDate='9999-12-31'}={}){
const rows=inputRows.filter(r=>['group','league'].includes(r.stage)&&r.date<cutoffDate),seasons=[...new Set(rows.map(r=>r.season).filter(s=>s>='2024-25'))].sort(),targets=rows.filter(r=>seasons.includes(r.season)),cache=new Map(),samples={official:[],candidate:[]};
if(!targets.length)throw Error('No eligible chronological comparison matches');
for(const r of targets){
 if(!cache.has(r.date)){const models={official:base.buildModel(rows,r.date,null,params),candidate:opponent.fit(rows,r.date,{ridge:6,halfLifeDays:730})};if(!models.candidate.fitDiagnostics.converged)throw Error('Historical candidate fit did not converge');cache.set(r.date,models);}
 for(const kind of ['official','candidate']){const model=cache.get(r.date)[kind],p=kind==='official'?base.forecast(model,r.home,r.away,{includeHalfFull:false}):opponent.forecast(model,r.home,r.away);
  samples[kind].push(journal.scoreRecord({id:r.id,fixture:r,model:{kind,version:p.version},leadBucket:'historical-reconstruction',lineupStatus:'unknown',prediction:p,distribution:journal.distribution(p)},{goals:r.score.split('-').map(Number)}));
 }
}
const paired=Object.fromEntries(['over25','over35','btts'].map(k=>{
 const days=[...new Set(targets.map(r=>r.date))],blocks=days.map(day=>samples.official.flatMap((r,i)=>r.fixture.date===day?[samples.candidate[i].markets[k].logLoss-r.markets[k].logLoss]:[]));
 let seed=1729;const random=()=>{seed=(1664525*seed+1013904223)>>>0;return seed/4294967296;};
 const diffs=Array.from({length:1000},()=>{let total=0,n=0;for(let b=0;b<blocks.length;b++){const block=blocks[Math.floor(random()*blocks.length)];total+=block.reduce((s,v)=>s+v,0);n+=block.length;}return total/n;}).sort((a,b)=>a-b);
 return [k,{difference:samples.candidate.reduce((s,r,i)=>s+r.markets[k].logLoss-samples.official[i].markets[k].logLoss,0)/targets.length,interval95:[diffs[24],diffs[974]],method:'Paired calendar-day block bootstrap, 1000 deterministic resamples; exploratory, not fresh validation.'}];
}));
const report={schemaVersion:1,generatedAt:new Date().toISOString(),designation:'post-hoc-development-diagnostics',seasons,matches:targets.length,fits:cache.size,fitConverged:true,official:journal.diagnostics(samples.official),candidate:journal.diagnostics(samples.candidate),paired,
 bySeason:seasons.map(season=>({season,official:journal.diagnostics(samples.official.filter(r=>r.fixture.season===season)),candidate:journal.diagnostics(samples.candidate.filter(r=>r.fixture.season===season))})),
 limitations:['Every prediction uses only strictly earlier calendar dates, refitted once per date.','Post-hoc reconstructed comparisons; 2024/25 and 2025/26 were already viewed. No season becomes a prospective test merely by import.','Outcome-conditioned segments cannot be used as pre-match filters or causal proof.','Intervals are exploratory and do not account for all cross-day team dependence.','No probabilities or official parameters changed.'],promotionEnabled:false};
for(const kind of ['official','candidate'])if(!Number.isFinite(report[kind].summary.logLoss)||!Number.isFinite(report[kind].summary.scoreLogLoss))throw Error('Non-finite evaluation metric');
return report;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
const data=JSON.parse(await fs.readFile(path.join(root,'research/ucl-history/prediction-dataset.json'),'utf8'));
if(data.source!=='OpenFootball'||data.license!=='CC0-1.0')throw Error('Only existing CC0 history is allowed');
const params=JSON.parse(await fs.readFile(path.join(root,'js/data/prediction/model.json'),'utf8')).params;
const report=diagnoseTotals(data.rows,params);
await fs.writeFile(path.join(root,'js/data/prediction/totals-diagnostics.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({matches:report.matches,paired:report.paired,promotionEnabled:false},null,2));
}
