(function(){
  const seasons={
    '2026-27':{key:'2026-27',label:'2026/27',display:'2026 / 27',current:true,start:'2026-07-01',end:'2027-06-30',years:[2026,2027],previousLabel:'2025/26',status:'当前赛季',finalYear:'2027',finalVenue:'马德里大都会球场',finalDate:'2027年6月5日',historySeasons:['2023/24','2024/25','2025/26']},
    '2025-26':{key:'2025-26',label:'2025/26',display:'2025 / 26',current:false,start:'2025-07-01',end:'2026-06-30',years:[2025,2026],previousLabel:'2024/25',status:'已结束 · 完整归档',finalYear:'2026',finalVenue:'布达佩斯普斯卡什竞技场',finalDate:'2026年5月30日',historySeasons:['2023/24','2024/25','2025/26'],leaguePathQualifiers:['Benfica','Club Brugge']},
    '2024-25':{key:'2024-25',label:'2024/25',display:'2024 / 25',current:false,start:'2024-07-01',end:'2025-06-30',years:[2024,2025],previousLabel:'2023/24',status:'已结束 · 完整归档',finalYear:'2025',finalVenue:'慕尼黑安联球场',finalDate:'2025年5月31日',historySeasons:['2022/23','2023/24','2024/25'],leaguePathQualifiers:['Lille','Red Bull Salzburg']}
  };
  const requested=new URLSearchParams(location.search).get('season');
  let saved='';try{saved=localStorage.getItem('ucl-selected-season')||''}catch(error){}
  const key=seasons[requested]?requested:seasons[saved]?saved:'2026-27',meta=seasons[key];
  window.uclSeasons=seasons;window.uclSeason=meta;document.documentElement.dataset.season=key;document.documentElement.classList.toggle('archive-season',!meta.current);
  try{localStorage.setItem('ucl-selected-season',key)}catch(error){}
  const picker=document.querySelector('.season');
  if(picker){
    picker.innerHTML=`<button class="season-trigger" type="button" aria-haspopup="listbox" aria-expanded="false"><span>${meta.display}</span><i>⌄</i></button><div class="season-menu" role="listbox" aria-label="选择欧冠赛季" hidden>${Object.values(seasons).map(item=>`<button class="season-option" type="button" role="option" data-season="${item.key}" aria-selected="${item.key===key}"><strong>${item.display}</strong><small>${item.status}</small><span>${item.key===key?'✓':''}</span></button>`).join('')}</div>`;
    const trigger=picker.querySelector('.season-trigger'),menu=picker.querySelector('.season-menu');
    const close=()=>{picker.classList.remove('open');menu.hidden=true;trigger.setAttribute('aria-expanded','false')};
    trigger.onclick=()=>{const open=menu.hidden;menu.hidden=!open;picker.classList.toggle('open',open);trigger.setAttribute('aria-expanded',String(open));if(open)menu.querySelector('[aria-selected=true]')?.focus()};
    menu.querySelectorAll('.season-option').forEach(option=>option.onclick=()=>{if(option.dataset.season===key){close();return}const active=document.querySelector('nav button.active'),view=active?.id||'standings';try{sessionStorage.setItem('ucl-return-view',view)}catch(error){}const url=new URL(location.href);url.searchParams.set('season',option.dataset.season);url.hash='';location.assign(url)});
    document.addEventListener('click',event=>{if(!picker.contains(event.target))close()});
    picker.addEventListener('keydown',event=>{
      if(event.key==='Escape'){close();trigger.focus()}
      if(['ArrowDown','ArrowUp','Home','End'].includes(event.key)&&!menu.hidden){
        event.preventDefault();const options=[...menu.querySelectorAll('.season-option')],index=options.indexOf(document.activeElement);
        const next=event.key==='Home'?0:event.key==='End'?options.length-1:(index+(event.key==='ArrowDown'?1:-1)+options.length)%options.length;options[next].focus();
      }
    });
  }
  window.uclApplySeasonCopy=()=>{
    document.title=`UCL 36 · ${meta.label}欧冠数据中心`;
    const desc=document.querySelector('.hero .desc');if(desc)desc.textContent=`追踪${meta.label}欧冠资格赛、36队联赛阶段、完整赛果、晋级路线与球队详情。`;
    const heroSeason=document.querySelector('.hero-stat small');if(heroSeason)heroSeason.textContent=`${meta.label}赛季`;
    const infoEyebrow=document.querySelector('#competitionInfo .info-hero .eyebrow');if(infoEyebrow)infoEyebrow.textContent=`THE COMPETITION · ${meta.label}`;
    const route=document.querySelector('#competitionInfo .season-route');if(route)route.innerHTML=`<span>${meta.label}赛季</span><i></i><strong>${meta.finalDate}</strong><small>${meta.finalVenue}决赛</small>`;
    const finalCard=document.querySelector('.pulse .top');if(finalCard)finalCard.innerHTML=`<span>${meta.finalYear}决赛</span><strong>${meta.finalVenue} <i>${meta.finalDate.replace(/^\d{4}年/,'')}</i></strong>`;
    const intro=document.querySelector('#competitionTitle+p');if(intro)intro.textContent=`从资格赛、36队联赛阶段到${meta.finalVenue}决赛，了解赛制路径、抽签原则与奖金分配。`;
    const finalFact=document.querySelector('.info-facts article:last-child small');if(finalFact)finalFact.textContent=meta.finalDate+' · '+meta.finalVenue;
    const finalRoute=document.querySelector('.knockout-route>div:nth-of-type(4) small');if(finalRoute)finalRoute.textContent=meta.finalVenue+' · 单场';
    if(!meta.current){
      const info=document.querySelector('.info-sources span');if(info)info.textContent=`赛事结构：${meta.label}赛季；奖金图保留2025/26预计口径供参考，并非所选赛季实际结算。`;
      document.querySelectorAll('.info-sources a:not(:last-child),.table-card .data-source-panel a').forEach(link=>{link.href='https://www.uefa.com/uefachampionsleague/history/';link.textContent='UEFA 历史赛季资料 ↗'});
      const latest=document.querySelector('#latest h2');if(latest)latest.textContent='赛季末赛果';
      const sources=document.querySelector('#latest .data-source-panel');if(sources)sources.innerHTML='<b>历史赛果来源</b><span>历史比赛归档；日期沿用原始记录，未核实的点球、事件与历史排名不作推断。</span><a href="https://github.com/harryji168/email_solutions-sports/tree/main/public/sports/leagues/UEFA_CL" target="_blank" rel="noopener">历史比赛数据 ↗</a><a href="https://www.uefa.com/uefachampionsleague/history/" target="_blank" rel="noopener">UEFA 历史赛季 ↗</a>';
      const legend=document.querySelector('.history-legend');if(legend&&meta.previousLabel==='2023/24')legend.textContent='2023/24为小组赛制，没有统一的36队排名；不计算跨赛制升降。';
    }
  };
  window.uclRestoreSeasonView=()=>{let view='';try{view=sessionStorage.getItem('ucl-return-view')||'';sessionStorage.removeItem('ucl-return-view')}catch(error){}if(view&&view!=='standings')setTimeout(()=>document.getElementById(view)?.click(),80)};
  window.uclApplySeasonCopy();
})();
