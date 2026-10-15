import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url), api = require('../js/services/prediction-baseline.js');
const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const dataset = JSON.parse(await fs.readFile(path.join(root,'research/ucl-history/prediction-dataset.json'),'utf8'));
const rows = dataset.rows.filter(row => ['league','group'].includes(row.stage));
const labels = ['home','draw','away'];
function metrics(samples) {
  const bins = Array.from({length:10},(_,i) => ({ lower:i/10,upper:(i+1)/10,count:0,predicted:0,observed:0 }));
  let loss=0,brier=0,correct=0;
  for (const {probabilities,actual} of samples) {
    loss -= Math.log(Math.max(1e-12,probabilities[actual]));
    if (labels.reduce((best,key) => probabilities[key]>probabilities[best]?key:best,'home') === actual) correct++;
    for (const key of labels) {
      const p=probabilities[key], y=Number(key===actual);
      brier += (p-y)**2;
      const bin=bins[Math.min(9,Math.floor(p*10))];bin.count++;bin.predicted+=p;bin.observed+=y;
    }
  }
  return { matches:samples.length, logLoss:loss/samples.length,brier:brier/samples.length,accuracy:correct/samples.length,
    calibration:bins.filter(b=>b.count).map(b=>({...b,predicted:b.predicted/b.count,observed:b.observed/b.count})) };
}
function evaluate(seasonKeys, params, mode='teams') {
  const cache = new Map(), samples=[];
  for (const row of rows.filter(r=>seasonKeys.includes(r.season))) {
    if(!cache.has(row.date))cache.set(row.date,api.buildModel(rows,row.date,null,params));
    const p=api.forecast(cache.get(row.date),row.home,row.away,{mode,includeHalfFull:false});
    const [h,a]=row.score.split('-').map(Number);
    samples.push({probabilities:p.result,actual:api.outcome(h,a)});
  }
  return metrics(samples);
}
// Select smoothing on 2023/24 only. 2024/25 and 2025/26 are untouched holdout seasons.
const candidates=[8,16,24].map(priorGames => {
  const params={halfLifeDays:730,priorGames};
  return {params,validation:evaluate(['2023-24'],params)};
}).sort((a,b)=>a.validation.logLoss-b.validation.logLoss);
const selected=candidates[0], params=selected.params;
const seasons=['2024-25','2025-26'].map(season=>({season,model:evaluate([season],params),pooled:evaluate([season],params,'pooled')}));
const model=evaluate(['2024-25','2025-26'],params), pooled=evaluate(['2024-25','2025-26'],params,'pooled');
const output=path.join(root,'js/data/prediction');
await fs.mkdir(output,{recursive:true});
const checkpoint=api.serializeModel(api.buildModel(rows,'2026-07-01',null,params));
const seed={schemaVersion:1,...checkpoint,source:'OpenFootball',license:'CC0-1.0',
  sourceRepository:dataset.sourceRepository,sourceSeasons:dataset.sources.map(({season,sha256,counts})=>({season,sha256,counts})),
  auditedMatches:dataset.total,trainingMatches:dataset.trainingMatches,
  crossCheckMatches:dataset.crossChecks.reduce((n,row)=>n+row.checked,0),
  crossCheckDifferences:dataset.crossChecks.reduce((n,row)=>n+row.differences.length,0)};
const report={schemaVersion:1,version:api.VERSION,generatedAt:new Date().toISOString(),params,
  validation:{season:'2023-24',candidates},evaluation:{seasons:['2024-25','2025-26'],model,pooled,
    logLossImprovement:1-model.logLoss/pooled.logLoss,brierImprovement:1-model.brier/pooled.brier},
  bySeason:seasons,protocol:'Rolling predictions using strictly earlier calendar dates; parameters selected on 2023/24 only.',
  caveats:['Historical scores were downloaded after the matches; original publication timestamps are unavailable.',
    'A chronological score reconstruction is not a historical saved live-prediction record.',
    'The evaluation covers league phase only, not qualifying or knockout stages.']};
await fs.writeFile(path.join(output,'model.json'),JSON.stringify(seed)+'\n');
await fs.writeFile(path.join(output,'backtest.json'),JSON.stringify(report,null,2)+'\n');
await fs.copyFile(path.join(root,'research/ucl-history/OPENFOOTBALL-LICENSE.md'),path.join(output,'OPENFOOTBALL-LICENSE.txt'));
console.log(JSON.stringify({params,trainingGames:checkpoint.count,holdout:model,baseline:pooled,improvement:report.evaluation.logLossImprovement},null,2));
