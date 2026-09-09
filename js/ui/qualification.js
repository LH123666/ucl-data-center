(function(){
  const page=document.createElement('section');
  page.id='qualificationPage';
  page.className='qualification-page';
  page.innerHTML=`
    <section class="qualification-hero">
      <div><p class="eyebrow">QUALIFYING TRACKER · 2026/27</p><h1>资格赛<span>战绩中心</span></h1><p>从第一轮到附加赛，集中查看累计表现、晋级路径、最终结果与联赛阶段席位。</p><div class="qualification-stamp"><i></i>数据核对至 2026-08-26 · UEFA官方最终结果</div></div>
      <div class="qualification-scoreboard"><article><b>90</b><span>已完成比赛</span></article><article><b>14</b><span>附加赛球队</span></article><article><b>7</b><span>联赛阶段席位</span></article><article><b>4 / 4</b><span>已完成轮次</span></article></div>
    </section>
    <section class="qualification-progress" aria-label="资格赛进度">
      <div class="progress-head"><div><p class="eyebrow">ROUND PROGRESS</p><h2>赛程进度</h2></div><strong>资格赛全部结束 · 7队晋级联赛阶段</strong></div>
      <div class="round-track">
        <article class="done"><span>01</span><div><b>第一轮</b><small>7月7–15日</small></div><em>28 / 28场</em></article>
        <i></i><article class="done"><span>02</span><div><b>第二轮</b><small>7月21–29日</small></div><em>28 / 28场</em></article>
        <i></i><article class="done"><span>03</span><div><b>第三轮</b><small>8月4/5、11日</small></div><em>20 / 20场</em></article>
        <i></i><article class="done"><span>04</span><div><b>附加赛</b><small>8月18/19、25/26日</small></div><em>14 / 14场</em></article>
      </div>
    </section>
    <section class="route-overview">
      <div class="section-title"><div><p class="eyebrow">QUALIFICATION ROUTES</p><h2>出线形式</h2></div><span>第三轮 → 附加赛 → 联赛阶段</span></div>
      <div class="route-grid">
        <article class="route-card champion-path"><header><span>CHAMPIONS PATH</span><b>冠军路径</b></header><div class="route-numbers"><p><b>12</b><span>第三轮球队</span></p><i>→</i><p><b>6</b><span>晋级附加赛</span></p><i>→</i><p><b>5</b><span>联赛阶段席位</span></p></div><small>第三轮负者转入欧联杯附加赛；附加赛负者直接进入欧联杯联赛阶段。</small></article>
        <article class="route-card league-path"><header><span>LEAGUE PATH</span><b>联赛路径</b></header><div class="route-numbers"><p><b>8</b><span>第三轮球队</span></p><i>→</i><p><b>4</b><span>晋级附加赛</span></p><i>→</i><p><b>2</b><span>联赛阶段席位</span></p></div><small>第三轮负者直接进入欧联杯联赛阶段；附加赛负者同样进入欧联杯联赛阶段。</small></article>
      </div>
    </section>
    <section class="qualification-standings">
      <div class="section-title"><div><p class="eyebrow">PERFORMANCE TABLE</p><h2>资格赛表现榜</h2></div><div class="qualification-filters" role="group" aria-label="筛选资格赛表现榜"><button class="active" data-filter="all">全部球队</button><button data-filter="active">仍在欧冠</button><button data-filter="冠军路径">冠军路径</button><button data-filter="联赛路径">联赛路径</button></div></div>
      <p class="table-note">统计资格赛已完成比赛，按积分、净胜球、进球数排序；仅用于比较表现，不代表淘汰赛官方排名。</p>
      <div class="qualification-table-wrap"><table><thead><tr><th>#</th><th>球队</th><th>路径</th><th>赛</th><th>胜</th><th>平</th><th>负</th><th>进/失</th><th>净胜</th><th>积分</th><th>当前状态</th></tr></thead><tbody id="qualificationStandings"></tbody></table></div>
    </section>
    <section class="qualification-schedule">
      <div class="section-title"><div><p class="eyebrow">PLAY-OFF RESULTS</p><h2>附加赛完整赛果</h2></div><span>全部为北京时间 · 共14场</span></div>
      <div class="schedule-tabs" role="group" aria-label="筛选资格赛赛程"><button class="active" data-path="all">全部</button><button data-path="冠军路径">冠军路径</button><button data-path="联赛路径">联赛路径</button></div>
      <div id="qualificationFixtures" class="qualification-fixtures"></div>
    </section>
    <footer class="qualification-sources"><div><b>数据来源</b><span>比赛结果、晋级路径和最终席位均以UEFA官方资格赛最终结果为准；表现榜由本站根据90场已完成比赛自动计算。</span></div><a href="https://www.uefa.com/uefachampionsleague/news/02a6-20e5a8be4e63-ae971c582f8c-1000--champions-league-qualifying-results-how-it-worked/" target="_blank" rel="noopener">UEFA官方资格赛最终结果 ↗</a></footer>`;
  document.querySelector('main').appendChild(page);

  const name=team=>teamChineseName(team);
  const active=new Set([...qualificationActiveChampion,...qualificationActiveLeague]);
  const secondRoundTeams=new Set(qualificationResults.filter(match=>match[1]==='第二轮').flatMap(match=>[match[3],match[4]]));
  const thirdRoundTeams=new Set(qualificationResults.filter(match=>match[1]==='第三轮').flatMap(match=>[match[3],match[4]]));
  const paths={};
  qualificationResults.forEach(match=>{paths[match[3]]=match[2];paths[match[4]]=match[2]});
  qualificationActiveChampion.forEach(team=>paths[team]='冠军路径');
  qualificationActiveLeague.forEach(team=>paths[team]='联赛路径');
  const stats={};
  const ensure=team=>stats[team]||(stats[team]={team,p:0,w:0,d:0,l:0,gf:0,ga:0,pts:0,path:paths[team]||'冠军路径'});
  qualificationResults.forEach(([,round,path,home,away,hg,ag])=>{
    const h=ensure(home),a=ensure(away);h.path=path;a.path=path;h.p++;a.p++;h.gf+=hg;h.ga+=ag;a.gf+=ag;a.ga+=hg;
    if(hg>ag){h.w++;h.pts+=3;a.l++}else if(hg<ag){a.w++;a.pts+=3;h.l++}else{h.d++;a.d++;h.pts++;a.pts++}
  });
  [...qualificationActiveChampion,...qualificationActiveLeague].forEach(ensure);
  const ranking=Object.values(stats).sort((a,b)=>b.pts-a.pts||(b.gf-b.ga)-(a.gf-a.ga)||b.gf-a.gf||a.team.localeCompare(b.team));
  const tbody=page.querySelector('#qualificationStandings');
  function renderTable(filter='all'){
    const filtered=ranking.filter(row=>filter==='all'||filter==='active'&&active.has(row.team)||row.path===filter);
    tbody.innerHTML=filtered.map((row,index)=>{const gd=row.gf-row.ga;const state=active.has(row.team)?'联赛阶段':thirdRoundTeams.has(row.team)?'转入欧联杯':secondRoundTeams.has(row.team)?'转入欧联杯':'转入欧协联';return `<tr class="${active.has(row.team)?'is-active':''}"><td>${index+1}</td><td><strong>${name(row.team)}</strong><small>${row.team}</small></td><td><span class="path-tag ${row.path==='联赛路径'?'league':''}">${row.path}</span></td><td>${row.p}</td><td>${row.w}</td><td>${row.d}</td><td>${row.l}</td><td>${row.gf}–${row.ga}</td><td>${gd>0?'+':''}${gd}</td><td><b class="table-points">${row.pts}</b></td><td><span class="state-tag ${active.has(row.team)?'active':''}">${state}</span></td></tr>`}).join('');
  }
  const renderTableBase=renderTable;
  renderTable=function(filter='all'){
    renderTableBase(filter);
    const filtered=ranking.filter(row=>filter==='all'||filter==='active'&&active.has(row.team)||row.path===filter);
    tbody.querySelectorAll('tr').forEach((row,index)=>{const cell=row.children[1],team=filtered[index]?.team;if(cell&&team){cell.classList.add('qualification-club-cell');cell.insertAdjacentHTML('afterbegin',teamLogoMarkup(team,'qualification'))}});
  };
  renderTable();
  page.querySelectorAll('.qualification-filters button').forEach(button=>button.addEventListener('click',()=>{page.querySelectorAll('.qualification-filters button').forEach(item=>item.classList.toggle('active',item===button));renderTable(button.dataset.filter)}));

  const fixtures=page.querySelector('#qualificationFixtures');
  function renderFixtures(path='all'){
    const list=qualificationFixtures.filter(match=>path==='all'||match[3]===path);
    const days=[...new Set(list.map(match=>match[0]))];
    fixtures.innerHTML=days.map(date=>`<article class="fixture-day"><header><time>${date}</time><span>${new Intl.DateTimeFormat('zh-CN',{weekday:'long'}).format(new Date(date+'T12:00:00+08:00'))}</span></header>${list.filter(match=>match[0]===date).map(([,time,round,route,home,away])=>{const result=qualificationResults.find(item=>item[3]===home&&item[4]===away);return `<div class="qual-match"><time>${time}</time><span class="path-tag ${route==='联赛路径'?'league':''}">${route}</span><strong>${name(home)}<small>${home}</small></strong><i>${result?`${result[5]}–${result[6]}`:'VS'}</i><strong>${name(away)}<small>${away}</small></strong><em>${result?'已结束':round.replace(/^(第三轮|附加赛)·/,'')}</em></div>`}).join('')}</article>`).join('');
  }
  const renderFixturesBase=renderFixtures;
  renderFixtures=function(path='all'){
    renderFixturesBase(path);
    const list=qualificationFixtures.filter(match=>path==='all'||match[3]===path);
    fixtures.querySelectorAll('.qual-match').forEach((card,index)=>{const match=list[index],clubs=card.querySelectorAll('strong');if(!match||clubs.length<2)return;[[clubs[0],match[4]],[clubs[1],match[5]]].forEach(([node,team])=>{node.classList.add('qualification-fixture-club');node.innerHTML=`${teamLogoMarkup(team,'qualification')}<span>${name(team)}<small>${team}</small></span>`})});
  };
  renderFixtures();
  page.querySelectorAll('.schedule-tabs button').forEach(button=>button.addEventListener('click',()=>{page.querySelectorAll('.schedule-tabs button').forEach(item=>item.classList.toggle('active',item===button));renderFixtures(button.dataset.path)}));

  const button=document.querySelector('#qualificationBtn');
  button.addEventListener('click',()=>{
    document.querySelectorAll('nav button').forEach(item=>item.classList.toggle('active',item===button));
    ['.hero','.layout','.results'].forEach(selector=>document.querySelector(selector).style.display='none');
    document.querySelector('#schedulePage')?.classList.remove('active');
    document.querySelector('#competitionInfo')?.classList.remove('active');
    document.querySelector('#advancementPage')?.classList.remove('active');
    page.classList.add('active');
    window.scrollTo({top:0,behavior:'smooth'});
  });
})();
