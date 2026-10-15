(function () {
  const nav=document.querySelector('header nav'), main=document.querySelector('main');
  if(!nav||!main||!window.UclPredictionBaseline)return;
  document.head.insertAdjacentHTML('beforeend','<link rel="stylesheet" href="css/prediction-page.css">');
  const button=document.createElement('button');
  button.id='predictorBtn';button.type='button';button.textContent='预测实验室';nav.appendChild(button);
  const page=document.createElement('section');
  page.id='predictorPage';page.className='predictor-page';page.setAttribute('aria-labelledby','predictorTitle');
  page.innerHTML=[
    '<div class="predictor-hero"><div><p class="eyebrow">UCL PREDICTOR · VERSION 1</p><h1 id="predictorTitle">比赛预测<span>实验室</span></h1><p>查看待赛比赛的胜平负、预计进球与可能比分，结合历史回测了解模型表现。</p></div><div class="predictor-version"><strong>V1.0</strong><span>历史赛果 · 进球概率模型</span><small>90 分钟常规时间</small></div></div>',
    '<div class="predictor-content"><div class="predictor-tabs" role="group" aria-label="预测实验室视图"><button type="button" class="active" data-predictor-view="forecast" aria-pressed="true">单场预测</button><button type="button" data-predictor-view="backtest" aria-pressed="false">历史回测</button><button type="button" data-predictor-view="tactics" aria-pressed="false">球风与对位</button></div>',
    '<section id="predictorForecast"><div class="predictor-notice"><strong>数据范围</strong><span>使用历史比分和主客场因素；样本少的球队采用保守估计。预计进球是模型输出，尚未包含 xG、阵容与伤停。</span></div>',
    '<div class="predictor-picker"><div><p class="eyebrow">UPCOMING MATCHES</p><h2>选择待赛场次</h2><small id="predictorFixtureCount">正在读取赛程…</small></div><div class="predictor-filters"><label>比赛日<select id="predictorRound"><option value="all">全部比赛日</option>'+Array.from({length:8},(_,i)=>'<option value="'+(i+1)+'">MD'+(i+1)+'</option>').join('')+'</select></label><label>搜索球队<input id="predictorSearch" type="search" placeholder="中文或英文球队名"></label></div></div>',
    '<div id="predictorFixtures" class="predictor-fixtures"></div><label class="predictor-select-label" for="predictorFixture">当前比赛<select id="predictorFixture" aria-label="选择需要预测的欧冠比赛"></select></label><div id="predictorOutput" aria-live="polite"></div></section>',
    '<section id="predictorBacktest" hidden aria-labelledby="predictorBacktestTitle"><div class="predictor-section-heading"><div><p class="eyebrow">OUT-OF-SAMPLE EVALUATION</p><h2 id="predictorBacktestTitle">历史回测</h2></div><label>评估赛季<select id="predictorTestSeason"><option value="all">两季合计</option><option value="2024-25">2024/25</option><option value="2025-26">2025/26</option></select></label></div><div id="predictorBacktestOutput"></div></section>',
    '<section id="predictorTactics" hidden aria-label="球队球风档案、战术对位与比赛剧本"></section>',
    '<section id="predictorFoundation" hidden aria-label="预测数据审计、球员身份与阵容数据库"></section>',
    '<section id="predictorValidation" hidden aria-label="赛前冻结、赛后评分、候选模型更新与大小球误差诊断"></section>',
    '<details class="predictor-method"><summary>查看模型方法与数据来源</summary><div class="predictor-method-grid"><div><h3>如何计算</h3><p>历史小组／联赛阶段比分按时间衰减，估计球队攻防水平与主客场进球率。样本不足时向赛事平均值收缩，胜平负和可能比分由同一进球分布推导。球风档案是独立研究资料，尚未调整这些概率。</p></div>',
    '<div><h3>如何回测</h3><p>参数只在 2023/24 选择。2024/25、2025/26 每场比赛只读取更早日历日期的结果；同日比赛全部排除。数据属于事后取得的赛果重建，原始发布时间不可验证。</p></div>',
    '<div><h3>如何更新</h3><p>点击网站“更新数据”后，预测随已核验赛果重新计算。当天结果在次日纳入，以保持日期隔离。历史赛季展示回测，用户手填预测继续保存在当前设备。</p></div></div>',
    '<p class="predictor-sources">历史模型数据：<a href="https://github.com/openfootball/champions-league" target="_blank" rel="noopener">OpenFootball · CC0</a> · <a href="js/data/prediction/OPENFOOTBALL-LICENSE.txt" target="_blank" rel="noopener">许可文本</a>。资格赛、淘汰赛加时及点球未纳入第一版模型；结果用于比赛分析。</p></details></div>'
  ].join('');
  main.appendChild(page);
  const api=window.UclPredictionBaseline;
  const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const percent=n=>(n*100).toFixed(1)+'%';
  const today=()=>{
    const parts=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date()).filter(p=>p.type!=='literal').map(p=>[p.type,p.value]));
    return parts.year+'-'+parts.month+'-'+parts.day;
  };
  const pairing=(h,a)=>canonicalTeamName(h)+'|'+canonicalTeamName(a);
  const key=f=>[window.uclSeason.key,f.date,f.home,f.away].join('|');
  let artifactsPromise=null,selectedKey='',generation=0,seed=null,report=null,lastPrediction=null,lastModelContext=null;
  const $=selector=>page.querySelector(selector);
  async function artifacts(){
    if(!artifactsPromise)artifactsPromise=Promise.all(['model','backtest'].map(async name=>{
      const response=await fetch('js/data/prediction/'+name+'.json');
      if(!response.ok)throw new Error('模型数据加载失败');
      return response.json();
    })).then(([model,evaluation])=>{
      if(model.version!==api.VERSION||evaluation.version!==api.VERSION||!Array.isArray(model.teams)||evaluation.evaluation?.model?.matches!==288)throw new Error('模型版本或回测资料不匹配');
      seed=model;report=evaluation;return {seed,report};
    }).catch(error=>{artifactsPromise=null;throw error});
    return artifactsPromise;
  }
  function fixtures(){
    const feed=window.getUclLeaguePhaseFeed?.()||{upcoming:[],live:[]};
    const schedule=typeof uclLeaguePhaseSchedule==='undefined'?[]:uclLeaguePhaseSchedule;
    const catalog=new Set(teams.map(row=>canonicalTeamName(row[1])));
    const finished=new Set(matches.filter(row=>row[5]==='league').map(row=>pairing(row[1],row[2])));
    const inPlay=new Set(feed.live.map(row=>pairing(row.home,row.away)));
    const rounds=new Map(schedule.map((row,i)=>[pairing(row[1],row[2]),Math.floor(i/18)+1]));
    const candidates=new Map(schedule.map((row,i)=>[pairing(row[1],row[2]),{date:row[0],home:canonicalTeamName(row[1]),away:canonicalTeamName(row[2]),time:'',round:Math.floor(i/18)+1}]));
    for(const row of feed.upcoming){
      const h=canonicalTeamName(row.home),a=canonicalTeamName(row.away);
      if(catalog.has(h)&&catalog.has(a))candidates.set(pairing(h,a),{...row,home:h,away:a,round:rounds.get(pairing(h,a))||0});
    }
    const day=today(),now=Date.now();
    return [...candidates.values()].filter(row=>{
      if(finished.has(pairing(row.home,row.away))||inPlay.has(pairing(row.home,row.away)))return false;
      if(row.date>day)return true;
      if(row.date!==day||!row.time)return false;
      const time=/^(\d{2}):(\d{2})$/.exec(row.time.split('/')[0]);
      return Boolean(time&&Number(time[1])<24&&Number(time[2])<60&&Date.parse(row.date+'T'+time[0]+':00+08:00')>now);
    }).sort((a,b)=>(a.date+a.time).localeCompare(b.date+b.time));
  }
  function currentRows(){
    return matches.filter(row=>row[5]==='league').map(row=>({season:window.uclSeason.key,date:row[0],home:canonicalTeamName(row[1]),away:canonicalTeamName(row[2]),score:row[3],stage:row[5]}));
  }
  function shownPercentages(result){
    const labels=['home','draw','away'],tenths=labels.map(k=>Math.floor(result[k]*1000));
    const order=labels.map((k,i)=>({i,fraction:result[k]*1000-tenths[i]})).sort((a,b)=>b.fraction-a.fraction);
    for(let n=1000-tenths.reduce((a,b)=>a+b,0),i=0;n>0;n--,i++)tenths[order[i%3].i]++;
    return Object.fromEntries(labels.map((k,i)=>[k,(tenths[i]/10).toFixed(1)+'%']));
  }
  function bar(label,value,tone,shown){
    return '<div class="predictor-bar"><div><span>'+label+'</span><strong>'+shown+'</strong></div><i class="'+tone+'" style="--value:'+Math.min(100,value*100)+'%"></i></div>';
  }
  function savedPredictions(f){
    try{return (JSON.parse(localStorage.getItem('ucl36-match-predictions-v1-'+window.uclSeason.key)||'{}')[[f.date,f.home,f.away].join('|')]||[]).slice(0,5)}catch{return []}
  }
  function renderForecast(f,p){
    const {rates,result,totals,scores}=p,labels=shownPercentages(result);
    const sparse=Math.min(rates.effectiveSamples.home,rates.effectiveSamples.away)<5;
    const home=escape(teamChineseName(f.home)),away=escape(teamChineseName(f.away));
    const saved=savedPredictions(f),resultLabels={home:'主胜',draw:'平局',away:'客胜'};
    const manual=saved.map((row,i)=>'<li><b>'+(i+1)+'</b><span>'+escape([resultLabels[row.result],row.fullScore&&'全场 '+row.fullScore,row.note].filter(Boolean).join(' · ')||'已保存其他预测项')+'</span></li>').join('');
    $('#predictorOutput').innerHTML=[
      '<div class="predictor-matchup"><div class="predictor-club">'+teamLogoMarkup(f.home,'card')+'<span><strong>'+home+'</strong><small>'+escape(f.home)+'</small></span></div><div class="predictor-vs"><time>'+escape(f.date)+(f.time?' · '+escape(f.time)+' 北京时间':' · 开球时间待同步')+'</time><b>VS</b><span>MD'+(f.round||'待确认')+' · 90 分钟</span></div><div class="predictor-club away">'+teamLogoMarkup(f.away,'card')+'<span><strong>'+away+'</strong><small>'+escape(f.away)+'</small></span></div></div>',
      '<div class="predictor-quality"><span class="'+(sparse?'low':'')+'">'+(sparse?'样本较少 · 保守估计':'历史样本可用')+'</span><span>使用 '+p.trainingGames+' 场 · 主队 '+rates.samples.home+' / 客队 '+rates.samples.away+' 场</span><span>最新已用赛果 '+escape(p.lastDate||'无')+'</span></div>',
      '<div class="predictor-tactics-link"><button type="button" id="predictorOpenTactics">查看双方球风档案 →</button><button type="button" id="predictorOpenWorkbench">单场推演 · 赛前留档 →</button></div>',
      '<div class="predictor-panels"><article class="predictor-panel wide"><p class="eyebrow">01 · MATCH OUTCOME</p><h3>胜平负概率</h3><div class="predictor-bars">'+bar('主胜',result.home,'home',labels.home)+bar('平局',result.draw,'draw',labels.draw)+bar('客胜',result.away,'away',labels.away)+'</div><div class="predictor-goals"><span>'+home+'<b>'+rates.home.toFixed(2)+'</b></span><small>模型预计进球<br>非实际 xG 统计</small><span>'+away+'<b>'+rates.away.toFixed(2)+'</b></span></div></article>',
      '<article class="predictor-panel"><p class="eyebrow">02 · SCORE DISTRIBUTION</p><h3>最可能比分</h3><ol class="predictor-scores">'+scores.map(row=>'<li><b>'+row.home+'–'+row.away+'</b><span>'+percent(row.probability)+'</span></li>').join('')+'</ol><p class="predictor-note">单个比分的概率通常较低，排名第一也不代表一定发生。</p></article>',
      '<article class="predictor-panel"><p class="eyebrow">03 · TOTAL GOALS</p><h3>总进球分布</h3><div class="predictor-total">'+totals.map((value,i)=>'<div><strong>'+(i===6?'6+':i)+'</strong><i style="--height:'+Math.max(2,value*220)+'px"></i><span>'+percent(value)+'</span></div>').join('')+'</div></article>',
      '<article class="predictor-panel wide"><p class="eyebrow">WHAT DRIVES THIS FORECAST</p><h3>预测依据</h3><div class="predictor-factor-grid"><div><b>主客场因素</b><span>赛事平均主场 '+rates.factors.homeAverage.toFixed(2)+' / 客场 '+rates.factors.awayAverage.toFixed(2)+' 球</span></div><div><b>'+home+'</b><span>进攻 '+rates.factors.home.attack.toFixed(2)+'× · 失球 '+rates.factors.home.defense.toFixed(2)+'×</span></div><div><b>'+away+'</b><span>进攻 '+rates.factors.away.attack.toFixed(2)+'× · 失球 '+rates.factors.away.defense.toFixed(2)+'×</span></div></div><p class="predictor-note">倍率相对于赛事平均；失球倍率越低，历史防守表现越好。较旧赛果的权重较低，档位、国内排名和伤停未作为模型输入。</p></article>',
      '<article class="predictor-panel wide"><div class="predictor-manual-head"><div><p class="eyebrow">MY PREDICTIONS</p><h3>我的预测</h3></div><button id="predictorOpenDetail" type="button">查看详情 / 编辑我的预测 →</button></div>'+(manual?'<ol class="predictor-manual">'+manual+'</ol>':'<p class="predictor-note">本场尚未保存个人预测；可打开比赛详情记录自己的判断。</p>')+'</article></div>',
      '<div class="predictor-stamp"><span>生成于 '+escape(new Date().toLocaleString('zh-CN',{timeZone:'Asia/Shanghai',hour12:false}))+' · 北京时间</span><span>模型 '+escape(p.version)+' · 仅用 '+escape(p.cutoffDate)+' 之前的赛果</span><span>网站同步状态：'+escape(document.querySelector('#updatedAt')?.textContent||'尚未记录')+'</span></div>'
    ].join('');
    $('#predictorOpenDetail').onclick=()=>window.openFixtureDetail?.(f.home,f.away,f.date,f.time);
    $('#predictorOpenTactics').onclick=()=>window.dispatchEvent(new CustomEvent('ucl:open-tactics',{detail:{team:f.home,opponent:f.away}}));
    lastPrediction={fixture:f,prediction:p,generatedAt:new Date().toISOString()};
    $('#predictorOpenWorkbench').onclick=()=>window.dispatchEvent(new CustomEvent('ucl:open-tactics',{detail:{team:f.home,opponent:f.away,section:'workbench',fixture:f,baseline:lastPrediction}}));
    window.dispatchEvent(new CustomEvent('ucl:forecast-rendered',{detail:lastPrediction}));
  }
  function calibrationChart(bins){
    const points=bins.filter(b=>b.count>=10),xy=n=>40+n*250;
    return '<svg viewBox="0 0 340 330" role="img" aria-label="概率校准图：横轴模型概率，纵轴实际发生率；虚线表示完全一致"><path d="M40 40V290H290" fill="none" stroke="#9aa8c6"/><path d="M40 290L290 40" stroke="#98a5bf" stroke-dasharray="5 5"/>'+points.map(b=>'<circle cx="'+xy(b.predicted)+'" cy="'+(290-b.observed*250)+'" r="'+Math.min(10,3+Math.sqrt(b.count)/3)+'" fill="#4265d6"><title>平均预测 '+percent(b.predicted)+'；实际 '+percent(b.observed)+'；'+b.count+' 个结果概率</title></circle>').join('')+'<text x="35" y="308">0%</text><text x="260" y="308">100%</text><text x="8" y="47">100%</text><text x="125" y="326">模型概率</text><text x="43" y="26">实际发生率</text></svg>';
  }
  function renderBacktest(){
    if(!report)return;
    const season=$('#predictorTestSeason').value,item=season==='all'?report.evaluation:report.bySeason.find(row=>row.season===season);
    if(!item)return;
    const m=item.model,b=item.pooled,improvement=1-m.logLoss/b.logLoss;
    $('#predictorBacktestOutput').innerHTML=[
      '<div class="predictor-notice"><strong>时间顺序回测</strong><span>'+m.matches+' 场联赛阶段比赛；按每场赛前日期重建模型。参数已在 2023/24 固定，评估时仅逐日加入此前赛果。回测表现不等于未来命中率。</span></div>',
      '<div class="predictor-metrics"><article><span>评估场数</span><b>'+m.matches+'</b><small>'+(season==='all'?'2024/25 + 2025/26':escape(season.replace('-','/')))+'</small></article><article><span>概率损失改善</span><b>'+(improvement*100).toFixed(1)+'%</b><small>相对于赛事平均进球基线</small></article><article><span>对数损失</span><b>'+m.logLoss.toFixed(3)+'</b><small>越低越好 · 基线 '+b.logLoss.toFixed(3)+'</small></article><article><span>Brier 分数</span><b>'+m.brier.toFixed(3)+'</b><small>越低越好 · 基线 '+b.brier.toFixed(3)+'</small></article></div>',
      '<div class="predictor-panels"><article class="predictor-panel"><h3>与简单基线比较</h3><div class="predictor-table-scroll"><table class="predictor-evaluation"><thead><tr><th>方法</th><th>对数损失</th><th>Brier</th><th>胜平负命中</th></tr></thead><tbody><tr><th>球队攻防模型</th><td>'+m.logLoss.toFixed(3)+'</td><td>'+m.brier.toFixed(3)+'</td><td>'+percent(m.accuracy)+'</td></tr><tr><th>赛事平均进球</th><td>'+b.logLoss.toFixed(3)+'</td><td>'+b.brier.toFixed(3)+'</td><td>'+percent(b.accuracy)+'</td></tr></tbody></table></div>',
      '<p class="predictor-note">基线使用同一截止日期的赛事平均主客场进球，不区分球队。Brier 为三个结果的平方误差之和；准确率只统计概率最大的结果。</p><h3 class="predictor-subheading">历史数据覆盖</h3><p class="predictor-note">'+seed.auditedMatches+' 场正赛已解析；'+seed.trainingMatches+' 场小组／联赛阶段用于模型；'+seed.crossCheckMatches+' 场与网站两季归档对账，比分差异 '+seed.crossCheckDifferences+' 场。原始比分及事件样本保存在本地，网站仅加载聚合模型和回测统计。</p></article>',
      '<article class="predictor-panel"><h3>概率与实际发生率</h3><div class="predictor-calibration">'+calibrationChart(m.calibration)+'</div><p class="predictor-note">点越靠近虚线，预测概率越接近实际频率；合并主胜／平／客胜三个结果。图中仅画样本数 ≥10 的区间。</p><details class="predictor-bin-details"><summary>查看全部概率区间</summary><table class="predictor-evaluation"><thead><tr><th>预测均值</th><th>实际频率</th><th>样本</th></tr></thead><tbody>'+m.calibration.map(row=>'<tr><td>'+percent(row.predicted)+'</td><td>'+percent(row.observed)+'</td><td>'+row.count+'</td></tr>').join('')+'</tbody></table></details></article></div>'
    ].join('');
  }
  async function refresh(){
    if(!page.classList.contains('active'))return;
    const request=++generation;
    try{
      await artifacts();
      if(request!==generation||!page.classList.contains('active'))return;
      renderBacktest();
      const select=$('#predictorFixture');
      if(!window.uclSeason.current){
        $('#predictorFixtureCount').textContent=window.uclSeason.label+' · 历史回测可用';
        $('#predictorFixtures').innerHTML='';select.innerHTML='';select.disabled=true;
        $('#predictorOutput').innerHTML='<div class="predictor-empty"><strong>查看所选历史赛季的回测</strong><p>进入“历史回测”了解模型在这一季的表现；单场预测用于当前赛季待赛比赛。</p><button type="button" id="predictorShowBacktest">查看历史回测</button></div>';
        $('#predictorShowBacktest').onclick=()=>chooseView('backtest');return;
      }
      const all=fixtures(),round=$('#predictorRound').value,query=$('#predictorSearch').value.trim().toLowerCase();
      const visible=all.filter(f=>(round==='all'||String(f.round)===round)&&(!query||[f.home,f.away,teamChineseName(f.home),teamChineseName(f.away)].join(' ').toLowerCase().includes(query)));
      $('#predictorFixtureCount').textContent=visible.length+' 场符合条件 · 共 '+all.length+' 场待赛';
      select.disabled=!visible.length;
      select.innerHTML=visible.map((f,i)=>'<option value="'+i+'">'+escape(f.date.slice(5)+' · MD'+(f.round||'?')+' · '+teamChineseName(f.home)+' vs '+teamChineseName(f.away))+'</option>').join('');
      if(!visible.length){
        $('#predictorFixtures').innerHTML='';
        $('#predictorOutput').innerHTML='<div class="predictor-empty">当前条件下没有可预测比赛。可调整比赛日或球队筛选，再检查网站赛程更新状态。</div>';lastPrediction=null;return;
      }
      let index=visible.findIndex(f=>key(f)===selectedKey);if(index<0)index=0;select.value=String(index);
      const renderSelected=()=>{
        const f=visible[Number(select.value)];if(!f)return;
        selectedKey=key(f);
        const cutoff=f.date<today()?f.date:today(),model=api.buildModel(currentRows(),cutoff,seed);
        lastModelContext={seed,model:api.serializeModel(model),incrementalRows:currentRows().filter(row=>row.date>=seed.cutoffDate&&row.date<cutoff)};
        renderForecast(f,api.forecast(model,f.home,f.away,{includeHalfFull:false}));
        $('#predictorFixtures').innerHTML=visible.slice(0,6).map((item,i)=>'<button type="button" class="predictor-fixture-card '+(key(item)===selectedKey?'selected':'')+'" aria-pressed="'+(key(item)===selectedKey)+'" data-predictor-index="'+i+'"><small>'+escape(item.date.slice(5))+' · MD'+(item.round||'?')+'</small><strong>'+escape(teamChineseName(item.home))+'<span>VS</span>'+escape(teamChineseName(item.away))+'</strong></button>').join('');
        $('#predictorFixtures').querySelectorAll('[data-predictor-index]').forEach(btn=>btn.onclick=()=>{select.value=btn.dataset.predictorIndex;renderSelected()});
      };
      select.onchange=renderSelected;renderSelected();
    }catch(error){
      if(request!==generation)return;
      $('#predictorOutput').innerHTML='<div class="predictor-empty"><strong>模型暂时无法加载</strong><p>'+escape(error.message)+'</p><button type="button" id="predictorRetry">重新加载模型</button></div>';
      $('#predictorBacktestOutput').innerHTML='<div class="predictor-empty">回测资料暂不可用，请返回单场预测重试。</div>';$('#predictorRetry').onclick=refresh;
    }
  }
  function chooseView(view){
    if(!['forecast','backtest','tactics','foundation','validation'].includes(view))return;
    if(['tactics','foundation','validation'].includes(view)&&!window.uclSeason.current)view='backtest';
    $('#predictorForecast').hidden=view!=='forecast';$('#predictorBacktest').hidden=view!=='backtest';$('#predictorTactics').hidden=view!=='tactics';
    $('#predictorFoundation').hidden=view!=='foundation';
    $('#predictorValidation').hidden=view!=='validation';
    page.querySelectorAll('[data-predictor-view]').forEach(btn=>{const active=btn.dataset.predictorView===view;btn.classList.toggle('active',active);btn.setAttribute('aria-pressed',String(active))});
    const url=new URL(location.href);url.searchParams.set('view','predictor');if(['tactics','foundation','validation'].includes(view))url.searchParams.set('tab',view);else url.searchParams.delete('tab');history.replaceState(null,'',url);
    window.dispatchEvent(new CustomEvent('ucl:predictor-view',{detail:view}));
  }
  page.querySelectorAll('[data-predictor-view]').forEach(btn=>btn.onclick=()=>chooseView(btn.dataset.predictorView));
  $('#predictorRound').onchange=refresh;$('#predictorSearch').oninput=refresh;$('#predictorTestSeason').onchange=renderBacktest;
  if(!window.uclSeason.current){$('#predictorTestSeason').value=window.uclSeason.key;const tab=$('[data-predictor-view="tactics"]');tab.disabled=true;tab.title='当前球队观察不自动套用于历史赛季';}
  button.addEventListener('click',()=>{
    nav.querySelectorAll('button').forEach(btn=>btn.classList.toggle('active',btn===button));
    ['.hero','#leaguePhaseHub','.layout','.results'].forEach(selector=>document.querySelector(selector)?.style.setProperty('display','none'));
    ['#schedulePage','#competitionInfo','#qualificationPage','#advancementPage'].forEach(selector=>document.querySelector(selector)?.classList.remove('active'));
    page.classList.add('active');button.scrollIntoView({block:'nearest',inline:'nearest'});window.scrollTo({top:0,behavior:'smooth'});
    if(!window.uclSeason.current)chooseView('backtest');else if(['tactics','foundation','validation'].includes(new URLSearchParams(location.search).get('tab')))chooseView(new URLSearchParams(location.search).get('tab'));
    refresh();
  });
  nav.addEventListener('click',event=>{if(event.target.closest('button')&&event.target.closest('button')!==button)page.classList.remove('active')});
  window.addEventListener('ucl:data-updated',refresh);
  window.addEventListener('ucl:prediction-saved',()=>{if(page.classList.contains('active')&&lastPrediction)renderForecast(lastPrediction.fixture,lastPrediction.prediction)});
  window.UclPredictorPage={refresh,getForecast:()=>lastPrediction,getModelContext:()=>lastModelContext,showView:chooseView,selectFixture:async f=>{selectedKey=key(f);$('#predictorRound').value='all';$('#predictorSearch').value='';await refresh();return lastPrediction;}};
  window.addEventListener('resize',()=>{if(page.classList.contains('active'))button.scrollIntoView({block:'nearest',inline:'nearest'})});
  if(new URLSearchParams(location.search).get('view')==='predictor')setTimeout(()=>button.click(),120);
})();
