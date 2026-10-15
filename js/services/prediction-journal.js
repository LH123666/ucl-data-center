/* Local, append-only forecast evidence. Device timestamps are not independent certification. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.UclPredictionJournal=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const VERSION='forecast-journal-1.0',KEY='ucl:forecast-journal:v1',MAX_RECORDS=500,MAX_RESULTS=2000;
  const copy=x=>JSON.parse(JSON.stringify(x));
  const freeze=x=>{if(x&&typeof x==='object'){Object.values(x).forEach(freeze);Object.freeze(x);}return x;};
  const fail=message=>{throw new Error(message);};
  const iso=x=>typeof x==='string'&&/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(x)&&Number.isFinite(Date.parse(x));
  const day=x=>typeof x==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(x)&&Number.isFinite(Date.parse(x+'T00:00:00Z'))&&new Date(x+'T00:00:00Z').toISOString().slice(0,10)===x;
  const beijing=x=>new Date(Date.parse(x)+8*3600000).toISOString().slice(0,10);
  const fixtureKey=f=>[f.season,f.date,f.home,f.away].join('|');
  const outcome=(h,a)=>h>a?'home':h<a?'away':'draw';
  const sum=values=>values.reduce((a,b)=>a+b,0);
  const prob=x=>typeof x==='number'&&Number.isFinite(x)&&x>=0&&x<=1;
  function fixture(f){
    if(f?.stage&&f.stage!=='league')fail('当前档案只支持联赛阶段90分钟比赛');
    if(!f||!/^20\d{2}-\d{2}$/.test(f.season)||+f.season.slice(5)!==(+f.season.slice(0,4)+1)%100||!day(f.date)||!iso(f.kickoff))fail('需要有效赛季、比赛日期和带时区的精确开球时间');
    if(f.date!==beijing(f.kickoff)||f.date<f.season.slice(0,4)+'-07-01'||f.date>String(+f.season.slice(0,4)+1)+'-06-30')fail('比赛日期与北京时间或赛季范围不一致');
    if(![f.home,f.away].every(x=>typeof x==='string'&&x.trim()&&x.length<=120)||f.home===f.away)fail('必须指定两个不同球队身份');
    return {season:f.season,date:f.date,home:f.home,away:f.away,kickoff:new Date(f.kickoff).toISOString(),stage:'league'};
  }
  function distribution(prediction){
    const p=prediction;if(!p||!['score-poisson-1.0','opponent-poisson-0.1'].includes(p.version))fail('不支持的预测模型版本');
    if(![p.rates?.home,p.rates?.away].every(x=>Number.isFinite(x)&&x>=.15&&x<=5))fail('进球率无效');
    const poisson=lambda=>{const a=[Math.exp(-lambda)];for(let i=1;i<=20;i++)a.push(a[i-1]*lambda/i);const mass=sum(a);return a.map(v=>v/mass);};
    const hp=poisson(p.rates.home),ap=poisson(p.rates.away),matrix=hp.map(h=>ap.map(a=>h*a)),result={home:0,draw:0,away:0},totals=Array(7).fill(0);
    let btts=0;matrix.forEach((row,h)=>row.forEach((q,a)=>{result[outcome(h,a)]+=q;totals[Math.min(h+a,6)]+=q;if(h&&a)btts+=q;}));
    if(!['home','draw','away'].every(k=>prob(p.result?.[k])&&Math.abs(p.result[k]-result[k])<1e-8)||!Array.isArray(p.totals)||p.totals.length!==7||!p.totals.every((v,i)=>prob(v)&&Math.abs(v-totals[i])<1e-8))fail('比分分布、胜平负或总进球概率不一致');
    return {matrix,result,totals,markets:{over25:sum(totals.slice(3)),over35:sum(totals.slice(4)),btts}};
  }
  const bucket=hours=>hours>=24?'24h-plus':hours>=1?'1h-24h':'under-1h';
  function createSnapshot(input,{now=new Date().toISOString(),imported=false}={}){
    if(!iso(now)||!iso(input?.generatedAt))fail('生成时间无效');
    const f=fixture(input.fixture),p=input.prediction,dist=distribution(p),created=Date.parse(input.generatedAt),clock=Date.parse(now),frozen=imported?Date.parse(input.frozenAt||now):clock;
    if(created>clock||created>=Date.parse(f.kickoff)||!Number.isFinite(frozen)||frozen<created||frozen>clock||frozen>=Date.parse(f.kickoff))fail('只能冻结尚未开球的预测，未来生成时间无效');
    if(!day(p.cutoffDate)||p.cutoffDate>beijing(input.generatedAt)||p.cutoffDate>f.date||p.lastDate&&(!day(p.lastDate)||p.lastDate>=p.cutoffDate))fail('训练截止时间或最新赛果存在未来数据泄漏');
    if(!Number.isInteger(p.trainingGames)||p.trainingGames<1)fail('训练样本数量无效');
    if(typeof input.id!=='string'||!input.id.trim()||input.id.length>160||typeof input.model?.checkpointId!=='string'||!input.model.checkpointId||input.model.checkpointId.length>180)fail('缺少快照ID或模型检查点');
    if(!['unknown','expected','confirmed'].includes(input.lineupStatus))fail('阵容状态无效');
    if(!['official','candidate'].includes(input.model.kind))fail('模型类型无效');
    if(input.model.version!==p.version)fail('模型元数据版本不一致');
    if(input.model.kind==='candidate'&&p.version!=='opponent-poisson-0.1'||input.model.kind==='official'&&p.version!=='score-poisson-1.0')fail('模型类型与版本不一致');
    const hours=(Date.parse(f.kickoff)-frozen)/3600000;
    return freeze({id:input.id,fixture:f,generatedAt:new Date(created).toISOString(),frozenAt:new Date(frozen).toISOString(),leadHours:hours,leadBucket:bucket(hours),lineupStatus:input.lineupStatus,
      prediction:copy(p),distribution:dist,model:copy(input.model),inputState:copy(input.inputState||{}),
      provenance:imported?'imported-unverified':'local-device-clock',independentlyCertified:false,evaluationEligible:!imported,
      scope:'90-minute league-phase results only; no extra time or penalties'});
  }
  function createResult(input,{now=new Date().toISOString(),imported=false}={}){
    const f=fixture(input?.fixture);
    if(!iso(now)||!iso(input.observedAt)||Date.parse(input.observedAt)>Date.parse(now)||Date.parse(input.observedAt)<=Date.parse(f.kickoff))fail('赛果观察时间必须在开球后且不在未来');
    if(input.status!=='full-time'||!Array.isArray(input.goals)||input.goals.length!==2||!input.goals.every(n=>Number.isInteger(n)&&n>=0&&n<=20))fail('只接受90分钟已结束且有效的比分');
    if(typeof input.id!=='string'||!input.id||input.id.length>180||input.source!=='espn-observed'||!/^https:\/\/site\.api\.espn\.com\//.test(input.sourceUrl||''))fail('赛果必须提供支持的在线来源及ID');
    return freeze({id:input.id,fixture:f,goals:[...input.goals],status:'full-time',observedAt:new Date(input.observedAt).toISOString(),source:input.source,sourceUrl:input.sourceUrl,
      provenance:imported?'imported-unverified':'observed-feed',evaluationEligible:!imported});
  }
  const empty=()=>({version:VERSION,records:[],results:[]});
  function read(raw){
    if(raw===null||raw===undefined||raw==='')return empty();
    if(typeof raw!=='string'||raw.length>6000000)fail('预测档案超过6MB或格式无效，未覆盖原数据');
    const data=JSON.parse(raw);
    if(data.version!==VERSION||!Array.isArray(data.records)||!Array.isArray(data.results)||data.records.length>MAX_RECORDS||data.results.length>MAX_RESULTS)fail('预测档案版本或容量无效');
    const ids=new Set();
    for(const r of data.records){if(ids.has('p:'+r.id))fail('预测快照ID重复');ids.add('p:'+r.id);const check=createSnapshot(r,{now:r.frozenAt,imported:r.provenance==='imported-unverified'});if(JSON.stringify(check)!==JSON.stringify(r))fail('预测快照内容被修改或校验不一致');}
    for(const r of data.results){if(ids.has('r:'+r.id))fail('赛果证据ID重复');ids.add('r:'+r.id);const check=createResult(r,{now:r.observedAt,imported:r.provenance==='imported-unverified'});if(JSON.stringify(check)!==JSON.stringify(r))fail('赛果证据内容被修改或校验不一致');}
    return copy(data);
  }
  function append(data,record,type='records'){
    if(!['records','results'].includes(type))fail('未知记录类型');
    const existing=data[type].find(r=>r.id===record.id);if(existing){if(JSON.stringify(existing)!==JSON.stringify(record))fail('相同ID内容冲突，拒绝覆盖');return copy(data);}
    if(data[type].length>=(type==='records'?MAX_RECORDS:MAX_RESULTS))fail('本机预测档案已满，请导出备份；不自动删除旧数据');
    return {...copy(data),[type]:[...copy(data[type]),copy(record)]};
  }
  function importBackup(data,payload,{now=new Date().toISOString()}={}){
    if(payload?.version!==VERSION||!Array.isArray(payload.records)||!Array.isArray(payload.results))fail('备份格式无效');
    if(payload.records.length>MAX_RECORDS||payload.results.length>MAX_RESULTS)fail('备份超出容量');
    let merged=copy(data);const seen=new Set();
    for(const [type,rows] of [['records',payload.records],['results',payload.results]])for(const raw of rows){
      const key=type+':'+raw.id;if(seen.has(key))fail('备份含重复ID');seen.add(key);
      if(merged[type].some(r=>r.id===raw.id))fail('备份ID与本机冲突，整批未导入');
      const clean=type==='records'?createSnapshot(raw,{now,imported:true}):createResult(raw,{now,imported:true});merged=append(merged,clean,type);
    }
    return merged;
  }
  function selectResults(data){
    const grouped=new Map();for(const r of data.results.filter(r=>r.evaluationEligible)){const key=fixtureKey(r.fixture);if(!grouped.has(key))grouped.set(key,[]);grouped.get(key).push(r);}
    const out=new Map();for(const [key,rows] of grouped){rows.sort((a,b)=>b.observedAt.localeCompare(a.observedAt));const newest=rows.filter(r=>r.observedAt===rows[0].observedAt);out.set(key,{latest:rows[0],conflict:new Set(newest.map(r=>r.goals.join('-'))).size>1,revisions:new Set(rows.map(r=>r.goals.join('-'))).size});}return out;
  }
  const loss=(p,y)=>-(y*Math.log(Math.max(1e-12,p))+(1-y)*Math.log(Math.max(1e-12,1-p)));
  function scoreRecord(record,result){
    const [h,a]=result.goals,d=record.distribution,actual=outcome(h,a),markets={over25:Number(h+a>=3),over35:Number(h+a>=4),btts:Number(h>0&&a>0)};
    return {id:record.id,fixture:record.fixture,model:record.model,leadBucket:record.leadBucket,lineupStatus:record.lineupStatus,h,a,total:h+a,
      predictedTotal:record.prediction.rates.home+record.prediction.rates.away,resultProbabilities:d.result,totals:d.totals,marketProbabilities:d.markets,
      logLoss:-Math.log(Math.max(1e-12,d.result[actual])),brier:sum(['home','draw','away'].map(k=>(d.result[k]-Number(k===actual))**2)),
      correct:Number(['home','draw','away'].reduce((best,k)=>d.result[k]>d.result[best]?k:best,'home')===actual),
      scoreLogLoss:-Math.log(Math.max(1e-12,d.matrix[h][a])),markets:Object.fromEntries(Object.entries(markets).map(([k,y])=>[k,{actual:y,logLoss:loss(d.markets[k],y),brier:(d.markets[k]-y)**2}]))};
  }
  function evaluate(data){
    const results=selectResults(data),chosen=new Map(),pending=[],excluded=[];
    for(const r of data.records){
      if(!r.evaluationEligible){excluded.push({id:r.id,reason:'imported-unverified'});continue;}
      const evidence=results.get(fixtureKey(r.fixture));
      if(!evidence){pending.push({id:r.id,reason:'no-observed-final-result'});continue;}
      if(evidence.conflict||evidence.latest.fixture.kickoff!==r.fixture.kickoff){pending.push({id:r.id,reason:evidence.conflict?'conflicting-result':'kickoff-changed'});continue;}
      const key=[fixtureKey(r.fixture),r.model.kind,r.prediction.version,r.leadBucket].join('|');
      const old=chosen.get(key);if(!old||r.frozenAt<old.frozenAt||r.frozenAt===old.frozenAt&&r.id<old.id){if(old)excluded.push({id:old.id,reason:'duplicate-match-model-time-bucket'});chosen.set(key,r);}else excluded.push({id:r.id,reason:'duplicate-match-model-time-bucket'});
    }
    const scored=[...chosen.values()].map(r=>{const e=results.get(fixtureKey(r.fixture));return {...scoreRecord(r,e.latest),resultRevisions:e.revisions,source:e.latest.source,observedAt:e.latest.observedAt};});
    const groups=new Map();for(const s of scored){const key=[s.model.kind,s.model.version,s.leadBucket].join('|');if(!groups.has(key))groups.set(key,[]);groups.get(key).push(s);}
    return {scored,pending,excluded,groups:[...groups].map(([key,rows])=>({key,model:rows[0].model.kind,version:rows[0].model.version,leadBucket:rows[0].leadBucket,...summarize(rows)})),
      caveat:'Local device clock, no external timestamp certification. Imported forecasts/results excluded. Earliest snapshot per match/model/time bucket only. Results may be corrected.'};
  }
  function summarize(rows){
    const n=rows.length;if(!n)return {matches:0,logLoss:null,brier:null,accuracy:null,scoreLogLoss:null,markets:{}};
    const avg=fn=>sum(rows.map(fn))/n;
    return {matches:n,logLoss:avg(r=>r.logLoss),brier:avg(r=>r.brier),accuracy:avg(r=>r.correct),scoreLogLoss:avg(r=>r.scoreLogLoss),
      markets:Object.fromEntries(['over25','over35','btts'].map(k=>[k,{logLoss:avg(r=>r.markets[k].logLoss),brier:avg(r=>r.markets[k].brier),predicted:avg(r=>r.marketProbabilities[k]),observed:avg(r=>r.markets[k].actual)}]))};
  }
  function diagnostics(rows){
    const groups=[['0–1球',r=>r.total<=1],['2–3球',r=>r.total>=2&&r.total<=3],['4球及以上',r=>r.total>=4],['平局',r=>r.h===r.a]];
    return {matches:rows.length,summary:summarize(rows),segments:groups.map(([label,test])=>{const selected=rows.filter(test);return {label,...summarize(selected),meanPredictedGoals:selected.length?sum(selected.map(r=>r.predictedTotal))/selected.length:null,meanActualGoals:selected.length?sum(selected.map(r=>r.total))/selected.length:null};}),
      bins:Object.fromEntries(['over25','over35','btts'].map(k=>[k,Array.from({length:5},(_,i)=>{const selected=rows.filter(r=>Math.min(4,Math.floor(r.marketProbabilities[k]*5))===i);return {lower:i/5,upper:(i+1)/5,count:selected.length,predicted:selected.length?sum(selected.map(r=>r.marketProbabilities[k]))/selected.length:null,observed:selected.length?sum(selected.map(r=>r.markets[k].actual))/selected.length:null};})])),
      interpretation:'Outcome-conditioned segments are diagnostic, not a pre-match selection rule or causal proof. Small samples have high uncertainty.'};
  }
  return {VERSION,KEY,MAX_RECORDS,MAX_RESULTS,empty,read,append,importBackup,createSnapshot,createResult,distribution,fixtureKey,evaluate,scoreRecord,summarize,diagnostics};
});
