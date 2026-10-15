import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {parseSeason} from './collect-openfootball-history.mjs';
const require=createRequire(import.meta.url),identity=require('../js/services/prediction-identity.js'),opponent=require('../js/services/opponent-baseline.js');
export const hash=text=>createHash('sha256').update(text).digest('hex');
const validDay=x=>typeof x==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(x)&&Number.isFinite(Date.parse(x+'T00:00:00Z'))&&new Date(x+'T00:00:00Z').toISOString().slice(0,10)===x;
const pair=r=>[r.season,r.home,r.away].join('|');
export function validateRows(rows){
 const seen=new Set();
 return rows.filter(r=>['group','league'].includes(r.stage)).map(r=>{
  if(!/^20\d{2}-\d{2}$/.test(r.season)||+r.season.slice(5)!==(+r.season.slice(0,4)+1)%100||!validDay(r.date)||r.date<r.season.slice(0,4)+'-07-01'||r.date>String(+r.season.slice(0,4)+1)+'-06-30')throw Error('赛季或比赛日期无效');
  if(!identity.canonical(r.home)||!identity.canonical(r.away)||identity.canonical(r.home)===identity.canonical(r.away))throw Error('球队身份缺失或冲突');
  if(!/^\d{1,2}-\d{1,2}$/.test(r.score)||r.score.split('-').some(n=>+n>20)||r.scoreStatus&&r.scoreStatus!=='normal')throw Error('只接受常规时间比分');
  const clean={...r,home:identity.canonical(r.home),away:identity.canonical(r.away)},key=pair(clean);if(seen.has(key))throw Error('同赛季主客对阵重复');seen.add(key);return clean;
 });
}
export function normalizeUpdate(source){
 const url='https://raw.githubusercontent.com/openfootball/champions-league/master/'+source.season+'/cl.txt';
 if(source.license!=='CC0-1.0'||source.url!==url||source.sha256!==hash(source.raw))throw Error('来源、许可或原文哈希校验失败');
 return validateRows(parseSeason(source.season,url,source.raw).filter(r=>/^(?:Group|Gruppe|League)/.test(r.stage)).map(r=>({...r,home:identity.canonical(r.home),away:identity.canonical(r.away),score:r.score90Home+'-'+r.score90Away,stage:/^League/.test(r.stage)?'league':'group'})));
}
export function mergeHistory(dataset,updates,{acceptCorrections=false}={}){
 if(dataset.source!=='OpenFootball'||dataset.license!=='CC0-1.0')throw Error('拒绝未授权训练来源');
 const rows=validateRows(dataset.rows),map=new Map(rows.map(r=>[pair(r),r]));let added=0,corrected=0;
 for(const source of updates)for(const r of normalizeUpdate(source)){const old=map.get(pair(r));if(old&&(old.score!==r.score||old.date!==r.date)){if(!acceptCorrections)throw Error('比分或日期修订需要显式 --accept-corrections；原模型未变');corrected++;}else if(!old)added++;map.set(pair(r),r);}
 return {rows:[...map.values()].sort((a,b)=>a.date.localeCompare(b.date)||pair(a).localeCompare(pair(b))),added,corrected};
}
export function buildCandidate(dataset,updates,{cutoffDate,acceptCorrections=false,generatedAt=new Date().toISOString(),attempts=[]}={}){
 if(!validDay(cutoffDate)||!Number.isFinite(Date.parse(generatedAt))||cutoffDate>generatedAt.slice(0,10))throw Error('训练截止日无效或在未来');
 const merged=mergeHistory(dataset,updates,{acceptCorrections}),model=opponent.fit(merged.rows,cutoffDate,{ridge:6,halfLifeDays:730});
 if(!model.count||!model.fitDiagnostics.converged)throw Error('候选模型没有有效样本或未收敛');
 const sourceSet=[{name:'OpenFootball',license:'CC0-1.0',datasetSha256:hash(JSON.stringify(dataset)),latestObservedDate:model.lastDate},...updates.map(({raw,...s})=>s)];
 const inputSha256=hash(JSON.stringify({rows:merged.rows,cutoffDate,params:model.params})),checkpointId='opponent-'+inputSha256.slice(0,20);
 return {model:{...model,checkpointId,generatedAt,sourceSet,inputSha256,trainingCutoff:cutoffDate,latestObservedDate:model.lastDate,releaseGate:{enabled:false,reason:'Requires new frozen prospective evidence and explicit release decision.'}},
  state:{schemaVersion:1,checkpointId,generatedAt,dataCheckedAt:generatedAt,trainingCutoff:cutoffDate,latestTrainingResult:model.lastDate,trainingMatches:model.count,added:merged.added,corrected:merged.corrected,
   futureRowsExcluded:merged.rows.filter(r=>r.date>=cutoffDate).length,inputSha256,sourceSet,attempts,fitConverged:model.fitDiagnostics.converged,
   status:attempts.some(r=>r.status!=='success')?'partial-source-unavailable':'candidate-ready',promotionEnabled:false,
   officialModelChanged:false,limitations:['Source publication time is unknown; this is a post-hoc score reconstruction.','Candidate coefficients do not update merely because the website score button was clicked.','No lineup or tactical numerical effects.']},rows:merged.rows};
}
