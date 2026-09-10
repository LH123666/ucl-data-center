(function(){
  document.head.insertAdjacentHTML('beforeend','<link rel="stylesheet" href="css/league-phase.css">');
  const currentMatchdays=[
    {n:1,label:'9月8–10日',start:'2026-09-08',end:'2026-09-10'},
    {n:2,label:'10月13/14日',start:'2026-10-13',end:'2026-10-14'},
    {n:3,label:'10月20/21日',start:'2026-10-20',end:'2026-10-21'},
    {n:4,label:'11月3/4日',start:'2026-11-03',end:'2026-11-04'},
    {n:5,label:'11月24/25日',start:'2026-11-24',end:'2026-11-25'},
    {n:6,label:'12月8/9日',start:'2026-12-08',end:'2026-12-09'},
    {n:7,label:'1月19/20日',start:'2027-01-19',end:'2027-01-20'},
    {n:8,label:'1月27日',start:'2027-01-27',end:'2027-01-28'}
  ];
  const archiveDates=[...new Set((typeof uclLeaguePhaseSchedule==='undefined'?[]:uclLeaguePhaseSchedule).map(row=>row[0]))].sort();
  const archiveGroups=[];archiveDates.forEach(date=>{const last=archiveGroups.at(-1);if(!last||new Date(date)-new Date(last.at(-1))>4*86400000)archiveGroups.push([date]);else last.push(date)});
  const matchdays=window.uclSeason.current?currentMatchdays:archiveGroups.map((dates,index)=>({n:index+1,start:dates[0],end:dates.at(-1),label:dates[0].slice(5)+(dates.length>1?'–'+dates.at(-1).slice(5):'')}));
  const dayFor=date=>matchdays.find(day=>date>=day.start&&date<=day.end)?.n||0;
  const safe=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const feed=()=>window.getUclLeaguePhaseFeed?.()||{upcoming:[],live:[]};
  const eventKey=(date,home,away)=>[canonicalTeamName(home),canonicalTeamName(away)].sort().join('|');
  const staticSchedule=typeof uclLeaguePhaseSchedule==='undefined'?[]:uclLeaguePhaseSchedule;
  const staticRounds=new Map(staticSchedule.map(([date,home,away])=>[eventKey(date,home,away),dayFor(date)]));
  const roundFor=(date,home,away)=>staticRounds.get(eventKey(date,home,away))||dayFor(date);
  const events=()=>{
    const map=new Map();
    staticSchedule.forEach(([date,home,away])=>map.set(eventKey(date,home,away),{date,home,away,time:'',source:'static',state:'upcoming',round:dayFor(date)}));
    matches.filter(match=>match[5]==='league').forEach(match=>map.set(eventKey(match[0],match[1],match[2]),{date:match[0],home:match[1],away:match[2],score:match[3],state:'complete',round:roundFor(match[0],match[1],match[2])}));
    const liveKeys=new Set();
    feed().live.forEach(item=>{const row={...item,home:canonicalTeamName(item.home),away:canonicalTeamName(item.away),state:'live',round:roundFor(item.date,item.home,item.away)};map.set(eventKey(row.date,row.home,row.away),row);liveKeys.add(eventKey(row.date,row.home,row.away))});
    feed().upcoming.forEach(item=>{const row={...item,home:canonicalTeamName(item.home),away:canonicalTeamName(item.away),state:'upcoming',round:roundFor(item.date,item.home,item.away)};const key=eventKey(row.date,row.home,row.away);if(!liveKeys.has(key)&&map.get(key)?.state!=='complete')map.set(key,row)});
    return [...map.values()].filter(item=>item.round);
  };
  const currentRound=rows=>{
    const live=rows.find(row=>row.state==='live');if(live)return live.round;
    const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
    const active=matchdays.find(day=>today>=day.start&&today<=day.end);if(active)return active.n;
    const next=matchdays.find(day=>today<day.start);return next?.n||8;
  };
  const routeFor=(name,rows=events())=>{
    const canonical=canonicalTeamName(name),route=Array(8).fill(null);
    rows.filter(row=>row.home===canonical||row.away===canonical).forEach(row=>{if(row.round)route[row.round-1]=row});
    const used=new Set(route.filter(Boolean).map(row=>row.home===canonical?row.away:row.home));
    const fallback=(leagueDraw[canonical]||[]).filter(item=>!used.has(item.opponent));
    route.forEach((row,index)=>{if(row||!fallback.length)return;const item=fallback.shift();route[index]={date:'',round:index+1,home:item.venue==='home'?canonical:item.opponent,away:item.venue==='away'?canonical:item.opponent,state:'fallback',time:'轮次待同步'}});
    return route;
  };
  const outcome=(event,team)=>{if(event.state!=='complete'||!event.score)return '';const [home,away]=event.score.split('-').map(Number),mine=event.home===team?home:away,theirs=event.home===team?away:home;return mine>theirs?'win':mine<theirs?'loss':'draw'};
  const matchCell=(event,team)=>{
    if(!event)return '<button class="phase-match empty" type="button" disabled><span>—</span></button>';
    const opponent=event.home===team?event.away:event.home,venue=event.home===team?'主':'客',result=outcome(event,team),label=event.state==='complete'?event.score:event.state==='live'?(event.score||'进行中'):(event.source==='static'?'官方赛程':event.time||event.date.slice(5));
    return `<button class="phase-match ${event.state} ${result}" type="button" data-date="${safe(event.date)}" data-time="${safe(event.time||'')}" data-home="${encodeURIComponent(event.home)}" data-away="${encodeURIComponent(event.away)}" title="${safe(teamChineseName(event.home))} vs ${safe(teamChineseName(event.away))}"><strong><i class="venue">${venue}</i>${safe(teamChineseName(opponent))}</strong><span>${safe(label)}</span></button>`;
  };
  const renderHub=()=>{
    const hub=document.querySelector('#leaguePhaseHub');if(!hub)return;
    const rows=events(),round=currentRound(rows),completed=rows.filter(row=>row.state==='complete').length,live=rows.filter(row=>row.state==='live').length,scheduled=new Set(rows.map(row=>eventKey(row.date,row.home,row.away))).size;
    const counts=Object.fromEntries(matchdays.map(day=>[day.n,rows.filter(row=>row.round===day.n&&row.state==='complete').length]));
    hub.innerHTML=`<section class="phase-pulse"><div class="phase-pulse-head"><div><p class="eyebrow">LEAGUE PHASE · MATCHDAY ${round} / 8</p><h2>联赛阶段<span>脉搏</span></h2></div><div class="phase-pulse-summary"><span><b>${completed}</b>已结束</span><span><b>${live}</b>进行中</span><span><b>${Math.max(0,144-completed-live)}</b>待赛</span></div></div><div class="matchday-rail">${matchdays.map(day=>`<button type="button" class="matchday-node ${counts[day.n]===18?'done':''} ${day.n===round?'current':''}" data-round="${day.n}"><b>MD${day.n}</b><small>${counts[day.n]||0} / 18</small></button>`).join('')}</div></section><section class="phase-matrix-card"><div class="phase-matrix-head"><div><h3>36队 · 8比赛日全景矩阵</h3><p>主客场、比分与状态集中在一张图中；点击比赛可查看详情。</p></div><span>${scheduled>=144?'144场赛程已同步':`已定位 ${scheduled}/144 场 · 其余轮次正在同步`}</span></div><div class="phase-matrix-scroll"><div class="phase-matrix"><div class="phase-matrix-row header"><div>#</div><div>球队</div>${matchdays.map(day=>`<div>MD${day.n}<small>${day.label}</small></div>`).join('')}</div>${teams.map((team,index)=>{const route=routeFor(team[1],rows);return `<div class="phase-matrix-row" data-team="${safe(team[1])}"><div class="phase-rank">${index+1}</div><button class="phase-team" type="button" data-team="${safe(team[1])}">${teamLogoMarkup(team[1],'matrix')}<span><strong>${safe(team[0])}</strong><small>${safe(team[1])}</small></span></button>${route.map(event=>event?.state==='fallback'?'<button class="phase-match empty" type="button" disabled><span>待同步</span></button>':matchCell(event,team[1])).join('')}</div>`}).join('')}</div></div><div class="phase-matrix-legend"><span class="win"><i></i>胜</span><span class="draw"><i></i>平</span><span class="loss"><i></i>负</span><span class="live"><i></i>进行中</span><span><i></i>待赛</span></div></section>`;
    hub.querySelectorAll('.phase-team').forEach(button=>button.onclick=()=>window.openTeam?.(button.dataset.team));
    hub.querySelectorAll('.phase-match:not(.empty)').forEach(button=>button.onclick=()=>window.openFixtureDetail?.(decodeURIComponent(button.dataset.home),decodeURIComponent(button.dataset.away),button.dataset.date,button.dataset.time));
    hub.querySelectorAll('.matchday-node').forEach(button=>button.onclick=()=>{const column=Number(button.dataset.round)+2;hub.querySelector(`.phase-matrix-row:not(.header)>:nth-child(${column})`)?.scrollIntoView({behavior:'smooth',block:'center',inline:'center'})});
  };
  const orbitMarkup=name=>{
    const canonical=canonicalTeamName(name),route=routeFor(canonical),synced=route.filter(item=>item&&item.state!=='fallback').length;
    return `<section class="team-orbit"><header><div><p>LEAGUE PHASE ROUTE</p><h3>8场路线轨道</h3></div><span>${synced}/8 场已定位轮次</span></header><div class="orbit-stage"><div class="orbit-center">${teamLogoMarkup(canonical,'orbit')}<strong>${safe(teamChineseName(canonical))}</strong></div>${route.map((event,index)=>{if(!event)return '';const opponent=event.home===canonical?event.away:event.home,venue=event.home===canonical?'主':'客',label=event.state==='complete'?event.score:event.state==='live'?(event.score||'进行中'):(event.state==='fallback'?'轮次待同步':event.date.slice(5));return `<button type="button" class="orbit-opponent ${event.state}" data-date="${safe(event.date)}" data-time="${safe(event.time||'')}" data-home="${encodeURIComponent(event.home)}" data-away="${encodeURIComponent(event.away)}" ${event.state==='fallback'?'disabled':''}>${teamLogoMarkup(opponent,'orbit-opponent')}<em>${event.state==='fallback'?'—':`MD${index+1}`} · ${venue}</em><b>${safe(teamChineseName(opponent))}</b><small>${safe(label)}</small></button>`}).join('')}</div></section>`;
  };
  const bindOrbit=()=>document.querySelectorAll('.orbit-opponent:not([disabled])').forEach(button=>button.onclick=()=>window.openFixtureDetail?.(decodeURIComponent(button.dataset.home),decodeURIComponent(button.dataset.away),button.dataset.date,button.dataset.time));
  const hub=document.createElement('section');hub.id='leaguePhaseHub';hub.className='league-phase-hub';document.querySelector('.hero')?.insertAdjacentElement('afterend',hub);
  window.leaguePhaseTeamOrbitMarkup=orbitMarkup;window.bindLeaguePhaseOrbit=bindOrbit;window.refreshLeaguePhaseView=renderHub;
  renderHub();
})();
