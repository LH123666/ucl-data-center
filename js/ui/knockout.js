(function(){
  const page=document.querySelector('#advancementPage');
  if(!page||typeof uclKnockoutRoutes==='undefined')return;
  const esc=value=>String(value??'').replace(/[&<>'"]/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));
  const hero=page.querySelector('.advance-hero');
  const existing=[...page.children].filter(child=>child!==hero);
  const qualificationView=document.createElement('div');
  qualificationView.className='qualification-advance-view';
  qualificationView.id='qualificationAdvanceView';
  existing.forEach(child=>qualificationView.appendChild(child));
  const tabs=document.createElement('div');
  tabs.className='advance-view-tabs';
  tabs.setAttribute('role','tablist');
  tabs.innerHTML='<button class="active" type="button" role="tab" aria-selected="true" data-advance-view="qualification">资格赛晋级图</button><button type="button" role="tab" aria-selected="false" data-advance-view="knockout">正赛晋级图</button>';
  const view=document.createElement('section');
  view.id='knockoutAdvanceView';
  view.className='knockout-view';
  view.innerHTML=`
    <section class="knockout-intro"><div><p class="eyebrow">LEAGUE PHASE · KNOCKOUT ROUTE</p><h2>正赛阶段晋级图</h2><p>根据联赛阶段实时排名展示四条潜在签位路线。点击任意球队可高亮它从当前排名通往淘汰赛的路径；抽签与比赛产生后，下方自动接入实际赛程和单场事件。</p></div><div class="knockout-state"><b id="koStateTitle">正在计算当前路线</b><span id="koStateMeta">排名变化时自动重排</span></div></section>
    <p class="knockout-explainer">本图在联赛阶段结束前属于<strong>实时排名推演</strong>，并非正式抽签。官方规则：1–8名直通十六强；9–24名参加两回合附加赛；四组路线依次关联 1/2、3/4、5/6、7/8 名。</p>
    <div class="knockout-route-grid" id="koRouteGrid"></div>
    <div class="ko-selection empty" id="koSelection">选择一支球队，查看它的晋级路线</div>
    <div class="ko-road" aria-label="淘汰赛总晋级流程">${uclKnockoutMilestones.map((item,index)=>`${index?'<i aria-hidden="true">→</i>':''}<article><b>${[16,16,8,4,2][index]}</b><span>${item.label}</span><small>${item.dates}</small></article>`).join('')}</div>
    <section class="ko-live"><header><div><h3>单场走势时间线</h3><span id="koLiveStatus">淘汰赛尚未开始</span></div><button class="ko-refresh" id="koRefresh" type="button">↻ 刷新淘汰赛数据</button></header><div class="ko-live-body" id="koLiveBody"><div class="ko-empty"><b>等待淘汰赛开赛</b><span>比赛开始后，这里将显示进球、红黄牌等关键事件及实时比分。</span></div></div></section>
    <footer class="ko-sources"><span>路线结构依据UEFA 2026/27赛事规程；实时比赛由本站Cloudflare接口转接ESPN Scoreboard。</span><a href="https://documents.uefa.com/r/Regulations-of-the-UEFA-Champions-League-2026/27-Online" target="_blank" rel="noopener">UEFA赛事规程 ↗</a></footer>`;
  const leagueView=document.createElement('section');leagueView.id='leagueStatisticsView';leagueView.hidden=true;
  tabs.firstElementChild.insertAdjacentHTML('afterend','<button type="button" role="tab" aria-selected="false" data-advance-view="league">联赛阶段统计</button>');
  hero.after(tabs,qualificationView,leagueView,view);
  if(!window.uclSeason.current){
    view.querySelector('.ko-sources span').textContent=window.uclSeason.label+'赛季归档；上方为联赛最终排名签位池，下方为实际淘汰赛赛果。未收录的事件不作推断。';
    view.querySelector('.ko-sources a').href='https://www.uefa.com/uefachampionsleague/history/';
    view.querySelector('.knockout-intro p:not(.eyebrow)').textContent='上方展示联赛最终排名对应的签位池；下方按轮次列出本赛季实际淘汰赛赛果。';
    view.querySelector('.knockout-explainer').textContent='1–8名直通十六强；9–24名参加淘汰赛附加赛。签位池表示抽签规则，不等同于实际对阵。';
  }

  let selectedTeam='',loading=false,liveMatches=[];
  const rankTeam=rank=>teams[rank-1]?.[1]||'';
  const phaseComplete=()=>teams.length===36&&teams.every(team=>Number(team[3])>=8);
  const teamButton=rank=>{const team=rankTeam(rank);if(!team)return `<button class="ko-club" type="button" disabled><span class="club-logo club-logo-knockout"><span>?</span></span><span><strong>排名待定</strong><small>第${rank}名</small></span></button>`;return `<button class="ko-club" type="button" data-team="${esc(team)}"><span>${teamLogoMarkup(team,'knockout')}</span><span><strong>${esc(teamChineseName(team))}</strong><small>第${rank}名 · ${esc(team)}</small></span></button>`};
  const groupTeams=route=>[...route.direct,...route.seeded,...route.unseeded].map(rankTeam).filter(Boolean);
  function renderRoutes(){
    document.querySelector('#koRouteGrid').innerHTML=uclKnockoutRoutes.map(route=>`<article class="ko-route" data-route="${route.id}"><header><b>路线 ${route.label}</b><span>十六强签位组</span></header><div class="ko-stage"><span>直通十六强候选</span><div class="ko-club-list">${route.direct.map(teamButton).join('')}</div><small>联赛阶段第 ${route.direct.join(' / ')} 名</small></div><div class="ko-stage"><span>淘汰赛附加赛候选池</span><div class="ko-playoff"><div class="ko-club-list">${route.seeded.map(teamButton).join('')}</div><i>VS</i><div class="ko-club-list">${route.unseeded.map(teamButton).join('')}</div></div><small>种子 ${route.seeded.join('/')} 名 · 非种子 ${route.unseeded.join('/')} 名</small></div><div class="ko-destination"><b>附加赛胜者 → 十六强</b><span>再与本路线直通球队完成抽签定位</span></div></article>`).join('');
    view.querySelectorAll('.ko-club[data-team]').forEach(button=>button.addEventListener('click',()=>selectTeam(button.dataset.team)));
    const complete=phaseComplete(),played=teams.reduce((sum,team)=>sum+Number(team[3]||0),0)/2;
    document.querySelector('#koStateTitle').textContent=complete?'联赛阶段最终排名路线':'实时排名推演 · 非正式抽签';
    document.querySelector('#koStateMeta').textContent=`已计入 ${played} / 144 场联赛阶段比赛`;
    if(selectedTeam&&teams.some(team=>team[1]===selectedTeam))selectTeam(selectedTeam);
  }
  function selectTeam(team){
    selectedTeam=team;
    const rank=teams.findIndex(row=>row[1]===team)+1;
    const route=uclKnockoutRoutes.find(item=>[...item.direct,...item.seeded,...item.unseeded].includes(rank));
    view.querySelectorAll('.ko-route').forEach(card=>{card.classList.toggle('selected',Boolean(route)&&card.dataset.route===route.id);card.classList.toggle('muted',Boolean(route)&&card.dataset.route!==route.id)});
    view.querySelectorAll('.ko-club[data-team]').forEach(button=>button.classList.toggle('active',button.dataset.team===team));
    const info=leagueTeamInfo(team),selection=document.querySelector('#koSelection');
    let message='当前处于淘汰区（第25–36名），联赛阶段结束时将直接淘汰。';
    if(rank<=8)message=`当前直通十六强，进入路线 ${route?.label||'—'} 的种子签位候选。`;
    else if(rank<=16)message=`当前进入淘汰赛附加赛种子区，属于路线 ${route?.label||'—'}，原则上次回合主场。`;
    else if(rank<=24)message=`当前进入淘汰赛附加赛非种子区，属于路线 ${route?.label||'—'}。`;
    selection.classList.remove('empty');
    selection.innerHTML=`<div class="ko-selection-content">${teamLogoMarkup(team,'hero')}<div><h3>${esc(teamChineseName(team))} <small>${esc(team)}</small></h3><p>实时第 ${rank} 名 · 第 ${info?.pot||'—'} 档。${message}${phaseComplete()?'':' 当前联赛阶段尚未结束，路线会随积分榜变化。'}</p></div></div>`;
  }
  const roundLabel=key=>uclKnockoutMilestones.find(item=>item.key===key)?.label||'淘汰赛';
  function renderTimeline(match){
    const events=Array.isArray(match.timeline)?match.timeline:[];
    const fallback=match.completed?[{clock:'FT',text:`比赛结束：${teamChineseName(match.home)} ${match.homeScore}–${match.awayScore} ${teamChineseName(match.away)}`}]:[{clock:'—',text:match.inProgress?'比赛进行中，等待关键事件':'比赛尚未开始'}];
    const list=events.length?events:fallback;
    const body=document.querySelector('#koLiveBody');
    body.querySelectorAll('.ko-match').forEach(button=>button.classList.toggle('active',button.dataset.id===String(match.id)));
    body.querySelector('.ko-timeline')?.remove();
    body.insertAdjacentHTML('beforeend',`<div class="ko-timeline">${list.map(event=>`<div class="ko-event"><time>${esc(event.clock||'—')}</time><span>${esc(event.text||event.type||'关键事件')}</span></div>`).join('')}</div>`);
  }
  function renderLive(matches){
    liveMatches=matches;
    const body=document.querySelector('#koLiveBody'),status=document.querySelector('#koLiveStatus');
    if(!matches.length){status.textContent='当前尚无淘汰赛比赛数据';body.innerHTML='<div class="ko-empty"><b>等待淘汰赛赛程与赛果</b><span>接口已就绪；正式对阵进入官方数据源后会自动显示，无需手工改页面。</span></div>';return}
    status.textContent=`已同步 ${matches.length} 场淘汰赛 · ${new Date().toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit'})}`;
    body.innerHTML=`<div class="ko-match-list">${matches.map(match=>`<button class="ko-match" type="button" data-id="${esc(match.id)}"><time>${esc(match.date)} · ${esc(roundLabel(match.round))}</time><strong>${esc(teamChineseName(match.home))} <b>${match.completed||match.inProgress?`${match.homeScore}–${match.awayScore}`:'VS'}</b> ${esc(teamChineseName(match.away))}</strong><small>${esc(match.status||'时间待定')}</small></button>`).join('')}</div>`;
    body.querySelectorAll('.ko-match').forEach(button=>button.addEventListener('click',()=>renderTimeline(matches.find(match=>String(match.id)===button.dataset.id))));
    renderTimeline(matches[0]);
  }
  async function refreshKnockout(){
    if(!window.uclSeason.current){renderRoutes();renderLive(uclArchiveKnockoutMatches);document.querySelector('#koLiveStatus').textContent=`${window.uclSeason.label} · ${uclArchiveKnockoutMatches.length} 场淘汰赛归档`;document.querySelector('#koRefresh').textContent='↻ 重新载入归档';return}
    renderRoutes();if(loading)return;loading=true;
    const button=document.querySelector('#koRefresh');button.disabled=true;button.textContent='↻ 更新中';
    const url=location.protocol==='file:'?'https://ucl-data-center.pages.dev/api/ucl-knockout-live':'/api/ucl-knockout-live';
    try{const response=await fetch(url,{cache:'no-cache'});if(!response.ok)throw new Error(`HTTP ${response.status}`);const data=await response.json();renderLive(Array.isArray(data.matches)?data.matches:[])}
    catch(error){document.querySelector('#koLiveStatus').textContent='实时接口暂不可用';if(!liveMatches.length)document.querySelector('#koLiveBody').innerHTML='<div class="ko-empty"><b>暂时无法连接比赛数据源</b><span>主晋级路线仍按当前积分榜正常显示，稍后可点击刷新重试。</span></div>'}
    finally{loading=false;button.disabled=false;button.textContent='↻ 刷新淘汰赛数据'}
  }
  window.refreshKnockoutView=refreshKnockout;
  const originalHero={title:hero.querySelector('h1').innerHTML,description:hero.querySelector('div>p:not(.eyebrow)').textContent,eyebrow:hero.querySelector('.eyebrow').textContent};
  let selectedView='qualification';try{selectedView=sessionStorage.getItem('ucl-advance-view')||selectedView}catch{}
  if(!['qualification','league','knockout'].includes(selectedView))selectedView='qualification';
  window.syncUclAdvanceView=()=>{
    qualificationView.hidden=selectedView!=='qualification';leagueView.hidden=selectedView!=='league';view.classList.toggle('active',selectedView==='knockout');
    const hub=document.querySelector('#leaguePhaseHub');if(hub)hub.style.removeProperty('display');
  };
  tabs.querySelectorAll('button').forEach(button=>button.addEventListener('click',()=>{
    selectedView=button.dataset.advanceView;const knockout=selectedView==='knockout';
    try{sessionStorage.setItem('ucl-advance-view',selectedView)}catch{}
    tabs.querySelectorAll('button').forEach(item=>{const active=item===button;item.classList.toggle('active',active);item.setAttribute('aria-selected',String(active))});
    window.syncUclAdvanceView();
    hero.querySelector('h1').innerHTML=selectedView==='qualification'?originalHero.title:selectedView==='league'?'欧冠联赛阶段<br><span>数据与统计</span>':'欧冠正赛<br><span>晋级图</span>';
    hero.querySelector('div>p:not(.eyebrow)').textContent=selectedView==='qualification'?originalHero.description:selectedView==='league'?'逐轮比较进球、赛果分布与冷门，查看36队的8轮比赛全景。':'从联赛阶段最终排名到淘汰赛，查看晋级路线和实际对阵。';
    hero.querySelector('.eyebrow').textContent=selectedView==='qualification'?originalHero.eyebrow:`${window.uclSeason.label} · ${selectedView==='league'?'LEAGUE STATISTICS':'KNOCKOUT ROUTE'}`;
    hero.querySelector('.advance-live').hidden=selectedView!=='qualification';
    if(knockout){renderRoutes();refreshKnockout()}
  }));
  tabs.querySelector(`[data-advance-view="${selectedView}"]`).click();
  renderRoutes();
})();
