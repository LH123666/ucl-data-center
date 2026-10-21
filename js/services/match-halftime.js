(function(root){
  'use strict';
  const integer=value=>value!==null&&value!==undefined&&String(value).trim()!==''&&/^\d+$/.test(String(value))?Number(value):null;
  function resolve(competition,home,away){
    const full=[integer(home?.score),integer(away?.score)],missing={score:'—',source:'unverified'};
    if(full.some(n=>n===null))return missing;
    if(full.every(n=>n===0))return {score:'0-0',source:'zero-zero'};
    const halfLine=team=>{
      const lines=team?.linescores;if(!Array.isArray(lines)||lines.length<2)return null;
      const values=lines.map(line=>integer(line.value??line.displayValue));
      if(values.some(n=>n===null)||values.reduce((a,b)=>a+b,0)!==integer(team.score))return null;
      const first=lines.findIndex(line=>Number(line.period)===1);
      if(first<0&&lines.some(line=>line.period!==undefined))return null;
      return values[first<0?0:first];
    };
    const reported=[halfLine(home),halfLine(away)];
    if(reported.every(n=>n!==null)&&reported.every((n,i)=>n<=full[i]))return {score:reported.join('-'),source:'official'};
    const details=(competition?.details||[]).filter(event=>event.scoringPlay),total=[0,0],half=[0,0];
    if(details.length!==full[0]+full[1])return missing;
    for(const event of details){
      // Own-goal team attribution is not consistent across feeds. Do not guess.
      if(event.ownGoal||event.isOwnGoal||/own.?goal/i.test(event.type?.text||event.type?.name||''))return missing;
      const id=String(event.team?.id||''),side=id&&id===String(home?.id||home?.team?.id)?0:id&&id===String(away?.id||away?.team?.id)?1:-1;
      if(side<0)return missing;
      const period=Number(event.period?.number??event.period),clock=event.clock||{};
      let first;
      if(period>=1&&period<=4)first=period===1;
      else if(/^\d+/.test(String(clock.displayValue||'')))first=Number(String(clock.displayValue).match(/^\d+/)[0])<=45;
      else if(Number.isFinite(clock.value)&&clock.value>=0)first=clock.value<=2700;
      else return missing;
      total[side]++;if(first)half[side]++;
    }
    return total.every((n,i)=>n===full[i])?{score:half.join('-'),source:'events'}:missing;
  }
  root.uclHalftime={resolve};
})(typeof window!=='undefined'?window:globalThis);
