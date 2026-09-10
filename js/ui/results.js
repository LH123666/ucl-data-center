// Results use the selected season's schedule; dates alone never assign a round.
window.uclResultsExpanded=false;
window.uclResultStage=slug=>slug==='league-phase'?'league':/knockout|round-of|quarter|semi|final/.test(slug||'')&&!/qualif/.test(slug||'')?'knockout':'qualifying';
window.uclResultGroups=function(rows){
  const schedule=typeof uclLeaguePhaseSchedule==='undefined'?[]:uclLeaguePhaseSchedule;
  const pair=(home,away)=>[canonicalTeamName(home),canonicalTeamName(away)].sort().join('|');
  const rounds=new Map(schedule.map((row,index)=>[pair(row[1],row[2]),Math.floor(index/18)+1]));
  const knockout=typeof uclArchiveKnockoutMatches==='undefined'?[]:uclArchiveKnockoutMatches;
  const labels={playoff:'淘汰赛附加赛',round16:'十六强',quarterfinal:'四分之一决赛',semifinal:'半决赛',final:'决赛'};
  const all=rows.filter(row=>['league','knockout'].includes(row[5])&&/^\d+[-–]\d+$/.test(row[3])).slice().sort((a,b)=>b[0].localeCompare(a[0]));
  const title=row=>{
    if(row[5]==='league'){const n=rounds.get(pair(row[1],row[2]));return n?`联赛阶段 · 第${n}轮`:'联赛阶段 · 轮次待确认'}
    const found=knockout.find(m=>m.date===row[0]&&pair(m.home,m.away)===pair(row[1],row[2]));
    return labels[found?.round||row[6]]||'淘汰赛 · 轮次待确认';
  };
  const totals=new Map();
  all.forEach(row=>{const name=title(row);if(!totals.has(name))totals.set(name,[]);totals.get(name).push(row)});
  const groups=new Map();
  (window.uclResultsExpanded?all:all.slice(0,8)).forEach(row=>{
    const name=title(row);if(!groups.has(name))groups.set(name,{title:name,all:totals.get(name),dates:new Map(),count:0});
    const group=groups.get(name);if(!group.dates.has(row[0]))group.dates.set(row[0],[]);
    group.dates.get(row[0]).push(row);group.count++;
  });
  return {all,groups:[...groups.values()]};
};

// Run after individual button handlers, including dynamically added navigation.
document.querySelector('nav').addEventListener('click',event=>{
  const button=event.target.closest('button');if(!button)return;
  const id=button.id||'standings';
  document.querySelectorAll('nav button').forEach(item=>item.classList.toggle('active',item===button));
  for(const selector of ['.hero','#leaguePhaseHub','.layout']){
    const node=document.querySelector(selector);if(node)node.style.display=id==='standings'?(selector==='.hero'?'flex':selector==='.layout'?'grid':''):'none';
  }
  document.querySelector('#latest').style.display=id==='latestBtn'?'block':'none';
  for(const [key,selector] of Object.entries({infoBtn:'#competitionInfo',qualificationBtn:'#qualificationPage',advancementBtn:'#advancementPage',scheduleBtn:'#schedulePage'}))document.querySelector(selector)?.classList.toggle('active',id===key);
  window.syncUclAdvanceView?.();
  window.scrollTo({top:0,behavior:'smooth'});
});
