(function(){
  document.head.insertAdjacentHTML('beforeend','<link rel="stylesheet" href="css/live-update.css"><link rel="stylesheet" href="css/fixture-detail.css"><link rel="stylesheet" href="css/fixture-table.css"><link rel="stylesheet" href="css/fixture-readable.css"><link rel="stylesheet" href="css/fixture-results.css"><link rel="stylesheet" href="css/fixture-stats.css"><link rel="stylesheet" href="css/fixture-stats-readable.css"><link rel="stylesheet" href="css/modal-standings.css"><link rel="stylesheet" href="css/modal-standings-large.css"><link rel="stylesheet" href="css/fixture-score-status.css"><link rel="stylesheet" href="css/fixture-home-icon.css"><link rel="stylesheet" href="css/fixture-alignment.css"><link rel="stylesheet" href="css/fixture-goal-splits.css"><link rel="stylesheet" href="css/prediction-editor.css"><link rel="stylesheet" href="css/prediction-summary-readable.css"><link rel="stylesheet" href="css/ucl-theme.css">');
  const nav=document.querySelector('nav'),main=document.querySelector('main'),season=document.querySelector('.season');
  const scheduleBtn=document.createElement('button');scheduleBtn.textContent='赛程安排';scheduleBtn.id='scheduleBtn';nav.appendChild(scheduleBtn);
  season.insertAdjacentHTML('beforebegin','<div class="update-wrap"><span class="updated-at" id="updatedAt" aria-live="polite">正在同步官方数据…</span><button class="update-btn" id="updateBtn"><span class="refresh-icon">↻</span><span class="label">更新数据</span></button></div>');
  main.insertAdjacentHTML('beforeend','<section class="schedule-section" id="schedulePage"><div class="section-head"><div><p class="eyebrow">UPCOMING FIXTURES</p><h2>未来赛程</h2></div><span id="fixtureCount">正在获取…</span></div><div class="schedule-grid" id="scheduleGrid"><div class="empty-schedule">正在载入最新赛程…</div></div><div class="data-source-panel"><b>未来赛程数据来源</b><span>欧冠官方赛程与 ESPN Scoreboard API</span><a href="https://site.api.espn.com/apis/site/v2/sports/soccer/uefa.champions/scoreboard?dates=2026&limit=600" target="_blank" rel="noopener">https://site.api.espn.com/apis/site/v2/sports/soccer/uefa.champions/scoreboard?dates=2026&amp;limit=600</a><a href="https://www.uefa.com/uefachampionsleague/fixtures-results/" target="_blank" rel="noopener">https://www.uefa.com/uefachampionsleague/fixtures-results/</a></div></section>');
  document.body.insertAdjacentHTML('beforeend','<div class="data-toast" id="dataToast"></div>');
  document.body.insertAdjacentHTML('beforeend','<aside class="modal-standings" id="modalStandings"></aside>');
  let allUpcoming=rawUpcoming.map(f=>({...f,home:canonicalTeamName(f.home),away:canonicalTeamName(f.away)})),upcoming=[...allUpcoming];
  const predictionStorageKey='ucl36-match-predictions-v1';
  const emptyPrediction=()=>({result:'',halfScore:'',fullScore:'',totalGoals:'',halfFull:'',note:''});
  const loadPredictions=()=>{try{return JSON.parse(localStorage.getItem(predictionStorageKey)||'{}')}catch(e){return {}}};
  const predictions=loadPredictions();
  const fixtureKey=(date,home,away)=>`${date}|${home}|${away}`;
  const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const hasPrediction=p=>p&&Object.values(p).some(value=>String(value??'').trim());
  const resultText={home:'主胜',draw:'平局',away:'客胜'};
  const predictionSummary=f=>{
    const rows=(predictions[fixtureKey(f.date,f.home,f.away)]||[]).filter(hasPrediction);if(!rows.length)return '';
    return `<div class="fixture-predictions"><b>我的预测 <strong>${rows.length}</strong></b>${rows.map((p,i)=>{const parts=[resultText[p.result],p.halfScore&&`半场 ${p.halfScore}`,p.fullScore&&`全场 ${p.fullScore}`,p.totalGoals!==''&&`总进球 ${p.totalGoals}`,p.halfFull&&`半全场 ${p.halfFull}`,p.note&&`备注 ${p.note}`].filter(Boolean);return `<span><i>${i+1}</i><span class="prediction-parts">${parts.map(part=>`<em>${escapeHtml(part)}</em>`).join('')}</span></span>`}).join('')}</div>`;
  };
  const option=(value,label,current)=>`<option value="${value}" ${current===value?'selected':''}>${label}</option>`;
  const predictionRowsHtml=rows=>rows.map((p,i)=>`<div class="prediction-row" data-index="${i}"><b>${i+1}</b><select data-field="result" aria-label="第${i+1}条胜平负">${option('','请选择',p.result)}${option('home','主胜',p.result)}${option('draw','平局',p.result)}${option('away','客胜',p.result)}</select><input data-field="halfScore" value="${escapeHtml(p.halfScore)}" placeholder="如 1-0" aria-label="第${i+1}条半场比分"><input data-field="fullScore" value="${escapeHtml(p.fullScore)}" placeholder="如 2-1" aria-label="第${i+1}条全场比分"><input data-field="totalGoals" value="${escapeHtml(p.totalGoals)}" type="number" min="0" max="30" placeholder="0" aria-label="第${i+1}条总进球数"><select data-field="halfFull" aria-label="第${i+1}条半全场">${option('','请选择',p.halfFull)}${['主/主','主/平','主/客','平/主','平/平','平/客','客/主','客/平','客/客'].map(v=>option(v,v,p.halfFull)).join('')}</select><input data-field="note" value="${escapeHtml(p.note)}" placeholder="可选备注" maxlength="80" aria-label="第${i+1}条备注"><button type="button" class="prediction-remove" data-remove="${i}" aria-label="删除第${i+1}条预测">×</button></div>`).join('');
  const collectPredictionRows=container=>[...container.querySelectorAll('.prediction-row')].map(row=>Object.fromEntries([...row.querySelectorAll('[data-field]')].map(el=>[el.dataset.field,el.value.trim()])));
  const mountPredictionEditor=(container,key,home,away,rows)=>{
    const drafts=rows?.length?rows:[emptyPrediction()];
    container.innerHTML=`<section class="prediction-editor"><div class="prediction-title"><div class="prediction-heading"><p>MY PREDICTIONS</p><div class="prediction-heading-row"><h3>我的比赛预测</h3><div class="prediction-actions"><button type="button" class="prediction-add" ${drafts.length>=5?'disabled':''}>＋ 增加预测</button><button type="button" class="prediction-save">保存预测</button></div></div></div><span>仅保存在当前设备 · 最多5条</span></div><div class="prediction-table"><div class="prediction-columns"><b>#</b><span>胜平负</span><span>半场比分</span><span>全场比分</span><span>总进球</span><span>半全场</span><span>备注</span><span></span></div><div class="prediction-body">${predictionRowsHtml(drafts)}</div></div></section>`;
    container.querySelector('.prediction-add').onclick=()=>{const current=collectPredictionRows(container);if(current.length>=5){toast('最多保存5条预测');return}mountPredictionEditor(container,key,home,away,[...current,emptyPrediction()])};
    container.querySelectorAll('.prediction-remove').forEach(btn=>btn.onclick=()=>{const current=collectPredictionRows(container);current.splice(Number(btn.dataset.remove),1);mountPredictionEditor(container,key,home,away,current.length?current:[emptyPrediction()])});
    container.querySelector('.prediction-save').onclick=()=>{const saved=collectPredictionRows(container).filter(hasPrediction).slice(0,5);if(saved.length)predictions[key]=saved;else delete predictions[key];localStorage.setItem(predictionStorageKey,JSON.stringify(predictions));mountPredictionEditor(container,key,home,away,saved.length?saved:[emptyPrediction()]);renderSchedule();toast(saved.length?`已保存${saved.length}条预测`:'已清空本场预测')};
  };
  const canonical=n=>canonicalTeamName(n);
  const beijingDateTime=value=>{const parts=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date(value)).filter(part=>part.type!=='literal').map(part=>[part.type,part.value]));return {date:`${parts.year}-${parts.month}-${parts.day}`,time:`${parts.hour}:${parts.minute}`}};
  const toast=msg=>{const el=document.querySelector('#dataToast');el.textContent=msg;el.classList.add('show');setTimeout(()=>el.classList.remove('show'),2500)};
  const rankColor=rank=>{const hue=12+(rank-1)*(208/15);return `hsl(${hue} 72% ${rank<5?48:43}%)`};
  const recalc=()=>{
    const stat=new Map(teams.map(t=>[t[1],{p:0,w:0,d:0,l:0,gf:0,ga:0,form:[]}]));
    [...matches].filter(m=>m[5]==='league').reverse().forEach(m=>{const [hg,ag]=m[3].split('-').map(Number),h=stat.get(m[1]),a=stat.get(m[2]);if(!h||!a)return;h.p++;a.p++;h.gf+=hg;h.ga+=ag;a.gf+=ag;a.ga+=hg;const hr=hg>ag?'W':hg===ag?'D':'L',ar=hg<ag?'W':hg===ag?'D':'L';h[hr.toLowerCase()]++;a[ar.toLowerCase()]++;h.form.push(hr);a.form.push(ar)});
    teams.forEach(t=>{const s=stat.get(t[1]);t[3]=s.p;t[4]=s.w;t[5]=s.d;t[6]=s.l;t[7]=s.gf;t[8]=s.ga;t[9]=s.w*3+s.d;t[10]=s.form.slice(-5).join('')});
    teams.sort((a,b)=>b[9]-a[9]||(b[7]-b[8])-(a[7]-a[8])||b[7]-a[7]);render(document.querySelector('#search').value);renderResults();
    document.querySelector('.hero-stat b').textContent=matches.length;
  };
  const renderSchedule=()=>{
    const grid=document.querySelector('#scheduleGrid'),count=document.querySelector('#fixtureCount');
    count.textContent=`${upcoming.length} 场待赛 · 北京时间`;
    if(!upcoming.length){grid.innerHTML='<div class="empty-schedule">UEFA尚未公布联赛阶段完整赛程；公布后点击“更新数据”即可同步。</div>';return}
    const days={};upcoming.forEach(f=>(days[f.date]??=[]).push(f));
    grid.innerHTML=Object.entries(days).slice(0,9).map(([date,fs])=>`<article class="fixture-day"><div class="fixture-date"><span>${date.slice(5).replace('-','月')}日</span><b>${['日','一','二','三','四','五','六'][new Date(date+'T12:00:00').getDay()]}</b></div>${fs.map(f=>`<div class="fixture" data-date="${f.date}" data-time="${f.time}" data-home="${encodeURIComponent(f.home)}" data-away="${encodeURIComponent(f.away)}"><time>${f.time} · 北京时间 · 欧冠</time><div class="fixture-teams"><span>${display(f.home)}</span><i>VS</i><span>${display(f.away)}</span></div>${predictionSummary(f)}<small class="fixture-more">查看比赛详情 →</small></div>`).join('')}</article>`).join('');
    grid.querySelectorAll('.fixture').forEach(el=>el.onclick=()=>openFixtureDetail(decodeURIComponent(el.dataset.home),decodeURIComponent(el.dataset.away),el.dataset.date,el.dataset.time));
  };
  let currentTeamName='';
  const teamDrawFixtures=name=>{
    const rows=[
      ...(leagueDraw[name]||[]).map((entry,index)=>({date:'',home:entry.venue==='home'?name:entry.opponent,away:entry.venue==='away'?name:entry.opponent,status:'待赛',completed:false,order:index})),
      ...matches.filter(m=>m[5]==='league'&&(m[1]===name||m[2]===name)).map(m=>({date:m[0],home:m[1],away:m[2],status:m[3],completed:true})),
      ...allUpcoming.filter(f=>f.home===name||f.away===name).map(f=>({date:f.date,home:f.home,away:f.away,status:f.time||'待赛',completed:false}))
    ];
    const unique=new Map(rows.map(row=>[[row.home,row.away].join('|'),row]));
    return [...unique.values()].sort((a,b)=>(a.date||'9999').localeCompare(b.date||'9999')||(a.order??99)-(b.order??99));
  };
  const drawRows=(name,fixtures)=>fixtures.length?fixtures.map(f=>{const isHome=f.home===name,opponent=isHome?f.away:f.home,info=leagueTeamInfo(opponent);return `<div class="draw-opponent"><time>${f.date?f.date.slice(5):'日期待定'}</time><span class="venue ${isHome?'home':'away'}">${isHome?'主场':'客场'}</span><span class="draw-club"><strong>${teamChineseName(opponent)}</strong><small>${canonical(opponent)}</small></span><i class="draw-pot pot-${info?.pot||0}">${info?`第${info.pot}档`:'档位待核'}</i><b>${f.completed?f.status:'待赛'}</b></div>`}).join(''):'<div class="draw-empty">正在同步UEFA已公布的8场联赛阶段赛程…</div>';
  const openTeamLive=(rawName,updateLocation=true)=>{
    const name=canonical(rawName),t=teams.find(x=>x[1]===name);if(!t)return;
    const games=matches.filter(m=>m[1]===name||m[2]===name),rank=teams.indexOf(t)+1,info=leagueTeamInfo(name),draw=teamDrawFixtures(name);currentTeamName=name;
    if(updateLocation&&info)history.pushState(null,'',`#team=${encodeURIComponent(info.id)}`);
    document.querySelector('#drawerContent').innerHTML=`<div class="team-hero"><div class="bigbadge">${t[2]}</div><p class="eyebrow">2026/27 SEASON · 第 ${rank} 名</p><h2>${t[0]}<small>${t[1]}</small></h2><span>UEFA Champions League · 第 ${info?.pot||t[11]} 档</span></div><div class="summary"><div><b>${t[9]}</b><span>积分</span></div><div><b>${t[4]}</b><span>胜</span></div><div><b>${t[5]}</b><span>平</span></div><div><b>${t[6]}</b><span>负</span></div></div><section class="team-draw"><div class="history-title"><h3>联赛阶段抽签对战</h3><span>${draw.length} / 8 场</span></div><p>每档两名对手 · 主客场各四场</p><div class="draw-opponents">${drawRows(name,draw)}</div></section><div class="history"><div class="history-title"><h3>本赛季全部比赛</h3><span>共 ${games.length} 场</span></div><div class="history-label"><span>日期</span><span>对手（当前排名）</span><span>半场</span><span>全场</span></div>${games.map(m=>{let home=m[1]===name,sc=m[3].split('-').map(Number),a=home?sc[0]:sc[1],b=home?sc[1]:sc[0],o=a>b?'W':a===b?'D':'L',opp=home?m[2]:m[1],ot=teams.find(x=>x[1]===opp),orank=ot?teams.indexOf(ot)+1:'–';return `<div class="game"><span>${m[0].slice(5)}</span><span class="opponent"><i class="outcome ${o.toLowerCase()}">${o==='W'?'胜':o==='D'?'平':'负'}</i><i class="rank-chip" style="${ot?`background:${rankColor(orank)}`:'background:#7c8b86'}" title="当前第 ${orank} 名">${orank}</i><span class="opponent-name">${home?'主':'客'} · ${display(opp)}</span></span><span class="ht">${m[4]}</span><span class="score">${m[3]}</span></div>`}).join('')}</div><div class="data-source-panel"><b>球队比赛与抽签数据来源</b><span>联赛阶段抽签及赛程以UEFA官方公布结果为准</span><a href="https://www.uefa.com/uefachampionsleague/news/02a8-2176fa83582b-d99f0b27f405-1000--champions-league-league-phase-fixtures-by-team/" target="_blank" rel="noopener">UEFA 2026/27各队完整赛程</a><a href="https://site.api.espn.com/apis/site/v2/sports/soccer/uefa.champions/scoreboard?dates=2026&limit=600" target="_blank" rel="noopener">ESPN Scoreboard API</a></div>`;
    drawer.classList.add('open');overlay.classList.add('open');
  };
  window.openTeam=openTeamLive;
  const shortName=n=>{const t=teams.find(x=>x[1]===n);return t?t[0]:n};
  const fixtureName=(h,a)=>`<span class="fixture-name" title="${h} vs ${a}"><b>${shortName(h)}</b><i>VS</i><b>${shortName(a)}</b></span>`;
  const tableHead=(future=false)=>`<div class="detail-table-head ${future?'future-head':''}"><span>日期</span><span>比赛</span>${future?'<span>时间</span>':'<span>半场</span><span>全场</span>'}</div>`;
  const scoreRow=m=>`<div class="detail-row"><time>${m[0]}</time><span class="clubs">${fixtureName(m[1],m[2])}</span><span class="muted-score">${m[4]}</span><strong>${m[3]}</strong></div>`;
  const futureRows=(team)=>{const fs=allUpcoming.filter(f=>f.home===team||f.away===team);return tableHead(true)+(fs.length?fs.map(f=>`<div class="detail-row future-row"><time>${f.date}</time><span class="clubs">${fixtureName(f.home,f.away)}</span><strong>${f.time}</strong></div>`).join(''):'<div class="detail-row future-row"><time>—</time><span class="clubs">暂无已公布赛程</span><strong>—</strong></div>')};
  async function fetchH2H(home,away){
    const years=[2023,2024,2025];let found=[];
    const payloads=await Promise.all(years.map(y=>fetch(`https://site.api.espn.com/apis/site/v2/sports/soccer/uefa.champions/scoreboard?dates=${y}&limit=500`).then(r=>r.ok?r.json():{events:[]}).catch(()=>({events:[]}))));
    payloads.forEach(data=>(data.events||[]).forEach(e=>{if(!e.status?.type?.completed)return;const c=e.competitions[0],h=c.competitors.find(x=>x.homeAway==='home'),a=c.competitors.find(x=>x.homeAway==='away'),hn=canonical(h.team.displayName),an=canonical(a.team.displayName);if(!((hn===home&&an===away)||(hn===away&&an===home)))return;let hh=0,ha=0;(c.details||[]).filter(x=>x.scoringPlay&&Number(x.clock.value)<=2700).forEach(x=>x.team.id===h.id?hh++:ha++);found.push([e.date.slice(0,10),hn,an,h.score+'-'+a.score,hh+'-'+ha])}));
    const current=matches.filter(m=>(m[1]===home&&m[2]===away)||(m[1]===away&&m[2]===home));return [...found,...current].filter((m,i,a)=>a.findIndex(x=>x[0]===m[0]&&x[1]===m[1]&&x[2]===m[2])===i).sort((a,b)=>b[0].localeCompare(a[0])).slice(0,12);
  }
  const calculateStats=(games,team)=>{const s={n:games.length,ft:{w:0,d:0,l:0},ht:{w:0,d:0,l:0},goals:0};games.forEach(m=>{const isHome=m[1]===team,[fh,fa]=m[3].split('-').map(Number),[hh,ha]=m[4].split('-').map(Number),fg=isHome?fh:fa,fo=isHome?fa:fh,hg=isHome?hh:ha,ho=isHome?ha:hh;s.goals+=fg;s.ft[fg>fo?'w':fg<fo?'l':'d']++;if(Number.isFinite(hg)&&Number.isFinite(ho))s.ht[hg>ho?'w':hg<ho?'l':'d']++});return s};
  const pct=(v,n)=>n?Math.round(v/n*100):0;
  const statsCard=(team,games,scope)=>{const s=calculateStats(games,team),row=(label,x)=>`<div class="stat-line"><span>${label}</span><b class="stat-w">胜 ${x.w}<small>${pct(x.w,s.n)}%</small></b><b class="stat-d">平 ${x.d}<small>${pct(x.d,s.n)}%</small></b><b class="stat-l">负 ${x.l}<small>${pct(x.l,s.n)}%</small></b></div>`;return `<article class="record-stat"><header><strong>${shortName(team)}</strong><span>${scope} · ${s.n} 场</span></header>${row('全场',s.ft)}${row('半场',s.ht)}<footer><span>场均进球</span><strong>${s.n?(s.goals/s.n).toFixed(2):'0.00'}</strong></footer></article>`};
  const renderSideStandings=(home,away)=>{const panel=document.querySelector('#modalStandings');panel.innerHTML=`<div class="side-table-title"><div><p>UEFA CHAMPIONS LEAGUE · 2026/27</p><h2>联赛阶段积分榜</h2></div><span>当前 ${teams.length} 队</span></div><div class="side-table-head"><span>#</span><span>球队</span><span>赛</span><span>净胜</span><span>积分</span></div><div class="side-table-body">${teams.map((t,i)=>`<div class="side-team pot-${t[11]} ${t[1]===home||t[1]===away?'selected':''} zone-${i+1}"><b>${i+1}</b><span><strong>${t[0]}</strong><small>${t[1]}</small></span><i>${t[3]}</i><i>${t[7]-t[8]>0?'+':''}${t[7]-t[8]}</i><em>${t[9]}</em></div>`).join('')}</div><div class="side-legend"><span><i></i>1–8直通16强</span><span><i></i>9–24附加赛</span><span><i></i>25–36淘汰</span></div>`;panel.classList.add('open')};
  async function openFixtureDetail(home,away,date='',time=''){
    const predictionKey=fixtureKey(date,home,away);
    renderSideStandings(home,away);
    drawer.classList.add('open');overlay.classList.add('open');document.querySelector('#drawerContent').innerHTML=`<div class="match-detail-head"><p class="eyebrow">MATCH INTELLIGENCE</p><h2>${display(home)}<br><span class="versus">VS</span><br>${display(away)}</h2><span>比赛数据中心 · 2026/27 欧冠</span></div><div class="loading-detail"><div class="loading-ball"></div>正在整理历史交锋与赛季数据…</div>`;
    let h2h=[],failed=false;try{h2h=await fetchH2H(home,away)}catch(e){failed=true;h2h=matches.filter(m=>(m[1]===home&&m[2]===away)||(m[1]===away&&m[2]===home))}
    const homeGames=matches.filter(m=>m[1]===home||m[2]===home),awayGames=matches.filter(m=>m[1]===away||m[2]===away);
    document.querySelector('#drawerContent').innerHTML=`<div class="match-detail-head"><p class="eyebrow">MATCH INTELLIGENCE</p><h2>${display(home)}<br><span class="versus">VS</span><br>${display(away)}</h2><span>${date?`${date}${time?` · ${time}`:''} · `:''}比赛数据中心 · 2026/27 欧冠</span></div><div id="predictionEditor"></div><div class="detail-tabs"><button class="active" data-jump="h2h">历史交锋</button><button data-jump="seasonForm">赛季战绩</button><button data-jump="futureGames">未来赛程</button></div>${failed?'<div class="detail-error">历史数据源连接失败，当前仅展示本赛季本地数据。</div>':''}<section class="detail-section" id="h2h"><h3>历史交手记录</h3><p>近期最多 12 次欧冠交锋</p><div class="detail-list">${tableHead()}${h2h.length?h2h.map(m=>scoreRow(m)).join(''):'<div class="detail-row"><time>—</time><span class="clubs">暂无可用交锋记录</span><span>—</span><strong>—</strong></div>'}</div></section><section class="detail-section" id="seasonForm"><h3>本赛季历史战绩</h3><p>两队2026/27欧冠全部已完赛比赛</p><h4 class="team-divider">${display(home)} · ${homeGames.length} 场</h4><div class="detail-list">${tableHead()}${homeGames.map(m=>scoreRow(m)).join('')}</div><h4 class="team-divider">${display(away)} · ${awayGames.length} 场</h4><div class="detail-list">${tableHead()}${awayGames.map(m=>scoreRow(m)).join('')}</div></section><section class="detail-section" id="futureGames"><h3>本赛季未来比赛</h3><p>依据当前已公布的欧冠赛程</p><h4 class="team-divider">${display(home)}</h4><div class="detail-list">${futureRows(home)}</div><h4 class="team-divider">${display(away)}</h4><div class="detail-list">${futureRows(away)}</div></section><div class="data-source-panel"><b>比赛详情数据来源</b><span>历史交锋、本赛季战绩和未来赛程</span><a href="https://site.api.espn.com/apis/site/v2/sports/soccer/uefa.champions/scoreboard" target="_blank" rel="noopener">https://site.api.espn.com/apis/site/v2/sports/soccer/uefa.champions/scoreboard</a><a href="https://www.uefa.com/uefachampionsleague/fixtures-results/" target="_blank" rel="noopener">https://www.uefa.com/uefachampionsleague/fixtures-results/</a></div>`;
    mountPredictionEditor(document.querySelector('#predictionEditor'),predictionKey,home,away,predictions[predictionKey]);
    const h2hList=document.querySelector('#h2h .detail-list');h2hList.insertAdjacentHTML('beforebegin',`<div class="record-stat-grid">${statsCard(home,h2h,'交锋')}${statsCard(away,h2h,'交锋')}</div>`);h2hList.querySelectorAll('.detail-row').forEach((row,i)=>{const m=h2h[i];if(!m)return;const [fh,fa]=m[3].split('-').map(Number),[hh,ha]=m[4].split('-').map(Number),currentWasHome=m[1]===home,us=currentWasHome?fh:fa,them=currentWasHome?fa:fh,hus=currentWasHome?hh:ha,hthem=currentWasHome?ha:hh,outcome=(a,b)=>a>b?'score-win':a<b?'score-loss':'score-draw';row.classList.add(us>them?'result-win':us<them?'result-loss':'result-draw');row.querySelector('.muted-score').classList.add(outcome(hus,hthem));row.querySelector('strong').classList.add(outcome(us,them))});
    const seasonLists=document.querySelectorAll('#seasonForm .detail-list');[[seasonLists[0],homeGames,home],[seasonLists[1],awayGames,away]].forEach(([list,games,focus])=>{if(!list)return;list.insertAdjacentHTML('beforebegin',`<div class="record-stat-grid single">${statsCard(focus,games,'本赛季')}</div>`);list.querySelectorAll('.detail-row').forEach((row,i)=>{const m=games[i],[hg,ag]=m[3].split('-').map(Number),[hh,ha]=m[4].split('-').map(Number),isHome=m[1]===focus,us=isHome?hg:ag,them=isHome?ag:hg,hus=isHome?hh:ha,hthem=isHome?ha:hh,outcome=(a,b)=>a>b?'score-win':a<b?'score-loss':'score-draw';row.classList.add(us>them?'result-win':us<them?'result-loss':'result-draw');row.querySelector('.muted-score').classList.add(outcome(hus,hthem));row.querySelector('strong').classList.add(outcome(us,them));if(isHome)row.querySelector('.clubs').insertAdjacentHTML('afterbegin','<span class="home-badge" title="主场作战">⌂ 主场</span>')})});
    [[seasonLists[0],homeGames,home],[seasonLists[1],awayGames,away]].forEach(([list,games,focus])=>{if(!list)return;let total=0,first=0,knownHalf=0;games.forEach(m=>{const isHome=m[1]===focus,[fh,fa]=m[3].split('-').map(Number),[hh,ha]=m[4].split('-').map(Number);total+=isHome?fh:fa;if(Number.isFinite(hh)&&Number.isFinite(ha)){first+=isHome?hh:ha;knownHalf++}});const avg=(v,n=games.length)=>n?(v/n).toFixed(2):'—',footer=list.previousElementSibling.querySelector('.record-stat footer');footer.className='goal-splits';footer.innerHTML=`<div><span>场均进球</span><strong>${avg(total)}</strong></div><div><span>上半场场均</span><strong>${avg(first,knownHalf)}</strong></div><div><span>下半场场均</span><strong>${knownHalf?avg(total-first):'—'}</strong></div>`});
    document.querySelectorAll('.detail-tabs button').forEach(b=>b.onclick=()=>{document.querySelectorAll('.detail-tabs button').forEach(x=>x.classList.remove('active'));b.classList.add('active');document.querySelector('#'+b.dataset.jump).scrollIntoView({behavior:'smooth',block:'start'})});
  }
  window.openFixtureDetail=openFixtureDetail;renderResults();
  new MutationObserver(()=>{if(!drawer.classList.contains('open'))document.querySelector('#modalStandings').classList.remove('open')}).observe(drawer,{attributes:true,attributeFilter:['class']});
  const bindRows=()=>tbody.querySelectorAll('tr').forEach(r=>{const open=()=>openTeamLive(r.dataset.team);r.onclick=open;r.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();open()}}});
  const oldRender=window.render;window.render=function(q=''){oldRender(q);bindRows()};
  bindRows();
  const openTeamFromHash=()=>{const id=decodeURIComponent(location.hash.replace(/^#team=/,'')),info=leagueTeamCatalog.find(team=>team.id===id);if(info)openTeamLive(info.name,false);else if(!location.hash){drawer.classList.remove('open');overlay.classList.remove('open');currentTeamName=''}};
  window.addEventListener('hashchange',openTeamFromHash);setTimeout(openTeamFromHash,0);
  const mergeMatchRows=rows=>{
    const merged=new Map(matches.map(match=>[match.slice(0,3).join('|'),match]));
    rows.forEach(match=>merged.set(match.slice(0,3).join('|'),match));
    matches.splice(0,matches.length,...[...merged.values()].sort((a,b)=>b[0].localeCompare(a[0])));recalc();
  };
  const liveApiUrl=location.protocol==='file:'?'https://ucl-data-center.pages.dev/api/ucl-qualification-live':'/api/ucl-qualification-live';
  const fetchOfficialPayload=async()=>{
    const res=await fetch(`${liveApiUrl}?_=${Date.now()}`,{cache:'no-store'});
    if(!res.ok)throw new Error('UEFA API HTTP '+res.status);
    return res.json();
  };
  const officialRows=data=>(data?.matches||[]).map(match=>[match.date,canonical(match.home),canonical(match.away),`${match.homeScore}-${match.awayScore}`,'—','qualifying']);
  const syncLeagueTeams=catalog=>{
    if(!Array.isArray(catalog)||catalog.length!==36)return false;
    const incoming=new Set(catalog.map(([rawName])=>canonical(rawName))),official=new Set(leagueTeamCatalog.map(team=>team.name));
    if(incoming.size!==36||[...incoming].some(name=>!official.has(name)))return false;
    const previous=new Map(teams.filter(team=>official.has(team[1])).map(team=>[team[1],team]));
    const next=leagueTeamCatalog.map(meta=>{const old=previous.get(meta.name);return [meta.zh,meta.name,meta.code,...(old?old.slice(3,11):[0,0,0,0,0,0,0,'']),meta.pot]});
    teams.splice(0,teams.length,...next);
    return true;
  };
  const refreshUpcoming=()=>{
    const nowTime=Date.now(),horizon=nowTime+21*24*60*60*1000;
    upcoming=allUpcoming.filter(f=>{const kickoff=new Date(f.date+'T'+f.time.split('/')[0]+':00+08:00').getTime();return kickoff>=nowTime-60*60*1000&&kickoff<=horizon});
    renderSchedule();
  };
  async function updateData(silent=false){
    const btn=document.querySelector('#updateBtn');btn.classList.add('loading');btn.disabled=true;
    let official=null,seasonEvents=[],sourceErrors=[];
    try{
      try{
        official=await fetchOfficialPayload();
        if(official.leagueTeams?.length===36)syncLeagueTeams(official.leagueTeams);
        const rows=officialRows(official);if(rows.length)mergeMatchRows(rows);
      }catch(error){sourceErrors.push('UEFA')}
      try{
        const urls=[2026,2027].map(year=>`https://site.api.espn.com/apis/site/v2/sports/soccer/uefa.champions/scoreboard?dates=${year}&limit=600&_=${Date.now()}`);
        const responses=await Promise.all(urls.map(url=>fetch(url,{cache:'no-store'})));
        if(responses.some(response=>!response.ok))throw new Error('ESPN HTTP error');
        const payloads=await Promise.all(responses.map(response=>response.json()));
        seasonEvents=payloads.flatMap(data=>data.events||[]).filter(event=>{const date=event.date?.slice(0,10)||'';return date>='2026-07-01'&&date<='2027-06-30'});
        const fresh=[],future=[],now=Date.now(),unknownLeagueNames=new Set();
        seasonEvents.forEach(event=>{const competition=event.competitions?.[0],home=competition?.competitors?.find(team=>team.homeAway==='home'),away=competition?.competitors?.find(team=>team.homeAway==='away');if(!competition||!home||!away)return;const scheduled=beijingDateTime(event.date),date=scheduled.date,homeName=canonical(home.team.displayName),awayName=canonical(away.team.displayName),stage=event.season?.slug==='league-phase'?'league':'qualifying';
          if(stage==='league'&&(!leagueTeamInfo(homeName)||!leagueTeamInfo(awayName))){if(!leagueTeamInfo(homeName))unknownLeagueNames.add(home.team.displayName);if(!leagueTeamInfo(awayName))unknownLeagueNames.add(away.team.displayName);return}
          if(event.status?.type?.completed){let hh=0,ha=0;(competition.details||[]).filter(detail=>detail.scoringPlay&&Number(detail.clock.value)<=2700).forEach(detail=>detail.team.id===home.id?hh++:ha++);fresh.push([date,homeName,awayName,home.score+'-'+away.score,hh+'-'+ha,stage])}
          else if(new Date(event.date).getTime()>now)future.push({date,time:scheduled.time,home:homeName,away:awayName});
        });
        if(fresh.length)mergeMatchRows(fresh);
        if(seasonEvents.length)allUpcoming=future.sort((a,b)=>(a.date+a.time).localeCompare(b.date+b.time));
      }catch(error){sourceErrors.push('ESPN')}
      syncLeagueTeams(leagueTeams);recalc();refreshUpcoming();if(currentTeamName)openTeamLive(currentTeamName,false);
      const stamp=official?.sourceUpdatedAt?.slice(5)||'08-27';
      const confirmed=teams.length===36&&new Set(teams.map(team=>team[1])).size===36&&teams.every(team=>leagueTeamInfo(team[1]));
      document.querySelector('#updatedAt').textContent=`官方数据至 ${stamp} · ${confirmed?'36队已确认':'名单核对中'}`;
      if(!silent)toast(sourceErrors.length===2?'在线数据源暂不可用，已显示本地最终核验数据':`更新完成：${teams.length} 队，${matches.length} 场赛果，${upcoming.length} 场待赛`);
      window.refreshUclAdvancement?.();
    }finally{btn.classList.remove('loading');btn.disabled=false}
  }
  document.querySelector('#updateBtn').onclick=()=>updateData(false);
  scheduleBtn.onclick=()=>{document.querySelectorAll('nav button').forEach(b=>b.classList.remove('active'));scheduleBtn.classList.add('active');document.querySelector('.hero').style.display='none';document.querySelector('.layout').style.display='none';document.querySelector('.results').style.display='none';document.querySelector('#schedulePage').classList.add('active');window.scrollTo({top:0,behavior:'smooth'})};
  document.querySelectorAll('nav button:not(#scheduleBtn)').forEach(b=>b.addEventListener('click',()=>{document.querySelectorAll('nav button').forEach(x=>x.classList.remove('active'));b.classList.add('active');document.querySelector('.hero').style.display='flex';document.querySelector('.layout').style.display='grid';document.querySelector('.results').style.display='block';document.querySelector('#schedulePage').classList.remove('active')}));
  updateData(true);setTimeout(()=>updateData(true),1500);setInterval(()=>updateData(true),600000);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)updateData(true)});
})(); 
