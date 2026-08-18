(function(){
  const zh=team=>teamChineseName(team);
  const round1=[
    ['Sabah','The New Saints','2–0','1–2','4–1','Sabah'],
    ['Lincoln Red Imps','Inter Club d’Escaldes','3–1','1–1','4–2','Lincoln Red Imps'],
    ['Ararat-Armenia','Riga FC','2–0','3–2','4–3','Ararat-Armenia'],
    ['Kauno Zalgiris','Drita','1–1','2–3','4–3','Kauno Zalgiris'],
    ['Vardar','KuPS Kuopio','0–2','2–3','3–4','KuPS Kuopio'],
    ['Floriana','Shamrock Rovers','2–0','5–1','3–5','Shamrock Rovers'],
    ['Tre Fiori','Larne','0–1','2–1','1–3','Larne'],
    ['Borac Banja Luka','Levski Sofia','1–1','4–0','1–5','Levski Sofia'],
    ['KI Klaksvik','Atert Bissen','2–1','1–2','4–2','KI Klaksvik'],
    ['Vikingur Reykjavik','ETO Gyor','1–0','2–2','3–2','Vikingur Reykjavik'],
    ['Kairat Almaty','Sutjeska','2–1','0–2','4–1','Kairat Almaty'],
    ['Flora Tallinn','Iberia Tbilisi','2–3','2–2','4–5','Iberia Tbilisi'],
    ['Vitebsk','Universitatea Craiova','1–4','1–0','1–5','Universitatea Craiova'],
    ['Petrocub','Egnatia','1–1','6–1','2–7','Egnatia']
  ];
  const round2=[
    ['Mjallby','Lincoln Red Imps','3–0','0–0','3–0','Mjallby'],['Sabah','KuPS Kuopio','1–0','0–2','3–0','Sabah'],['Ararat-Armenia','Shamrock Rovers','2–0','2–1','3–2','Ararat-Armenia'],['Iberia Tbilisi','Slovan Bratislava','0–2','1–1','1–3','Slovan Bratislava'],['Aarhus','Lech Poznan','1–4','1–4','5–5 点4–3','Aarhus'],['Thun','Dinamo Zagreb','1–1','3–2','3–4','Dinamo Zagreb'],['KI Klaksvik','Kauno Zalgiris','0–0','1–0','0–1','Kauno Zalgiris'],['Larne','Red Star Belgrade','0–4','5–0','0–9','Red Star Belgrade'],['Vikingur Reykjavik','Hapoel Beer-Sheva','2–1','2–0','2–3','Hapoel Beer-Sheva'],['Fenerbahce','Gornik Zabrze','1–0','1–1','2–1','Fenerbahce'],['Sturm Graz','Hearts','4–0','0–2','6–0','Sturm Graz'],['Omonoia','Kairat Almaty','1–0','1–0','1–1 点5–6','Kairat Almaty'],['Levski Sofia','Universitatea Craiova','1–0','2–2','3–2','Levski Sofia'],['Egnatia','Celje','3–3','2–2','5–5 点1–4','Celje']
  ];
  const round3=[
    {path:'冠军路径',a:'Mjallby',b:'Slovan Bratislava',first:'08-05 00:00',second:'08-12 02:15'},
    {path:'冠军路径',a:'Ararat-Armenia',b:'Celje',first:'08-05 00:00',second:'08-12 02:15'},
    {path:'冠军路径',a:'Levski Sofia',b:'Kairat Almaty',first:'08-05 01:30',second:'08-11 23:00'},
    {path:'冠军路径',a:'Hapoel Beer-Sheva',b:'Red Star Belgrade',first:'08-05 01:30',second:'08-12 02:00'},
    {path:'冠军路径',a:'Dinamo Zagreb',b:'Kauno Zalgiris',first:'08-05 02:00',second:'08-12 01:00'},
    {path:'联赛路径',a:'Olympiacos',b:'NEC Nijmegen',first:'08-05 02:00',second:'08-12 01:30'},
    {path:'联赛路径',a:'Union Saint-Gilloise',b:'Bodo/Glimt',first:'08-05 02:00',second:'08-12 00:00'},
    {path:'联赛路径',a:'Sparta Prague',b:'Lyon',first:'08-05 02:00',second:'08-12 03:00'},
    {path:'冠军路径',a:'Aarhus',b:'Sabah',first:'08-06 00:30',second:'08-12 00:00'},
    {path:'联赛路径',a:'Fenerbahce',b:'Sturm Graz',first:'08-06 02:00',second:'08-12 02:30'}
  ];
  const verifiedResults=[
    ['2026-08-05','Mjallby','Slovan Bratislava',1,2],['2026-08-05','Ararat-Armenia','Celje',2,1],
    ['2026-08-05','Levski Sofia','Kairat Almaty',1,0],['2026-08-05','Hapoel Beer-Sheva','Red Star Belgrade',1,0],
    ['2026-08-05','Dinamo Zagreb','Kauno Zalgiris',5,0],['2026-08-05','Olympiacos','NEC Nijmegen',0,0],
    ['2026-08-05','Union Saint-Gilloise','Bodo/Glimt',3,3],['2026-08-05','Sparta Prague','Lyon',2,1],
    ['2026-08-06','Aarhus','Sabah',2,1],['2026-08-06','Fenerbahce','Sturm Graz',2,0],
    ['2026-08-11','Kairat Almaty','Levski Sofia',0,1],['2026-08-12','Sabah','Aarhus',4,0],
    ['2026-08-12','Bodo/Glimt','Union Saint-Gilloise',3,2],['2026-08-12','Kauno Zalgiris','Dinamo Zagreb',1,2],
    ['2026-08-12','NEC Nijmegen','Olympiacos',2,1],['2026-08-12','Red Star Belgrade','Hapoel Beer-Sheva',0,2],
    ['2026-08-12','Slovan Bratislava','Mjallby',2,0],['2026-08-12','Celje','Ararat-Armenia',2,0],
    ['2026-08-12','Sturm Graz','Fenerbahce',0,1],['2026-08-12','Lyon','Sparta Prague',3,0]
  ].map(([date,home,away,homeScore,awayScore])=>({date,home,away,homeScore,awayScore,completed:true,inProgress:false}));
  const playoffs=[
    {path:'冠军路径',a:'Levski Sofia',b:'AEK Athens',first:'08-19 00:45/03:00',second:'08-27 03:00'},
    {path:'冠军路径',a:'Dinamo Zagreb',b:'Viking',first:'08-19 03:00',second:'08-27 03:00'},
    {path:'冠军路径',a:'Hapoel Beer-Sheva',b:'Sabah',first:'08-20 03:00',second:'08-26 00:45/03:00'},
    {path:'冠军路径',a:'Celtic',b:'LASK',first:'08-20 03:00',second:'08-26 03:00'},
    {path:'冠军路径',a:'Slovan Bratislava',b:'Celje',first:'08-20 03:00',second:'08-27 00:45/03:00'},
    {path:'联赛路径',a:'Fenerbahce',b:'Lyon',first:'08-19 03:00',second:'08-27 03:00'},
    {path:'联赛路径',a:'NEC Nijmegen',b:'Bodo/Glimt',first:'08-20 03:00',second:'08-26 03:00'}
  ];
  const page=document.createElement('section');
  page.id='advancementPage';page.className='advancement-page';
  page.innerHTML=`
    <section class="advance-hero"><div><p class="eyebrow">LIVE QUALIFICATION MAP · 2026/27</p><h1>欧冠资格赛<br><span>实时晋级图</span></h1><p>不看模拟积分，只沿着真实的两回合对阵追踪谁晋级、谁待赛、谁转入欧联杯。</p></div><div class="advance-live"><i></i><div><b id="advanceUpdateTitle">正在检查最新数据</b><span id="advanceUpdateTime">页面打开时自动更新</span></div><button id="advanceRefresh" type="button">↻ 立即刷新</button></div></section>
    <section class="advance-overview"><article><b>14</b><span>第一轮晋级</span><small>已完成</small></article><i>→</i><article><b>14</b><span>第二轮晋级</span><small>已完成</small></article><i>→</i><article><b>10</b><span>第三轮晋级</span><small>已完成</small></article><i>→</i><article class="current"><b>7</b><span>附加赛对阵</span><small>当前轮次</small></article></section>
    <section class="advance-history"><header><div><span>ROUND 1 · COMPLETE</span><h2>第一轮完整赛果</h2></div><small>14组 · 28场 · 比分均为当场主队在前</small></header><div id="advanceRound1" class="advance-history-grid"></div></section>
    <section class="advance-path-summary"><div class="champion"><span>冠军路径</span><b>12队 → 6队 → 5个联赛阶段席位</b></div><div class="league"><span>联赛路径</span><b>8队 → 4队 → 2个联赛阶段席位</b></div></section>
    <section class="advance-board">
      <div class="advance-column completed"><header><span>ROUND 2</span><h2>第二轮</h2><small>14组 · 已结束</small></header><div id="advanceRound2"></div></div>
      <div class="advance-flow"><span>14支晋级</span><b>→</b></div>
      <div class="advance-column completed round3-column"><header><span>ROUND 3</span><h2>第三轮</h2><small>10组 · 已结束</small></header><div id="advanceRound3"></div></div>
      <div class="advance-flow"><span>10支晋级</span><b>→</b></div>
      <div class="advance-column current"><header><span>PLAY-OFFS</span><h2>附加赛</h2><small>7组 · 8月18日起</small></header><div id="advancePlayoffs"></div></div>
      <div class="advance-flow final"><span>7支晋级</span><b>→</b></div>
      <div class="league-destination"><span>LEAGUE PHASE</span><b>36</b><strong>联赛阶段</strong><small>29队直入 + 7队资格赛晋级</small></div>
    </section>
    <section class="advance-legend"><span><i class="won"></i>已晋级</span><span><i class="live"></i>当前对阵</span><span><i class="waiting"></i>待确定</span><span><i class="europa"></i>负者转入欧联杯</span></section>
    <footer class="advance-source"><div><b>自动更新说明</b><span>每次进入页面、重新打开标签页以及每10分钟，系统都会请求最新赛果；数据源暂不可用时继续显示最后一次已核对结果并明确提示。</span></div><a href="https://www.uefa.com/uefachampionsleague/news/02a6-20e5a8be4e63-ae971c582f8c-1000--champions-league-qualifying-fixtures-results-dates-how-it-/" target="_blank" rel="noopener">UEFA官方资格赛页面 ↗</a></footer>`;
  document.querySelector('main').appendChild(page);

  const round1Teams=new Set(round1.flatMap(tie=>tie.slice(0,2)).map(canonicalTeamName));
  const round2Teams=new Set(round2.flatMap(tie=>tie.slice(0,2)).map(canonicalTeamName));
  const round3Teams=new Set(round3.flatMap(tie=>[tie.a,tie.b]).map(canonicalTeamName));
  const originFor=(team,round)=>{
    const name=canonicalTeamName(team);
    if(round==='round1')return {label:'第一轮新加入',className:'origin-round1-entry'};
    if(round==='round2')return round1Teams.has(name)?{label:'第一轮晋级',className:'origin-round1-winner'}:{label:'第二轮新加入',className:'origin-round2-entry'};
    if(round==='round3')return round2Teams.has(name)?{label:'第二轮晋级',className:'origin-round2-winner'}:{label:'第三轮新加入',className:'origin-round3-entry'};
    return round3Teams.has(name)?{label:'第三轮晋级',className:'origin-round3-winner'}:{label:'附加赛新加入',className:'origin-playoff-entry'};
  };
  const teamLine=(team,mark='',origin)=>`<span class="advance-team ${mark}"><span class="advance-team-heading"><strong>${zh(team)}</strong><small>${canonicalTeamName(team)}</small>${origin?`<i class="team-origin ${origin.className}">${origin.label}</i>`:''}</span></span>`;
  const renderCompletedRound=(target,data,round)=>{target.innerHTML=data.map(([a,b,leg1,leg2,total,winner])=>`<article class="advance-tie done">${teamLine(a,winner===a?'winner':'',originFor(a,round))}<div class="leg-score-grid"><span><small>首回合 · ${zh(a)}主场</small><b>${leg1}</b></span><span><small>次回合 · ${zh(b)}主场</small><b>${leg2}</b></span><span class="aggregate"><small>两回合总比分</small><b>${total}</b></span></div>${teamLine(b,winner===b?'winner':'',originFor(b,round))}<footer><span>比分均为当场主队在前</span><b>${zh(winner)} 晋级</b></footer></article>`).join('')};
  renderCompletedRound(page.querySelector('#advanceRound1'),round1,'round1');
  renderCompletedRound(page.querySelector('#advanceRound2'),round2,'round2');
  const round3Box=page.querySelector('#advanceRound3');
  function renderRound3(liveMatches=[]){
    round3Box.innerHTML=round3.map((tie,index)=>{
      const games=liveMatches.filter(match=>sameTie(match,tie));
      const firstLeg=games.find(match=>norm(match.home)===norm(tie.a));
      const secondLeg=games.find(match=>norm(match.home)===norm(tie.b));
      const completed=games.filter(match=>match.completed);
      let aGoals=0,bGoals=0;
      completed.forEach(match=>{
        if(norm(match.home)===norm(tie.a)){aGoals+=match.homeScore;bGoals+=match.awayScore}
        else{aGoals+=match.awayScore;bGoals+=match.homeScore}
      });
      const finished=Boolean(firstLeg?.completed&&secondLeg?.completed);
      const winner=finished?(aGoals>bGoals?tie.a:tie.b):'';
      const legScore=match=>match&&(match.completed||match.inProgress)?`${match.homeScore}–${match.awayScore}`:'待赛';
      const totalScore=completed.length?`${aGoals}–${bGoals}`:'VS';
      const state=finished?'两回合结束':firstLeg?.completed?`次回合 ${tie.second}`:`首回合 ${tie.first}`;
      return `<article class="advance-tie ${finished?'done':'active-tie'}" data-index="${index}"><span class="advance-path ${tie.path==='联赛路径'?'league':''}">${tie.path}</span>${teamLine(tie.a,winner===tie.a?'winner':'',originFor(tie.a,'round3'))}<div class="leg-score-grid"><span><small>首回合 · ${zh(tie.a)}主场</small><b>${legScore(firstLeg)}</b></span><span><small>次回合 · ${zh(tie.b)}主场</small><b>${legScore(secondLeg)}</b></span><span class="aggregate"><small>两回合总比分</small><b>${totalScore}</b></span></div>${teamLine(tie.b,winner===tie.b?'winner':'',originFor(tie.b,'round3'))}<footer><span>${state} · 比分均为当场主队在前</span><b>${finished?`${zh(winner)} 晋级`:'北京时间'}</b></footer></article>`
    }).join('');
  }
  renderRound3(verifiedResults);
  page.querySelector('#advancePlayoffs').innerHTML=playoffs.map(tie=>`<article class="advance-tie playoff"><span class="advance-path ${tie.path==='联赛路径'?'league':''}">${tie.path}</span>${teamLine(tie.a,'',originFor(tie.a,'playoff'))}<em>VS</em>${teamLine(tie.b,'',originFor(tie.b,'playoff'))}<footer><span>首 ${tie.first} · 次 ${tie.second}</span><b>北京时间</b></footer></article>`).join('');

  function norm(value){return canonicalTeamName(value).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]/g,'')}
  function sameTie(match,tie){const m=[norm(match.home),norm(match.away)],t=[norm(tie.a),norm(tie.b)];return m.every(x=>t.includes(x))}
  function mergeResults(rows=[]){const merged=new Map(verifiedResults.map(match=>[[match.date,norm(match.home),norm(match.away)].join('|'),match]));rows.forEach(match=>{const key=[match.date||'',norm(match.home),norm(match.away)].join('|');merged.set(key,match)});return [...merged.values()]}
  let refreshing=false;
  const liveApiUrl=location.protocol==='file:'
    ?'https://nord16-eliteserien-2026.lihao123.chatgpt.site/api/ucl-qualification-live'
    :'/api/ucl-qualification-live';
  const uefaReaderUrl='https://r.jina.ai/http://www.uefa.com/uefachampionsleague/news/02a6-20e5a8be4e63-ae971c582f8c-1000--champions-league-qualifying-fixtures-results-dates-how-it-/';
  const officialAliases=[
    ['Mjallby','Slovan Bratislava',['Mjällby','Mjallby'],['Slovan Bratislava']],
    ['Ararat-Armenia','Celje',['Ararat-Armenia'],['Celje']],['Levski Sofia','Kairat Almaty',['Levski Sofia'],['Kairat Almaty']],
    ['Hapoel Beer-Sheva','Red Star Belgrade',['Hapoel Beer-Sheva'],['Crvena Zvezda','Red Star Belgrade']],
    ['Dinamo Zagreb','Kauno Zalgiris',['GNK Dinamo','Dinamo Zagreb'],['Kauno Žalgiris','Kauno Zalgiris']],
    ['Olympiacos','NEC Nijmegen',['Olympiacos'],['N.E.C.','NEC Nijmegen']],
    ['Union Saint-Gilloise','Bodo/Glimt',['Union SG','Union Saint-Gilloise'],['Bodø/Glimt','Bodo/Glimt']],
    ['Sparta Prague','Lyon',['Sparta Praha','Sparta Prague'],['Lyon']],['Aarhus','Sabah',['Aarhus'],['Sabah']],
    ['Fenerbahce','Sturm Graz',['Fenerbahçe','Fenerbahce'],['Sturm Graz']]
  ];
  function escapePattern(value){return value.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}
  async function fetchOfficialResults(){
    const response=await fetch(uefaReaderUrl,{cache:'no-store'});if(!response.ok)throw new Error('UEFA '+response.status);
    const text=await response.text(),section=text.split(/##\s+Third qualifying round/i)[1]?.split(/##\s+Play-off round/i)[0]||text,matches=[];
    officialAliases.forEach(([a,b,aAliases,bAliases])=>[[a,b,aAliases,bAliases],[b,a,bAliases,aAliases]].forEach(([home,away,homeAliases,awayAliases])=>{
      const pattern=new RegExp(`(?:${homeAliases.map(escapePattern).join('|')})\\s+(\\d+)\\s*[-–]\\s*(\\d+)\\s+(?:${awayAliases.map(escapePattern).join('|')})`,'gi');
      const secondLeg=home===b,date=secondLeg?(home==='Kairat Almaty'?'2026-08-11':'2026-08-12'):(home==='Aarhus'||home==='Fenerbahce'?'2026-08-06':'2026-08-05');
      for(const result of section.matchAll(pattern))matches.push({date,home,away,homeScore:Number(result[1]),awayScore:Number(result[2]),completed:true,inProgress:false});
    }));
    if(!matches.length)throw new Error('UEFA 暂无可解析赛果');return matches;
  }
  window.uclFetchOfficialResults=fetchOfficialResults;
  async function update(){
    if(refreshing)return;refreshing=true;
    const button=page.querySelector('#advanceRefresh'),title=page.querySelector('#advanceUpdateTitle'),time=page.querySelector('#advanceUpdateTime');
    button.disabled=true;button.textContent='↻ 更新中';title.textContent='正在检查最新数据';
    try{
      const response=await fetch(liveApiUrl,{cache:'no-store'});
      if(!response.ok)throw new Error('HTTP '+response.status);
      const data=await response.json();
      const matches=mergeResults(data.matches||[]);renderRound3(matches);
      const count=matches.filter(match=>match.completed||match.inProgress).length;
      title.textContent=data.live?`已同步 ${count} 场官方赛果`:'已使用最后核对数据';
      time.textContent=`检查于 ${new Date().toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit'})} · ${data.source||'UEFA / ESPN'}`;
    }catch(error){try{const matches=mergeResults(await fetchOfficialResults());renderRound3(matches);title.textContent=`已从 UEFA 同步 ${matches.length} 场赛果`;time.textContent=`检查于 ${new Date().toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit'})} · UEFA 官方资格赛`}catch{renderRound3(verifiedResults);title.textContent='已显示已核对的 20 场第三轮赛果';time.textContent='当前为本地完整数据 · 联网后可再次刷新'}}
    finally{refreshing=false;button.disabled=false;button.textContent='↻ 立即刷新'}
  }
  page.querySelector('#advanceRefresh').addEventListener('click',update);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden&&page.classList.contains('active'))update()});
  setInterval(()=>{if(page.classList.contains('active'))update()},600000);

  const button=document.querySelector('#advancementBtn');
  button.addEventListener('click',()=>{
    document.querySelectorAll('nav button').forEach(item=>item.classList.toggle('active',item===button));
    ['.hero','.layout','.results'].forEach(selector=>document.querySelector(selector).style.display='none');
    document.querySelector('#schedulePage')?.classList.remove('active');
    document.querySelector('#competitionInfo')?.classList.remove('active');
    document.querySelector('#qualificationPage')?.classList.remove('active');
    page.classList.add('active');window.scrollTo({top:0,behavior:'smooth'});update();
  });
})();
