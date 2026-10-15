/* Explicit local command. No production promotion, credentials or provider scraping. */
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {hash,normalizeUpdate,buildCandidate} from './prediction-candidate-lib.mjs';
import {diagnoseTotals} from './diagnose-prediction-totals.mjs';
const root=path.dirname(path.dirname(fileURLToPath(import.meta.url))),args=process.argv.slice(2);
if(args.some(x=>!['--fetch','--use-audited-cache','--accept-corrections'].includes(x)&&!/^--(?:season|as-of)=/.test(x)))throw Error('未知参数');
if(args.includes('--fetch')&&args.includes('--use-audited-cache'))throw Error('在线获取与已审计缓存模式应明确选择其一');
const now=new Date().toISOString(),cutoffDate=args.find(x=>x.startsWith('--as-of='))?.slice(8)||now.slice(0,10);
const seasons=args.filter(x=>x.startsWith('--season=')).map(x=>x.slice(9));
if(seasons.some(s=>!/^20\d{2}-\d{2}$/.test(s)))throw Error('无效赛季');
const dataset=JSON.parse(await fs.readFile(path.join(root,'research/ucl-history/prediction-dataset.json'),'utf8')),updates=[],attempts=[];
try{
if(args.includes('--use-audited-cache')){
 let previous;try{previous=JSON.parse(await fs.readFile(path.join(root,'js/data/prediction/candidate-state.json'),'utf8'));}catch{}
 for(const season of [...new Set(seasons.length?seasons:['2025-26','2026-27'])]){
  const manifest=dataset.sources?.find(s=>s.season===season),url='https://raw.githubusercontent.com/openfootball/champions-league/master/'+season+'/cl.txt';
  if(!manifest){const old=previous?.attempts?.find(r=>r.season===season);attempts.push({season,url,status:'unavailable',message:'无已审计缓存；未进行新联网检查'+(old?.message?'；此前记录：'+old.message:''),checkedAt:new Date().toISOString()});continue;}
  const raw=await fs.readFile(path.join(root,'research/ucl-history/raw',season+'-cl.txt'),'utf8');if(hash(raw)!==manifest.sha256)throw Error('本地缓存原文哈希与已审计清单不一致');
  const source={season,url,raw,sha256:hash(raw),license:'CC0-1.0',retrievedAt:null,acquisition:'verified-local-cache',verifiedAt:new Date().toISOString()};
  const rows=normalizeUpdate(source);updates.push(source);attempts.push({season,url,status:'cached',message:'仅校验已审计本地缓存，未联网更新',matches:rows.length,sha256:source.sha256,checkedAt:source.verifiedAt});
 }
}
if(args.includes('--fetch')){
 const license=await fetch('https://raw.githubusercontent.com/openfootball/champions-league/master/LICENSE.md',{signal:AbortSignal.timeout(20000)});
 if(!license.ok||!/CC0|public domain/i.test(await license.text()))throw Error('在线许可校验失败，未写入候选模型');
 for(const season of [...new Set(seasons.length?seasons:['2025-26','2026-27'])]){
  const url='https://raw.githubusercontent.com/openfootball/champions-league/master/'+season+'/cl.txt';
  try{const response=await fetch(url,{cache:'no-store',signal:AbortSignal.timeout(20000)});if(!response.ok)throw Error('HTTP '+response.status);
   const raw=await response.text(),source={season,url,raw,sha256:hash(raw),license:'CC0-1.0',retrievedAt:new Date().toISOString()};const rows=normalizeUpdate(source);
   updates.push(source);attempts.push({season,url,status:'success',matches:rows.length,sha256:source.sha256,checkedAt:source.retrievedAt});
  }catch(error){attempts.push({season,url,status:'unavailable',message:error.message,checkedAt:new Date().toISOString()});}
 }
}
const candidate=buildCandidate(dataset,updates,{cutoffDate,generatedAt:new Date().toISOString(),acceptCorrections:args.includes('--accept-corrections'),attempts});
const referenceParams=JSON.parse(await fs.readFile(path.join(root,'js/data/prediction/model.json'),'utf8')).params;
const diagnostics=diagnoseTotals(candidate.rows,referenceParams,{cutoffDate});
diagnostics.checkpointId=candidate.state.checkpointId;
candidate.state.validation={matches:diagnostics.matches,fits:diagnostics.fits,fitConverged:diagnostics.fitConverged,designation:diagnostics.designation,passedStructuralChecks:true,prospectiveValidation:false};
const rawStore=path.join(root,'research/ucl-history/updates');await fs.mkdir(rawStore,{recursive:true});
for(const source of updates){try{await fs.writeFile(path.join(rawStore,source.season+'-'+source.sha256+'.txt'),source.raw,{flag:'wx'});}catch(error){if(error.code!=='EEXIST')throw error;}}
const store=path.join(root,'research/ucl-history/candidates');await fs.mkdir(store,{recursive:true});
const archive=path.join(store,candidate.state.checkpointId+'.json');
try{await fs.writeFile(archive,JSON.stringify(candidate,null,2)+'\n',{flag:'wx'});}catch(error){if(error.code!=='EEXIST')throw error;}
// Model, manifest and diagnostics are validated before replacing public aggregate pointers.
const out=path.join(root,'js/data/prediction');
async function atomic(name,data){const file=path.join(out,name),temp=file+'.tmp';await fs.writeFile(temp,JSON.stringify(data,null,2)+'\n');await fs.rename(temp,file);}
await atomic('candidate-model.json',candidate.model);await atomic('totals-diagnostics.json',diagnostics);await atomic('candidate-state.json',candidate.state);
await atomic('candidate-last-run.json',{status:'completed',checkedAt:new Date().toISOString(),checkpointId:candidate.state.checkpointId,dataAcquisition:args.includes('--fetch')?'requested':args.includes('--use-audited-cache')?'verified-local-cache':'not-requested'});
console.log(JSON.stringify({...candidate.state,archive,notice:'候选已构建；正式模型未变。网页不会自动重训。'},null,2));
}catch(error){
 const runFile=path.join(root,'js/data/prediction/candidate-last-run.json'),temp=runFile+'.tmp';
 await fs.writeFile(temp,JSON.stringify({status:'failed',checkedAt:new Date().toISOString(),message:error.message,cause:error.cause?.code||null,previousCandidateRetained:true,officialModelChanged:false},null,2)+'\n');await fs.rename(temp,runFile);
 console.error('候选更新失败，保留上次通过校验的候选及正式模型：'+error.message);process.exitCode=1;
}
