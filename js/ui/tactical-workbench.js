/* Match-specific editorial analysis. Never adjusts the numerical forecast. */
(function () {
  const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const state = { mode:'analysis', fixtureId:'', drafts:{}, selected:[], snapshotId:'', message:'', messageError:false };
  let host, catalog, fixtures = [], report = null, journal = null, storageError = '', baseline = null, lastContext = null;
  const $ = selector => host?.querySelector(selector);
  const freshLineup = () => ({status:'unknown',formation:'',players:'',roles:'',source:'',checkedAt:''});
  const pairKey = f => [f.date,f.home,f.away].join('|');
  const datetime = value => value ? new Date(value).toLocaleString('zh-CN',{timeZone:'Asia/Shanghai',hour12:false}) : '未知';
  const kind = {observation:'实际观察',intent:'教练意图',background:'历史背景',hypothesis:'待验证假设'};
  const verdictNames = {unknown:'未知 / 无证据',supported:'获得支持',contradicted:'未获支持 / 相反'};
  const statusName = value => ({candidate:'条件候选',conditional:'条件候选',historical:'历史参考',insufficient:'证据不足',unknown:'待核查','historical-conditional':'历史条件候选'})[value] || value || '待核查';
  function localTime(iso) { return iso ? new Date(Date.parse(iso) + 8*3600000).toISOString().slice(0,16) : ''; }
  function toKickoff(value) { return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value || '') ? new Date(value + ':00+08:00').toISOString() : null; }
  function knownKickoff(row) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(row.date || '') || !/^\d{2}:\d{2}$/.test(row.time || '')) return null;
    const value = Date.parse(row.date + 'T' + row.time + ':00+08:00');
    return Number.isFinite(value) ? new Date(value).toISOString() : null;
  }
  function readFixtures() {
    const list = typeof uclLeaguePhaseSchedule === 'undefined' ? [] : uclLeaguePhaseSchedule;
    const feed = window.getUclLeaguePhaseFeed?.() || {upcoming:[],live:[]};
    const canonical = name => window.canonicalTeamName ? canonicalTeamName(name) : name;
    const rows = new Map(list.map((row,i) => {
      const f = {season:window.uclSeason.key,date:row[0],home:canonical(row[1]),away:canonical(row[2]),round:Math.floor(i/18)+1,time:'',status:'scheduled',timeSource:''};
      return [f.home+'|'+f.away,f];
    }));
    for (const row of feed.upcoming || []) {
      const key = canonical(row.home)+'|'+canonical(row.away);
      if (rows.has(key)) rows.set(key,{...rows.get(key),...row,home:canonical(row.home),away:canonical(row.away),timeSource:'网站已同步赛程 · 北京时间（未重新核查）'});
    }
    for (const row of feed.live || []) {
      const key = canonical(row.home)+'|'+canonical(row.away);
      if (rows.has(key)) rows.set(key,{...rows.get(key),status:'in-progress'});
    }
    if (typeof matches !== 'undefined') for (const row of matches.filter(row=>row[5]==='league')) {
      const key = canonical(row[1])+'|'+canonical(row[2]);
      if (rows.has(key)) rows.set(key,{...rows.get(key),date:row[0],status:'completed',score:row[3]});
    }
    return [...rows.values()].filter(f=>catalog.get(f.home)&&catalog.get(f.away)).map(f=>({...f,id:[f.season,catalog.get(f.home).id,catalog.get(f.away).id,f.date].join(':'),homeId:catalog.get(f.home).id,awayId:catalog.get(f.away).id,kickoff:knownKickoff(f)})).sort((a,b)=>a.date.localeCompare(b.date)||a.id.localeCompare(b.id));
  }
  function fixture() { return fixtures.find(f=>f.id===state.fixtureId); }
  function draft() {
    if (!state.drafts[state.fixtureId]) {
      const f=fixture(); state.drafts[state.fixtureId]={home:freshLineup(),away:freshLineup(),kickoff:localTime(f?.kickoff),timeSource:f?.timeSource||'',notes:''};
    }
    return state.drafts[state.fixtureId];
  }
  function getJournal() {
    if (!journal) {
      try { journal=window.UclTacticalJournal.createJournal({storage:window.localStorage}); storageError=''; }
      catch(error) { storageError=error.message; }
    }
    return journal;
  }
  function showMessage(message,error=false) {
    state.message=message; state.messageError=error;
    if ($('#workbenchMessage')) { $('#workbenchMessage').textContent=message; $('#workbenchMessage').classList.toggle('error',error); }
  }
  function matchingBaseline() {
    const f=fixture(), current=window.UclPredictorPage?.getForecast?.();
    if (current?.fixture && f && pairKey(current.fixture)===pairKey(f)) return current;
    if (baseline?.fixture && f && pairKey(baseline.fixture)===pairKey(f)) return baseline;
    return null;
  }
  function currentFixture() {
    const f=fixture(), d=draft();
    const latest=readFixtures().find(row=>row.homeId===f.homeId&&row.awayId===f.awayId);
    if(latest&&latest.date!==f.date)throw new Error('该场赛程日期已经变化，请重新进入工作台并核对开球时间，再保存快照。');
    return {...f,status:latest?.status||f.status,kickoff:toKickoff(d.kickoff),timeSource:d.timeSource.trim()};
  }
  function compute() {
    const f=currentFixture(), d=draft();
    const entries=value=>String(value||'').split(/[,，;；\n]/).map(row=>row.trim()).filter(Boolean);
    const normalized=side=>({...d[side],players:entries(d[side].players),roles:entries(d[side].roles),checkedAt:toKickoff(d[side].checkedAt)||''});
    report=window.UclTacticalAnalysis.analyze({home:catalog.get(f.homeId),away:catalog.get(f.awayId),framework:catalog.framework,fixture:f,asOf:new Date().toISOString(),lineups:{home:normalized('home'),away:normalized('away')}});
    return report;
  }
  function mount(container,options) {
    host=container; catalog=options.catalog;
    fixtures=readFixtures();
    if (options.context?.baseline) baseline=options.context.baseline;
    const incoming=options.context?.fixture;
    const desired=incoming && options.context!==lastContext && fixtures.find(f=>pairKey(f)===pairKey(incoming));
    lastContext=options.context;
    if (desired) state.fixtureId=desired.id;
    if (!fixtures.some(f=>f.id===state.fixtureId)) {
      const pair=fixtures.find(f=>f.homeId===options.homeId&&f.awayId===options.awayId);
      state.fixtureId=(pair||fixtures.find(f=>f.status==='scheduled'&&f.date>=new Date().toISOString().slice(0,10))||fixtures[0])?.id||'';
    }
    render();
  }
  function render() {
    host.innerHTML='<section class="tactical-workbench"><div class="wb-heading"><div><p class="eyebrow">MATCH LAB · V1.1</p><h3>推演有依据，复盘留痕迹。</h3><p>比赛形式与胜负方向分开记录；不确定的地方，保留未知。</p></div><span>概率模型保持 V1.0</span></div><div class="wb-tabs" role="group" aria-label="分析或复盘"><button type="button" data-wb-mode="analysis" aria-pressed="'+(state.mode==='analysis')+'">单场分析</button><button type="button" data-wb-mode="journal" aria-pressed="'+(state.mode==='journal')+'">快照与复盘</button></div><p id="workbenchMessage" class="wb-message'+(state.messageError?' error':'')+'" role="status" aria-live="polite">'+escape(state.message)+'</p><div id="workbenchContent"></div></section>';
    if(state.mode==='journal') renderJournal(); else renderAnalysis();
    host.onclick=onClick; host.onchange=onChange; host.oninput=onInput; host.onsubmit=onSubmit;
  }
  function renderAnalysis() {
    if(!fixture()) { $('#workbenchContent').innerHTML='<p class="tactics-no-results">尚无可关联的本季联赛阶段赛程，请先检查赛程同步。</p>'; return; }
    const f=fixture(), d=draft(), home=catalog.get(f.homeId),away=catalog.get(f.awayId);
    $('#workbenchContent').innerHTML='<div class="wb-picker"><label>选择本赛季比赛<select id="workbenchFixture">'+fixtures.map(row=>'<option value="'+escape(row.id)+'"'+(row.id===f.id?' selected':'')+'>'+escape(row.date+' · '+(row.status==='completed'?'已完赛':row.status==='live'?'进行中':'待赛')+' · '+catalog.get(row.homeId).zh+' vs '+catalog.get(row.awayId).zh)+'</option>').join('')+'</select></label><p>已完赛场次仅可补记研究，不能生成历史赛前预测。</p></div><div class="wb-match"><div>'+teamLogoMarkup(home.name,'card')+'<span><b>'+escape(home.zh)+'</b><small>主队 · 档案 '+escape(home.revision||'1.0')+'</small></span></div><strong>VS</strong><div>'+teamLogoMarkup(away.name,'card')+'<span><b>'+escape(away.zh)+'</b><small>客队 · 档案 '+escape(away.revision||'1.0')+'</small></span></div></div><div class="wb-time-grid"><label>开球时间 · 北京时间<input id="workbenchKickoff" type="datetime-local" value="'+escape(d.kickoff)+'"></label><label>时间依据 / 核查出处<input id="workbenchTimeSource" maxlength="500" placeholder="准确时间不明时留空，不以日期猜测开球时间" value="'+escape(d.timeSource)+'"></label></div><details class="wb-lineup-panel"><summary>阵容情景与执行条件 · 默认未知</summary><p>预计与确认分开。以下为用户核查记录，不自动等同于官方首发；伤停与换帅不会由网站凭空补齐。</p><div class="wb-lineups">'+lineupMarkup('home',home,d.home)+lineupMarkup('away',away,d.away)+'</div><button type="button" data-wb-regenerate>应用情景，重新生成推演</button><small>仅作为条件注释，不改变数值概率。</small></details><div id="workbenchReport"></div><section class="wb-save"><h4>保存这个时点的判断</h4><label>分析备注<textarea id="workbenchNotes" maxlength="3000" rows="3" placeholder="记录赛前判断依据、反证或仍待核实的问题">'+escape(d.notes)+'</textarea></label><div id="workbenchBaseline"></div><div class="wb-actions"><button type="button" data-wb-baseline>读取本场数值基线</button><button type="button" class="primary" data-wb-save>保存快照</button><button type="button" data-wb-mode="journal">查看已有快照 →</button></div><small>只存当前浏览器，不自动上传。准确开球时间与出处必填；系统依据保存时点区分赛前快照与赛后研究。</small></section>';
    try { compute(); renderReport(); } catch(error) { $('#workbenchReport').innerHTML='<p class="wb-message error">'+escape(error.message)+'</p>'; }
    renderBaseline();
  }
  function lineupMarkup(side,team,row) {
    const input=(field,label,type='text')=>'<label>'+label+'<input data-wb-lineup="'+side+'" data-wb-field="'+field+'" type="'+type+'" maxlength="1000" value="'+escape(row[field])+'"></label>';
    return '<fieldset><legend>'+escape(team.zh)+'</legend><label>阵容状态<select data-wb-lineup="'+side+'" data-wb-field="status">'+[['unknown','未知 / 未核查'],['expected','预计阵容'],['confirmed','人工已核查确认']].map(([value,label])=>'<option value="'+value+'"'+(row.status===value?' selected':'')+'>'+label+'</option>').join('')+'</select></label>'+input('formation','阵型 / 结构')+input('players','预计或确认人员')+input('roles','关键角色与缺位影响')+input('source','来源 / 核查依据')+input('checkedAt','核查时间 · 北京时间','datetime-local')+'</fieldset>';
  }
  function mechanisms(data=report) { return (data?.directions || []).flatMap(direction=>direction.mechanisms || []); }
  function evidenceMarkup(row) {
    const refs=row.sourceRefs || row.sources || [];
    return '<li><b>'+escape(catalog.get(row.teamId)?.zh || row.teamId)+'</b> · '+escape(row.label || row.traitId)+'<small>'+escape(kind[row.kind] || row.kind || '资料类型待核')+' · '+escape(row.period || '观察日未知')+'</small><span>'+refs.map(source=>source.url&&/^https:\/\//.test(source.url)?'<a href="'+escape(source.url)+'" target="_blank" rel="noopener noreferrer">'+escape(source.title||source.id||'来源')+' ↗</a>':'').join(' ')+'</span>'+(row.limitations?.length?'<small>'+escape(Array.isArray(row.limitations)?row.limitations.join('；'):row.limitations)+'</small>':'')+'</li>';
  }
  function validateReport(data) {
    const strings=rows=>Array.isArray(rows)&&rows.every(row=>typeof row==='string');
    const object=row=>row&&typeof row==='object'&&!Array.isArray(row);
    const fail=()=>{throw new Error('对位报告版本或结构不兼容，未覆盖已有数据。请使用本工作台导出的完整备份。');};
    if(!object(data)||data.version!==window.UclTacticalAnalysis.VERSION||!Array.isArray(data.directions)||data.directions.length!==2||!strings(data.unknowns))fail();
    for(const direction of data.directions){
      if(!object(direction)||typeof direction.title!=='string'||!Array.isArray(direction.mechanisms)||direction.mechanisms.length>4||!strings(direction.unknowns))fail();
      for(const row of direction.mechanisms){
        if(!object(row)||typeof row.id!=='string'||typeof row.title!=='string'||!strings(row.conditions)||!strings(row.unknowns)||!strings(row.counterEvidence)||!Array.isArray(row.evidence)||!Array.isArray(row.branches))fail();
        for(const branch of row.branches)if(!object(branch)||typeof branch.condition!=='string'||typeof branch.form!=='string')fail();
        for(const evidence of row.evidence){
          if(!object(evidence)||!strings(evidence.limitations)||!Array.isArray(evidence.sourceRefs))fail();
          for(const source of evidence.sourceRefs){try{if(!object(source)||new URL(source.url).protocol!=='https:')fail();}catch{fail();}}
        }
      }
    }
    for(const name of ['control','transition','chances','goals'])if(!object(data.shape?.[name])||typeof data.shape[name].label!=='string'||typeof data.shape[name].text!=='string')fail();
    for(const name of ['main','alternative','scoreChange'])if(!object(data.scripts?.[name])||!strings(data.scripts[name].mechanismIds)||typeof data.scripts[name].form!=='string')fail();
    for(const side of ['home','away']){
      const coverage=data.coverage?.[side],lineup=data.lineups?.[side];
      if(!object(coverage)||!['total','current','conditional','excluded'].every(key=>Number.isInteger(coverage[key])&&coverage[key]>=0))fail();
      if(!object(lineup)||!strings(lineup.players)||!strings(lineup.roles)||!strings(lineup.limitations))fail();
      if(lineup.checkedAt!==null&&(!Number.isFinite(Date.parse(lineup.checkedAt))||typeof lineup.checkedAt!=='string'))fail();
    }
  }
  function baseReportMarkup(data,selectable=false) {
    const coverage=data.coverage || {}, shape=data.shape || {}, scripts=data.scripts || {};
    return '<div class="wb-coverage"><strong>证据完整度 · 不是胜率置信区间</strong><div>'+['home','away'].map(side=>{
      const row=coverage[side]||{}, team=data.teamRefs?.[side];
      return '<p><b>'+escape(team?.zh||catalog.get(fixture()?.[side+'Id'])?.zh||side)+'</b><span>观察 '+(row.total||0)+' · 本季有效 '+(row.current||0)+' · 条件参考 '+(row.conditional||0)+' · 排除 '+(row.excluded||0)+'</span><small>'+escape(row.notice||'资料缺失，不按平均球风处理。')+'</small></p>';
    }).join('')+'</div><p>'+escape(coverage.notice||'历史、过期与教练意图只能提供条件候选。')+'</p></div><div class="wb-directions">'+(data.directions||[]).map(direction=>'<section class="wb-direction"><p class="eyebrow">TWO-WAY MATCHUP</p><h4>'+escape(direction.title)+'</h4>'+(direction.mechanisms?.length?direction.mechanisms.map(row=>'<article class="wb-mechanism"><header><strong>'+escape(row.title)+'</strong><span>'+escape(statusName(row.status))+'</span></header>'+(selectable?'<label class="wb-hypothesis"><input type="checkbox" data-wb-hypothesis="'+escape(row.id)+'"'+(state.selected.includes(row.id)?' checked':'')+'> 纳入本次留档假设</label>':'')+'<p class="wb-condition">适用前提：'+escape((row.conditions||[]).join('；'))+'</p><ul class="wb-evidence">'+(row.evidence||[]).map(evidenceMarkup).join('')+'</ul><div class="wb-branches">'+(row.branches||[]).map(branch=>'<div><b>'+escape(branch.condition)+'</b><p>'+escape(branch.form)+'</p></div>').join('')+'</div>'+((row.counterEvidence||[]).length?'<p>反证 / 相反条件：'+escape(row.counterEvidence.join('；'))+'</p>':'')+((row.unknowns||[]).length?'<small>待核查：'+escape(row.unknowns.join('；'))+'</small>':'')+'</article>').join(''):'<p class="wb-no-evidence">双方尚无足够的明确对应证据，不生成确定对位结论。</p>')+((direction.unknowns||[]).length?'<ul class="wb-unknowns">'+direction.unknowns.map(line=>'<li>'+escape(line)+'</li>').join('')+'</ul>':'')+'</section>').join('')+'</div><section class="wb-shape"><h4>比赛形式 ≠ 胜负方向</h4><div>'+Object.values(shape).map(axis=>'<article><b>'+escape(axis.label)+'</b><p>'+escape(axis.text)+'</p></article>').join('')+'</div></section><section class="wb-scripts"><h4>三个条件式剧本 · 无发生率排序</h4><div>'+['main','alternative','scoreChange'].map(key=>{const row=scripts[key]||{};return '<article><span>'+escape(statusName(row.status))+'</span><h5>'+escape(row.title||key)+'</h5><b>'+escape(row.condition||'需更多证据')+'</b><p>'+escape(row.form||'资料不足，暂不生成剧本。')+'</p><small>关联机制：'+escape((row.mechanismIds||[]).join('、')||'无可用双向证据')+'</small></article>';}).join('')+'</div></section><details class="wb-limitations"><summary>反证、阵容条件与未知项（'+(data.unknowns||[]).length+'）</summary><ul>'+(data.unknowns||[]).map(line=>'<li>'+escape(line)+'</li>').join('')+'</ul><p>'+escape(data.lineups?.notice||'阵容情景只是执行条件，不是伤停事实或数值修正。')+'</p></details>';
  }
  function reportMarkup(data,selectable=false) {
    const states={unknown:'未知 / 未核查',expected:'预计阵容',confirmed:'人工核查确认 · 非官方自动验证'};
    return baseReportMarkup(data,selectable)+'<section class="wb-lineup-readout"><h4>本次阵容情景 · 不自动量化影响</h4><div>'+['home','away'].map(side=>{
      const row=data.lineups?.[side]||{}, team=data.teamRefs?.[side];
      return '<article><b>'+escape(team?.zh||side)+'</b><span>'+escape(states[row.status]||states.unknown)+'</span><p>结构：'+escape(row.formation||'未知')+'</p><p>人员：'+escape((row.players||[]).join('、')||'未知')+'</p><p>关注角色：'+escape((row.roles||[]).join('；')||'待核查')+'</p><small>依据：'+escape(row.source||'未提供')+' · '+escape(datetime(row.checkedAt))+'</small><ul>'+(row.limitations||[]).map(line=>'<li>'+escape(line)+'</li>').join('')+'</ul></article>';
    }).join('')+'</div><p>情景只作为核查条件和留档注释，不依据阵型、角色文字自动推断相克，也不修正胜率。</p></section>';
  }
  function renderReport() {
    const ids=new Set(mechanisms().map(row=>row.id)); state.selected=state.selected.filter(id=>ids.has(id));
    $('#workbenchReport').innerHTML=reportMarkup(report,true);
    normalizeCardHeaders($('#workbenchReport'));
  }
  function normalizeCardHeaders(container) {
    // The existing site's global header styles are reserved for its navigation.
    container.querySelectorAll('.wb-mechanism > header').forEach(header=>{
      const title=document.createElement('div');title.className='wb-mechanism-title';
      while(header.firstChild)title.appendChild(header.firstChild);
      header.replaceWith(title);
    });
  }
  function renderBaseline() {
    const saved=matchingBaseline();
    $('#workbenchBaseline').innerHTML=saved?'<p class="wb-baseline">已关联本场 V1.0 数值基线 · 模型 '+escape(saved.prediction?.version)+' · 生成 '+escape(datetime(saved.generatedAt))+'。战术推演不改变该输出。</p>':'<p class="wb-baseline missing">当前未关联本场数值基线。可点击读取；无法读取时仍可保存研究档案，但不会伪造模型输出。</p>';
  }
  function renderJournal() {
    const store=getJournal(); let rows=[];
    try { if(store) rows=store.list().filter(row=>row.fixture?.season===window.uclSeason.key); }
    catch(error){storageError=error.message;}
    $('#workbenchContent').innerHTML='<div class="wb-journal-head"><div><h4>赛前快照与研究记录 <small>'+rows.length+' 条</small></h4><p>数据仅保存在当前浏览器；更换设备或清理浏览器前请导出备份。导入记录一律标为外部未验证。</p></div><div class="wb-actions"><button type="button" data-wb-export>导出备份</button><label class="wb-import">导入 JSON<input id="workbenchImport" type="file" accept="application/json,.json"></label></div></div>'+(storageError?'<p class="wb-message error">本地记录不可用：'+escape(storageError)+'。未覆盖或清空已有数据。</p>':'')+'<div class="wb-journal-list">'+(rows.length?rows.map(row=>'<button type="button" data-wb-snapshot="'+escape(row.id)+'" class="'+(row.id===state.snapshotId?'active':'')+'"><b>'+escape(catalog.get(row.fixture.homeId)?.zh||row.fixture.home)+' vs '+escape(catalog.get(row.fixture.awayId)?.zh||row.fixture.away)+'</b><span>'+escape(row.provenance==='imported-unverified'?'导入 · 未验证':row.actualType==='pre-match'?'本机赛前快照':'研究补记 · 非赛前')+'</span><small>'+escape(datetime(row.createdAt))+' · 复盘 '+(row.reviews?.length||0)+' 版</small></button>').join(''):'<p class="tactics-no-results">还没有快照。选择一场比赛，核查条件并保存当时的判断。</p>')+'</div><div id="workbenchSnapshot"></div>';
    if(rows.length){if(!rows.some(row=>row.id===state.snapshotId))state.snapshotId=rows[0].id;renderSnapshot();normalizeCardHeaders($('#workbenchSnapshot'));}
  }
  function renderSnapshot() {
    let saved;
    try{saved=getJournal()?.get(state.snapshotId);if(saved)validateReport(saved.report);}catch(error){showMessage(error.message,true);return;}
    if(!saved)return;
    const f=saved.fixture, recorded=mechanisms(saved.report), ids=[...new Set(recorded.map(row=>row.id))];
    $('#workbenchSnapshot').innerHTML='<article class="wb-snapshot"><div class="wb-snapshot-heading"><div><h4>'+escape(catalog.get(f.homeId)?.zh||f.home)+' vs '+escape(catalog.get(f.awayId)?.zh||f.away)+'</h4><p>'+escape(saved.provenance==='imported-unverified'?'导入资料，无法证明原始赛前时点':saved.actualType==='pre-match'?'本机赛前保存（非服务器时间认证）':'赛后 / 开赛后研究补记')+'</p></div><button type="button" data-wb-delete="'+escape(saved.id)+'">删除此记录</button></div><dl class="wb-stamps"><div><dt>真实保存时间</dt><dd>'+escape(datetime(saved.createdAt))+'</dd></div><div><dt>开球时间</dt><dd>'+escape(datetime(saved.kickoff))+'</dd></div><div><dt>模型 / 档案版本</dt><dd>'+escape(saved.modelVersion||'未关联数值基线')+' / '+escape(JSON.stringify(saved.profileRevisions))+'</dd></div></dl><p class="wb-saved-notes">'+escape(saved.notes||'未填写分析备注')+'</p><details><summary>查看冻结的分析、阵容与模型原值</summary>'+reportMarkup(saved.report,false)+'<pre class="wb-json">'+escape(JSON.stringify({lineups:saved.lineups,baseline:saved.baseline,selectedHypotheses:saved.selectedHypotheses},null,2))+'</pre></details><section class="wb-review-history"><h4>复盘修订记录</h4>'+(saved.reviews?.length?saved.reviews.map((review,i)=>'<article><b>第 '+(i+1)+' 版 · '+escape(datetime(review.createdAt))+'</b><p>实际比分 '+review.actual.homeGoals+'–'+review.actual.awayGoals+' · '+escape(review.actual.sourceType==='manual'?'用户手动录入':'网站赛果记录')+'</p><small>'+escape(review.actual.source)+'</small><ul>'+review.verdicts.map(row=>'<li>'+escape(recorded.find(m=>m.id===row.mechanismId)?.title||row.mechanismId)+'：'+escape(verdictNames[row.verdict])+' · '+escape(row.evidence||'暂无过程证据')+'</li>').join('')+'</ul><p>比赛形式：'+escape(verdictNames[review.form.verdict])+' · '+escape(review.form.evidence||'未知')+'</p><p>偏差原因：'+escape(review.errorCause||'待分析')+'</p><p>'+escape(review.notes||'')+'</p></article>').join(''):'<p>尚未复盘。机制对错与比分对错分别判断，不以赛果倒推比赛过程。</p>')+'</section>'+reviewForm(saved,ids,recorded)+'</article>';
  }
  function verdictSelect(id) { return '<select '+id+'>'+Object.entries(verdictNames).map(([value,label])=>'<option value="'+value+'">'+label+'</option>').join('')+'</select>'; }
  function reviewForm(saved,ids,recorded) {
    const available=Date.now()>=Date.parse(saved.kickoff)+120*60000;
    return '<form id="workbenchReviewForm" class="wb-review-form"><h4>新增复盘版本</h4><p>开球至少两小时后且确认完赛才能保存。没有过程资料时选“未知”，不会根据比分自动判断战术。</p>'+(!available?'<p class="wb-message">当前尚未到复盘开放时间；快照保持不变。</p>':'')+'<div class="wb-time-grid"><label>主队进球<input name="homeGoals" type="number" min="0" max="30" required></label><label>客队进球<input name="awayGoals" type="number" min="0" max="30" required></label><label>赛果来源<input name="actualSource" maxlength="1000" required placeholder="手动录入所依据的比赛报告或来源"></label><label class="wb-check"><input name="completed" type="checkbox" required> 我已核查比赛结束</label></div>'+ids.map((id,i)=>'<div class="wb-review-item"><strong>'+escape(recorded.find(row=>row.id===id)?.title||id)+'</strong><label>机制判断'+verdictSelect('data-wb-verdict="'+escape(id)+'"')+'</label><label>过程证据 / 反证<textarea data-wb-review-evidence="'+escape(id)+'" rows="2" maxlength="2000" placeholder="如触发条件、发生时段及证据来源；非比分本身"></textarea></label></div>').join('')+'<div class="wb-review-item"><label>比赛形式判断'+verdictSelect('name="formVerdict"')+'</label><label>比赛形式的过程证据<textarea name="formEvidence" maxlength="2000" rows="2"></textarea></label></div><label>偏差原因<input name="errorCause" maxlength="2000" placeholder="信息不足、执行变化、判断失误或偶然事件等"></label><label>复盘备注<textarea name="reviewNotes" maxlength="3000" rows="2"></textarea></label><button type="submit" class="primary"'+(!available?' disabled':'')+'>保存新复盘版本</button><small>复盘只追加，不覆盖赛前快照。手动填写的结果会保留手动来源标记。</small></form>';
  }
  async function onClick(event) {
    const button=event.target.closest('button'); if(!button)return;
    try {
      if(button.dataset.wbMode){state.mode=button.dataset.wbMode;render();return;}
      if(button.hasAttribute('data-wb-regenerate')){compute();renderReport();showMessage('已根据当前证据和阵容情景重新生成条件式推演，数值概率未变。');}
      if(button.hasAttribute('data-wb-baseline')){
        button.disabled=true;
        try{const next=await window.UclPredictorPage?.selectFixture(fixture());if(next?.fixture&&pairKey(next.fixture)===pairKey(fixture()))baseline=next;renderBaseline();showMessage(matchingBaseline()?'已关联本场原始数值基线，战术因素未参与计算。':'本场暂不在可预测待赛列表，仍可保存不含数值基线的研究记录。');}
        finally{button.disabled=false;}
      }
      if(button.hasAttribute('data-wb-save')){
        const f=currentFixture();
        if(!f.kickoff||!f.timeSource)throw new Error('请先填写准确开球时间及其依据。时间未知时，不推测开球时间或保存成赛前记录。');
        for(const side of ['home','away']){
          const row=draft()[side];
          if(row.status!=='unknown'&&(!row.source.trim()||!row.checkedAt))throw new Error('预计或确认阵容需要填写核查依据和时间；不明时请保留“未知”。');
          if(row.checkedAt&&Date.parse(toKickoff(row.checkedAt))>Date.now())throw new Error('阵容核查时间不能晚于当前时间。');
        }
        compute();renderReport();
        const store=getJournal();if(!store)throw new Error(storageError||'当前浏览器无法保存本地记录。');
        const d=draft(), current=matchingBaseline();
        const saved=store.saveSnapshot({fixture:f,report,profiles:[catalog.get(f.homeId),catalog.get(f.awayId)],lineups:report.lineups,baseline:current,selectedHypotheses:[...state.selected],notes:d.notes});
        state.snapshotId=saved.id;state.mode='journal';
        state.message=saved.actualType==='pre-match'?'已保存本机赛前快照；仅证明本机记录时点，不是服务器认证。':'已保存研究补记；不会标为历史赛前预测。';state.messageError=false;render();
      }
      if(button.dataset.wbSnapshot){state.snapshotId=button.dataset.wbSnapshot;renderJournal();}
      if(button.dataset.wbDelete&&window.confirm('删除此快照及其复盘？此操作仅影响当前浏览器，建议先导出备份。')){
        getJournal().remove(button.dataset.wbDelete);state.snapshotId='';showMessage('已从当前浏览器删除该快照及其复盘；已有导出备份不受影响。');renderJournal();
      }
      if(button.hasAttribute('data-wb-export')){
        const store=getJournal();if(!store)throw new Error(storageError||'无法读取本地记录。');
        const blob=new Blob([store.exportJSON()],{type:'application/json;charset=utf-8'}),url=URL.createObjectURL(blob),link=document.createElement('a');
        link.href=url;link.download='ucl-tactical-journal-'+new Date().toISOString().slice(0,10)+'.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);showMessage('已导出本地备份，文件可能包含你填写的备注和阵容信息，请妥善保存。');
      }
    }catch(error){showMessage(error.message,true);}
  }
  function onInput(event){
    const target=event.target;
    if(target.dataset.wbLineup)draft()[target.dataset.wbLineup][target.dataset.wbField]=target.value;
    if(target.id==='workbenchKickoff')draft().kickoff=target.value;
    if(target.id==='workbenchTimeSource')draft().timeSource=target.value;
    if(target.id==='workbenchNotes')draft().notes=target.value;
  }
  async function onChange(event){
    const target=event.target;onInput(event);
    if(target.id==='workbenchFixture'){state.fixtureId=target.value;state.selected=[];state.message='';render();}
    if(target.hasAttribute('data-wb-hypothesis')){const id=target.dataset.wbHypothesis;state.selected=target.checked?[...new Set([...state.selected,id])]:state.selected.filter(row=>row!==id);}
    if(target.id==='workbenchImport'&&target.files[0]){
      try{
        const file=target.files[0];if(file.size>8*1024*1024)throw new Error('备份超过8MB，已停止导入。');
        const store=getJournal();if(!store)throw new Error(storageError||'无法写入本地记录。');
        const raw=await file.text(), payload=JSON.parse(raw);
        if(!Array.isArray(payload.snapshots))throw new Error('备份结构错误，未修改本地记录。');
        payload.snapshots.forEach(row=>validateReport(row.report));
        store.importJSON(raw);showMessage('已合并导入，导入条目均标为外部未验证；不会冒充本机赛前快照。');renderJournal();
      }catch(error){showMessage(error.message,true);target.value='';}
    }
  }
  function onSubmit(event){
    if(event.target.id!=='workbenchReviewForm')return;event.preventDefault();
    try{
      const form=event.target, value=name=>form.elements.namedItem(name).value;
      const verdicts=Array.from(form.querySelectorAll('[data-wb-verdict]')).map(input=>({mechanismId:input.dataset.wbVerdict,verdict:input.value,evidence:Array.from(form.querySelectorAll('[data-wb-review-evidence]')).find(row=>row.dataset.wbReviewEvidence===input.dataset.wbVerdict)?.value||''}));
      getJournal().saveReview(state.snapshotId,{verdicts,form:{verdict:value('formVerdict'),evidence:value('formEvidence')},actual:{completed:form.elements.namedItem('completed').checked,homeGoals:Number(value('homeGoals')),awayGoals:Number(value('awayGoals')),source:value('actualSource'),sourceType:'manual'},errorCause:value('errorCause'),notes:value('reviewNotes')});
      showMessage('已追加一版复盘，原快照与之前复盘均保持不变。');renderSnapshot();normalizeCardHeaders($('#workbenchSnapshot'));
    }catch(error){showMessage(error.message,true);}
  }
  document.head.insertAdjacentHTML('beforeend','<link rel="stylesheet" href="css/tactical-workbench.css">');
  window.addEventListener('ucl:data-updated',()=>{
    if(host?.isConnected&&catalog&&state.mode==='analysis')showMessage('比赛数据已同步；保存时会重新核对比赛状态。手填情景与人工球风档案未被自动改写。');
  });
  window.UclTacticalWorkbench={mount,getReport:()=>report};
})();
