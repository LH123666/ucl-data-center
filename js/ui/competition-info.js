(function(){
  const infoBtn=document.querySelector('#infoBtn');
  const infoPage=document.querySelector('#competitionInfo');
  const qualificationBtn=document.querySelector('#qualificationBtn');
  const qualificationPage=()=>document.querySelector('#qualificationPage');
  const advancementPage=()=>document.querySelector('#advancementPage');
  const schedulePage=document.querySelector('#schedulePage');
  const regularViews=['.hero','#leaguePhaseHub','.layout','.results'];
  const setActive=button=>{document.querySelectorAll('nav button').forEach(item=>item.classList.toggle('active',item===button))};
  const hideInfo=()=>infoPage.classList.remove('active');
  infoBtn.addEventListener('click',()=>{
    setActive(infoBtn);
    regularViews.forEach(selector=>document.querySelector(selector).style.display='none');
    schedulePage.classList.remove('active');
    qualificationPage()?.classList.remove('active');
    advancementPage()?.classList.remove('active');
    infoPage.classList.add('active');
    window.scrollTo({top:0,behavior:'smooth'});
  });
  document.querySelectorAll('nav button:not(#infoBtn):not(#qualificationBtn):not(#advancementBtn)').forEach(button=>button.addEventListener('click',()=>{
    hideInfo();
    qualificationPage()?.classList.remove('active');
    advancementPage()?.classList.remove('active');
    if(button.id==='latestBtn')setTimeout(()=>document.querySelector('#latest').scrollIntoView({behavior:'smooth'}),0);
  }));

  const map=document.querySelector('#advancementMap');
  const detail=document.querySelector('#pathDetail');
  const copy={
    all:'资格赛四轮先产生7支晋级球队，与29支直入球队组成36队联赛阶段；前8名直通16强，9–24名再争夺另外8个席位。',
    qualifying:'资格赛从第一轮开始，第二轮起分为冠军路径和联赛路径；经过四轮两回合淘汰赛后，7支附加赛胜者进入联赛阶段。',
    league:'29支球队直接进入联赛阶段，另有7支球队从资格赛突围。36队统一排名，每队面对8个不同对手。',
    playoff:'第9–16名为种子队，对阵第17–24名，原则上次回合主场作战；8组两回合对决产生8支胜者。',
    knockout:'前8名与附加赛8支胜者组成16强。16强至半决赛为两回合淘汰，决赛在马德里单场决胜。'
  };
  document.querySelectorAll('.path-controls button').forEach(button=>button.addEventListener('click',()=>{
    document.querySelectorAll('.path-controls button').forEach(item=>item.classList.toggle('active',item===button));
    map.dataset.stage=button.dataset.stage;
    detail.textContent=copy[button.dataset.stage];
  }));
})();
