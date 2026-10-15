/* Auditable data foundations. Experimental predictions never replace V1.0. */
(function(){
  const host=document.querySelector('#predictorFoundation'),page=document.querySelector('#predictorPage');
  if(!host||!page)return;
  const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const api=window.UclPlayerRegistry;
  const params=new URLSearchParams(location.search);
  const state={tab:['audit','players','lineups','model'].includes(params.get('foundationTab'))?params.get('foundationTab'):'audit',clubId:'',query:'',message:'',error:false,selected:[],partial:true};
  const FILES={audit:'js/data/prediction/coverage-audit.json',registry:'js/data/players/registry.json',model:'js/data/prediction/opponent-model.json',comparison:'js/data/prediction/opponent-backtest.json'};
  const LINEUPS_KEY='ucl:player-lineups:v1',REGISTRY_KEY='ucl:player-registry-local:v1',STORE_VERSION='player-lineup-workspace-1.0';
  let artifacts={},failures={},pending=null,registry=null,registryData=null,lastForecast=null,viewToken=0;
  const $=selector=>host.querySelector(selector);
  const cn=name=>typeof teamChineseName==='function'?teamChineseName(name):name;
  const pct=value=>Number.isFinite(value)?(value*100).toFixed(1)+'%':'—';
  const number=value=>Number.isFinite(value)?value.toLocaleString('zh-CN'):'—';
  const stamp=value=>value&&Number.isFinite(Date.parse(value))?new Date(value).toLocaleString('zh-CN',{timeZone:'Asia/Shanghai',hour12:false}):'未知';
  const datetime=value=>value&&Number.isFinite(Date.parse(value))?new Date(Date.parse(value)+8*3600000).toISOString().slice(0,16):'';
  const iso=value=>value?new Date(value+':00+08:00').toISOString():null;
  const link=(url,label)=>{try{return new URL(url).protocol==='https:'?'<a href="'+escape(url)+'" target="_blank" rel="noopener noreferrer">'+escape(label)+' ↗</a>':escape(label);}catch{return escape(label);}};
  const clone=value=>JSON.parse(JSON.stringify(value));
  const navButton=document.createElement('button');navButton.type='button';navButton.dataset.predictorView='foundation';navButton.textContent='阵容与数据';navButton.setAttribute('aria-pressed','false');
  page.querySelector('.predictor-tabs').appendChild(navButton);
  navButton.disabled=!window.uclSeason.current;
  navButton.title=navButton.disabled?'当前球员档案不自动用于历史赛季':'数据覆盖、球员身份、时序阵容与实验模型';
  navButton.onclick=()=>window.UclPredictorPage.showView('foundation');
  function message(text,error=false){state.message=text;state.error=error;const area=$('#foundationMessage');if(area){area.textContent=text;area.classList.toggle('error',error);}}
  function remember(){const url=new URL(location.href);url.searchParams.set('foundationTab',state.tab);history.replaceState(null,'',url);}
  async function load(force=false){
    if(force){artifacts={};failures={};pending=null;registry=null;}
    if(pending)return pending;
    pending=Promise.all(Object.entries(FILES).map(async([key,url])=>{
      try{const response=await fetch(url);if(!response.ok)throw new Error('HTTP '+response.status);artifacts[key]=await response.json();}
      catch(error){failures[key]=error.message;}
    })).then(()=>{
      if(artifacts.registry&&api){
        registryData=artifacts.registry;
        try{const saved=localStorage.getItem(REGISTRY_KEY);if(saved){const candidate=JSON.parse(saved);api.createRegistry(candidate);registryData=candidate;}}
        catch(error){failures.localRegistry='本机球员库未加载：'+error.message+'；未覆盖原存储，继续显示只读种子库。';}
        try{registry=api.createRegistry(registryData);state.clubId=registryData.clubs.find(row=>row.id===state.clubId)?.id||registryData.clubs[0]?.id||'';}
        catch(error){failures.registry=error.message;registry=null;}
      }
      return artifacts;
    });
    return pending;
  }
  async function show(force=false){
    const token=++viewToken;
    if(!window.uclSeason.current){host.innerHTML='<div class="predictor-empty">当前球员资料不自动套用到历史赛季。</div>';return;}
    host.innerHTML='<div class="predictor-empty" role="status">正在核对数据覆盖与实验模型…</div>';
    try{await load(force);if(token===viewToken)render();}catch(error){host.innerHTML='<p class="foundation-message error">'+escape(error.message)+'</p>';}
  }
  function render(){
    host.innerHTML='<div class="foundation-heading"><div><p class="eyebrow">DATA FIRST · MODEL FOUNDATIONS</p><h2>先看证据覆盖，<span>再谈阵容影响。</span></h2><p>球员身份与阵容记录已独立建库；没有经过验证的数据，不进入正式预测概率。</p></div><span class="foundation-gate">正式模型仍为 V1.0</span></div><div class="foundation-tabs" role="group" aria-label="数据与阵容分类">'+[['audit','数据覆盖'],['players','球员身份库'],['lineups','时序阵容库'],['model','实验基线']].map(([key,label])=>'<button type="button" data-foundation-tab="'+key+'" aria-pressed="'+(key===state.tab)+'">'+label+'</button>').join('')+'</div><p id="foundationMessage" class="foundation-message'+(state.error?' error':'')+'" role="status" aria-live="polite">'+escape(state.message)+'</p>'+(Object.keys(failures).length?'<div class="foundation-notice"><b>部分资料未就绪，原预测功能不受影响</b><p>'+Object.entries(failures).map(([key,error])=>escape(key+'：'+error)).join('<br>')+'</p><button type="button" data-foundation-retry>重新读取资料</button></div>':'')+'<div id="foundationBody"></div>';
    if(state.tab==='audit')renderAudit();else if(state.tab==='players')renderPlayers();else if(state.tab==='lineups')renderLineups();else renderModel();
    host.onclick=onClick;host.onchange=onChange;host.oninput=onInput;host.onsubmit=onSubmit;
  }
  const stat=(value,label,note)=>'<article><b>'+escape(value)+'</b><span>'+escape(label)+'</span><small>'+escape(note||'')+'</small></article>';
  function renderAudit(){
    const data=artifacts.audit;
    if(!data){$('#foundationBody').innerHTML='<div class="predictor-empty">审计摘要尚不可用，请重试；不会把缺失覆盖当作已有数据。</div>';return;}
    const scores=data.localDatasets?.scores||{},sample=data.localDatasets?.statsbombSample||{},players=data.localDatasets?.playerRegistry||{},coverage=data.clubCoverage||{};
    $('#foundationBody').innerHTML='<div class="foundation-stats">'+stat(number(scores.eligibleTrainingMatches),'历史训练比分',number(scores.matches)+'场正赛已审计')+stat(number(sample.matches),'事件 / 阵容样本','样本不等于训练集覆盖')+stat(number(coverage.clubsWithTrainingLineups),'训练阵容覆盖球队','分母为本站36队')+stat(number(coverage.clubsWithVerifiedCurrentRoster),'已核实当前注册球队','未知不按有效名单处理')+'</div><div class="foundation-notice"><b>阵容概率修正：尚未启用</b><p>对手强度模型仅为实验；当前数据不足以估计可靠的逐球员数值影响。历史观察中出现的球员，不代表当前效力、报名资格或首发。</p></div><section class="foundation-card"><div class="foundation-section-head"><h3>字段覆盖审计</h3><small>审计时间 '+escape(data.auditedAt||'未知')+'</small></div><div class="foundation-scroll"><table><thead><tr><th>字段</th><th>训练比赛覆盖</th><th>独立样本</th><th>解释与限制</th></tr></thead><tbody>'+(data.fields||[]).map(row=>'<tr><th>'+escape(row.label)+'</th><td>'+escape(row.training?.present??'未知')+' / '+escape(row.training?.denominator??'未知')+'<small>'+escape(row.training?.status)+'</small></td><td>'+escape(row.sample?.present??'未知')+' / '+escape(row.sample?.denominator??'未知')+'</td><td>'+escape(row.note)+'</td></tr>').join('')+'</tbody></table></div></section><section class="foundation-card"><h3>36队逐队覆盖</h3><p class="foundation-muted">球员观察、事件样本、可训练首发和当前注册名单是四种不同信息。</p><div class="foundation-scroll"><table><thead><tr><th>球队</th><th>训练比分</th><th>历史人员观察</th><th>训练首发</th><th>当前注册</th></tr></thead><tbody>'+(coverage.rows||[]).map(row=>'<tr><th>'+escape(row.zh)+'<small>'+escape(row.name)+'</small></th><td>'+escape(row.eligibleTrainingScoreMatches)+'</td><td>'+escape(row.historicalPlayerObservations)+'</td><td>'+escape(row.eligibleTrainingLineups)+'</td><td>'+escape(row.verifiedCurrentRoster?'已有核查':'未核实')+'</td></tr>').join('')+'</tbody></table></div></section><section class="foundation-card"><h3>来源与下一步</h3><div class="foundation-sources">'+(data.sources||[]).map(row=>'<article><b>'+escape(row.name||row.id)+'</b><p>'+escape(row.status||row.localStatus||row.note||'')+'</p>'+link(row.url,row.title||row.name||'来源说明')+'</article>').join('')+'</div><ul class="foundation-list">'+(data.nextActions||[]).map(row=>'<li>'+escape(typeof row==='string'?row:row.action||row.title||JSON.stringify(row))+'</li>').join('')+'</ul><details><summary>审计限制与发布门禁</summary><pre>'+escape(JSON.stringify({gates:data.gates,limitations:data.limitations},null,2))+'</pre></details></section>';
    const labels={missing:'缺失',present:'已持有',partial:'部分覆盖','not-applicable':'不适用','not-held':'未持有','reconstructable-not-normalized':'可重建，尚未规范化'};
    host.querySelectorAll('.foundation-scroll td small').forEach(node=>{if(labels[node.textContent])node.textContent=labels[node.textContent];});
    host.querySelectorAll('.foundation-sources article').forEach((node,index)=>{if(data.sources[index]?.note)node.querySelector('p').textContent=data.sources[index].note;});
  }
  function clubOptions(){return (registryData?.clubs||[]).map(row=>'<option value="'+escape(row.id)+'"'+(row.id===state.clubId?' selected':'')+'>'+escape(row.zh+' · '+row.name)+'</option>').join('');}
  function requireRegistry(){if(registry)return true;$('#foundationBody').innerHTML='<div class="predictor-empty">球员数据库尚未加载，未创建任何推测球员或注册记录。</div>';return false;}
  function renderPlayers(){
    if(!requireRegistry())return;
    const observations=registry.historicalObservations(state.clubId),players=registry.all(),query=state.query.trim().toLowerCase();
    const ids=new Set(observations.map(row=>row.playerId));
    const rows=players.filter(row=>(state.clubId==='all'||ids.has(row.id))&&(!query||[row.displayName,row.id,...(row.aliases||[])].join(' ').toLowerCase().includes(query)));
    const club=registryData.clubs.find(row=>row.id===state.clubId);
    $('#foundationBody').innerHTML='<div class="foundation-card"><div class="foundation-section-head"><div><h3>球员身份库</h3><p>'+players.length+'个研究身份 · 不能据此声称当前36队完整名单已导入</p></div><div class="foundation-actions"><button type="button" data-registry-export>导出本机球员库</button><label class="foundation-file">导入球员库 JSON<input id="foundationRegistryImport" type="file" accept="application/json,.json"></label></div></div><div class="foundation-filters"><label>历史关联球队<select id="foundationClub">'+clubOptions()+'</select></label><label>搜索球员 / 唯一ID<input id="foundationPlayerSearch" type="search" value="'+escape(state.query)+'" placeholder="名称或 playerId"></label></div><p class="foundation-muted">'+escape(club?.zh||'')+'：当前注册、报名资格和可用性需单独核查。以下只列来源中的历史观察，不自动推定现役关系。</p><div id="foundationPlayerRows">'+playerRows(rows)+'</div><details class="foundation-import-help"><summary>如何补充正式球员、注册与本场来源</summary><p>导出当前JSON后，按数据库结构补充来源、稳定球员ID、带有效期的注册和赛事资格，再导入。本机导入不会发布到网站；同ID内容冲突会整批拒绝，不按同名自动合并。</p><p>来源发表时间未知就保留未知。旧文章不得标为本场首发依据；已有快照保留原始身份与证据副本。</p></details></div>';
  }
  function playerRows(rows){
    return rows.length?'<div class="foundation-player-grid">'+rows.map(player=>{
      const observations=(registryData.observations||[]).filter(row=>row.playerId===player.id&&row.teamId===state.clubId);
      return '<article><h4>'+escape(player.displayName)+'</h4><code>'+escape(player.id)+'</code><span class="foundation-tag">'+escape(player.identityStatus==='research-seed'?'研究身份 · 需进一步核对':player.identityStatus)+'</span><p>出生日期：'+escape(player.birthDate||'未知，不推测')+'</p>'+observations.map(row=>'<div class="foundation-player-observation"><b>'+escape(row.period)+'</b><p>'+escape(row.role)+'</p>'+(row.sourceIds||[]).map(id=>{const source=registryData.sources.find(source=>source.id===id);return source?link(source.url,source.title):'';}).join(' ')+'</div>').join('')+'<small>历史出现不等于当前注册；缺失角色或能力不会填入默认评分。</small></article>';
    }).join('')+'</div>':'<p class="foundation-empty">该球队或筛选条件下没有已收录的历史人员观察，不虚构补齐。</p>';
  }
  function readLineups(){
    const raw=localStorage.getItem(LINEUPS_KEY);if(!raw)return [];
    if(raw.length>2000000)throw new Error('本机阵容记录过大，未覆盖已有数据。');
    const payload=JSON.parse(raw);
    if(payload.version!==STORE_VERSION||!Array.isArray(payload.records)||payload.records.length>50)throw new Error('本机阵容库格式损坏，未覆盖已有数据。');
    const ids=new Set();
    for(const row of payload.records){
      if(!row||typeof row.id!=='string'||ids.has(row.id)||!row.input||!row.snapshot||!Array.isArray(row.snapshot.selected)||!['local','imported-unverified'].includes(row.provenance))throw new Error('阵容记录结构或唯一ID无效，未覆盖已有数据。');
      ids.add(row.id);
    }
    return payload.records;
  }
  function writeLineups(records){
    if(records.length>50)throw new Error('最多50份阵容记录，请先导出备份，不会自动删除旧记录。');
    const text=JSON.stringify({version:STORE_VERSION,records});if(text.length>2000000)throw new Error('阵容库超过本机容量限制，请先导出。');
    localStorage.setItem(LINEUPS_KEY,text);
  }
  function newDraft(){
    const f=window.UclPredictorPage?.getForecast?.()?.fixture,club=registryData.clubs.find(row=>row.name===f?.home)||registryData.clubs.find(row=>row.id===state.clubId)||registryData.clubs[0];
    const kickoff=f&&/^\d{2}:\d{2}$/.test(f.time||'')?datetime(f.date+'T'+f.time+':00+08:00'):'';
    return {matchId:f?[window.uclSeason.key,f.date,f.home,f.away].join(':').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9:-]/g,'-'):'',teamId:club.id,season:window.uclSeason.key,competitionId:'uefa-champions-league',kickoff,status:'unknown',partial:true,sourceId:'',publishedAt:'',observedAt:'',notes:''};
  }
  function renderLineups(){
    if(!requireRegistry())return;
    state.lineupDraft||=newDraft();const d=state.lineupDraft;
    let records=[],error='';try{records=readLineups();}catch(e){error=e.message;}
    $('#foundationBody').innerHTML='<section class="foundation-card"><div class="foundation-section-head"><div><h3>时序阵容数据库</h3><p>保存球员ID、预计职责与分钟，逐条保留来源。只存在当前浏览器，不上传。</p></div><div class="foundation-actions"><button type="button" data-lineups-export>导出阵容备份</button><label class="foundation-file">导入阵容 JSON<input id="foundationLineupsImport" type="file" accept="application/json,.json"></label></div></div>'+(error?'<p class="foundation-message error">'+escape(error)+'</p>':'')+'<div class="foundation-notice"><b>记录不等于阵容概率模型已经启用</b><p>当前注册、资格或来源时序未知时，保持未知；历史文章不能证明本场首发。完整预计 / 确认阵容需11名首发，资料不齐请选择“部分阵容”。</p></div><form id="foundationLineupForm"><div class="foundation-form-grid"><label>比赛唯一ID<input id="lineupMatchId" maxlength="200" value="'+escape(d.matchId)+'" required></label><label>球队<select id="lineupTeam">'+registryData.clubs.map(row=>'<option value="'+escape(row.id)+'"'+(d.teamId===row.id?' selected':'')+'>'+escape(row.zh)+'</option>').join('')+'</select></label><label>开球时间 · 北京时间<input id="lineupKickoff" type="datetime-local" value="'+escape(d.kickoff)+'" required></label><label>阵容状态<select id="lineupStatus">'+[['unknown','未知 / 未核实'],['expected','预计阵容'],['confirmed','人工核查确认']].map(([value,label])=>'<option value="'+value+'"'+(d.status===value?' selected':'')+'>'+label+'</option>').join('')+'</select></label><label class="foundation-check"><input id="lineupPartial" type="checkbox"'+(d.partial?' checked':'')+'> 部分阵容 · 不冒充完整名单</label></div><div class="foundation-add-player"><label>选择已登记的球员身份<select id="lineupPlayerPicker"><option value="">选择身份，不按同名自动匹配</option>'+registry.all().filter(player=>!state.selected.some(row=>row.playerId===player.id)).map(player=>'<option value="'+escape(player.id)+'">'+escape(player.displayName+' · '+player.id)+'</option>').join('')+'</select></label><button type="button" data-lineup-add>加入名单</button></div><div id="lineupSelectedRows"></div><div class="foundation-form-grid"><label>来源引用<select id="lineupSource"><option value="">来源未核实</option>'+registryData.sources.map(source=>'<option value="'+escape(source.id)+'"'+(d.sourceId===source.id?' selected':'')+'>'+escape(source.title+' · '+source.kind)+'</option>').join('')+'</select></label><label>来源发表时间 · 北京时间<input id="lineupPublishedAt" type="datetime-local" value="'+escape(d.publishedAt)+'"></label><label>观察时间 · 北京时间<input id="lineupObservedAt" type="datetime-local" value="'+escape(d.observedAt)+'"></label><label>核查与保存时点<input disabled value="'+escape(stamp(new Date().toISOString()))+'"></label></div><p class="foundation-muted">日期未知就留空，不以保存时间代替首次发表时间。新增本场来源与注册证据需先导入球员库；本页不把旧来源重标为本场官方名单。</p><label>备注<textarea id="lineupNotes" maxlength="3000" rows="3">'+escape(d.notes)+'</textarea></label><div class="foundation-actions"><button type="button" data-lineup-validate>校验但不保存</button><button type="submit" class="primary">保存本机阵容记录</button></div></form><div id="lineupValidation" aria-live="polite"></div></section><section class="foundation-card"><h3>已保存的阵容记录 <small>'+records.length+' / 50</small></h3><div id="lineupSavedRows">'+savedLineupRows(records)+'</div></section>';
    renderSelectedRows();renderSavedLineups(records);
  }
  function renderSelectedRows(){
    const roles=['unknown','GK','CB','FB','WB','DM','CM','AM','W','ST','MF','DF','FW'];
    $('#lineupSelectedRows').innerHTML=state.selected.length?'<div class="foundation-scroll"><table class="foundation-selected"><thead><tr><th>球员身份</th><th>职责</th><th>首发</th><th>预计分钟</th><th></th></tr></thead><tbody>'+state.selected.map(row=>'<tr><th>'+escape(registry.get(row.playerId)?.displayName||row.playerId)+'<small>'+escape(row.playerId)+'</small></th><td><select data-lineup-player="'+escape(row.playerId)+'" data-lineup-field="role">'+roles.map(role=>'<option value="'+role+'"'+(role===row.role?' selected':'')+'>'+role+'</option>').join('')+'</select></td><td><input type="checkbox" data-lineup-player="'+escape(row.playerId)+'" data-lineup-field="starter"'+(row.starter?' checked':'')+'></td><td><input type="number" min="0" max="90" placeholder="未知" data-lineup-player="'+escape(row.playerId)+'" data-lineup-field="expectedMinutes" value="'+escape(row.expectedMinutes??'')+'"></td><td><button type="button" data-lineup-remove="'+escape(row.playerId)+'" aria-label="移除'+escape(registry.get(row.playerId)?.displayName)+'">移除</button></td></tr>').join('')+'</tbody></table></div>':'<p class="foundation-empty">没有已录入球员。可以保留未知，不生成虚构球员、伤停或预计分钟。</p>';
  }
  function savedLineupRows(records){
    return records.length?records.slice().reverse().map(row=>'<article class="foundation-lineup-record"><div><b>'+escape(registryData.clubs.find(club=>club.id===row.input.teamId)?.zh||row.input.teamId)+'</b><span>'+escape(row.provenance==='imported-unverified'?'导入 · 未验证时点':row.snapshot.trainingEligible?'具备记录条件 · 正式概率仍未启用':'研究记录 · 不具备训练条件')+'</span><small>'+escape(stamp(row.recordedAt))+' · '+escape(row.input.status)+' · '+row.snapshot.selected.length+'名已录入</small></div><details><summary>查看冻结的身份、来源与资格状态</summary><pre>'+escape(JSON.stringify(row.snapshot,null,2))+'</pre></details></article>').join(''):'<p class="foundation-empty">尚未保存。原战术快照和个人预测使用各自存储，不受影响。</p>';
  }
  function lineupInput(){
    const d=state.lineupDraft,now=new Date().toISOString();
    return {id:'lineup-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,8),matchId:d.matchId.trim(),teamId:d.teamId,season:d.season,competitionId:d.competitionId,kickoff:iso(d.kickoff),status:d.status,partial:d.partial,players:clone(state.selected),sourceReferences:d.sourceId?[{sourceId:d.sourceId,publishedAt:iso(d.publishedAt),observedAt:iso(d.observedAt),retrievedAt:now}]:[],notes:d.notes};
  }
  function renderSavedLineups(records){
    const area=$('#lineupSavedRows');if(!area)return;area.innerHTML=savedLineupRows(records);
    const count=area.closest('.foundation-card').querySelector('h3 small');if(count)count.textContent=records.length+' / 50';
    area.querySelectorAll('.foundation-lineup-record').forEach((node,index)=>{
      const record=records[records.length-1-index],button=document.createElement('button');button.type='button';button.dataset.lineupDelete=record.id;button.textContent='删除本机记录';node.appendChild(button);
    });
  }
  function validateCurrentLineup(save=false){
    const input=lineupInput(),now=new Date().toISOString(),result=api.validateLineup(input,{registry,asOf:now,now});
    $('#lineupValidation').innerHTML='<div class="foundation-validation '+(result.valid?'valid':'invalid')+'"><b>'+escape(result.valid?'结构校验通过，不代表阵容事实已核实':'校验未通过，未保存')+'</b><ul>'+[...(result.errors||[]),...(result.warnings||[])].map(row=>'<li>'+escape(typeof row==='string'?row:row.message||JSON.stringify(row))+'</li>').join('')+'</ul></div>';
    if(save){
      if(!result.valid)throw new Error('阵容校验未通过，请先修正列表与来源；已有记录未更改。');
      const snapshot=result.snapshot||api.buildLineupSnapshot(input,{registry,asOf:now,now});
      const records=readLineups();records.push({id:input.id,input,snapshot,recordedAt:now,provenance:'local'});writeLineups(records);
      renderSavedLineups(records);message('已保存本机阵容记录。身份、注册或来源未知时仍不参与概率计算。');
    }
    return result;
  }
  function metricRows(evaluation){
    const a=evaluation?.opponent,b=evaluation?.baseline;if(!a||!b)return '';
    const rows=[['胜平负对数损失',a.logLoss,b.logLoss,false],['Brier（三分类）',a.brier,b.brier,false],['胜平负命中率',a.accuracy,b.accuracy,true],['比分对数损失',a.scoreLogLoss,b.scoreLogLoss,false],['大2.5 对数损失',a.markets?.over25?.logLoss,b.markets?.over25?.logLoss,false],['大3.5 对数损失',a.markets?.over35?.logLoss,b.markets?.over35?.logLoss,false],['双方进球对数损失',a.markets?.btts?.logLoss,b.markets?.btts?.logLoss,false]];
    return rows.map(([label,newValue,oldValue,higher])=>{
      const valid=Number.isFinite(newValue)&&Number.isFinite(oldValue),better=valid&&(higher?newValue>oldValue:newValue<oldValue),equal=valid&&Math.abs(newValue-oldValue)<1e-10;
      const format=value=>higher?pct(value):Number.isFinite(value)?value.toFixed(4):'—';
      return '<tr class="'+(!valid||equal?'':better?'metric-better':'metric-worse')+'"><th>'+escape(label)+'</th><td>'+format(oldValue)+'</td><td>'+format(newValue)+'</td><td>'+escape(!valid?'未评估':equal?'相同':better?'开发对照改善':'开发对照退步')+'</td></tr>';
    }).join('');
  }
  function renderModel(){
    const model=artifacts.model,report=artifacts.comparison;
    if(!model||!report||!window.UclOpponentBaseline){$('#foundationBody').innerHTML='<div class="predictor-empty">实验模型或比较报告尚未就绪，原V1.0预测保持不变。</div>';return;}
    if(model.version!==window.UclOpponentBaseline.VERSION||model.releaseGate?.enabled!==false){$('#foundationBody').innerHTML='<div class="foundation-message error">实验模型版本或隔离设置不匹配，已停用实验展示。</div>';return;}
    const e=report.evaluation;
    $('#foundationBody').innerHTML='<div class="foundation-stats">'+stat(number(model.count),'比分训练样本','仅CC0历史，不含阵容')+stat(model.latestObservedDate||model.lastDate||'未知','最新实际训练赛果','不是网页查询时间')+stat(number(e?.opponent?.matches),'已查看过的开发对照','不能称为独立未来验证')+stat('关闭','正式模型替换门禁','新旧结果分开显示')+'</div><div class="foundation-notice"><b>实验基线：联合估计球队攻防与对手强度</b><p>胜平负指标略有改善，但部分大小球指标变差，不能宣布整体升级成功。模型没有使用2026/27新赛果或阵容，不能把本页当作已接入实时近况。</p><small>固定训练截点 '+escape(model.trainingCutoff||model.cutoffDate)+' · 最新实际观察 '+escape(model.latestObservedDate||model.lastDate)+' · 更新数据按钮不会重训本实验模型</small></div><section class="foundation-card"><h3>与原模型逐项比较</h3><p class="foundation-muted">同一CC0数据、按日向前重建。正则参数仅在2023/24选择；2024/25与2025/26已用于查看比较，不再视为完全独立留出集。损失越低越好，命中率越高越好。</p><div class="foundation-scroll"><table id="foundationModelMetrics"><thead><tr><th>指标</th><th>原V1.0</th><th>对手强度实验</th><th>结果</th></tr></thead><tbody>'+metricRows(e)+'</tbody></table></div><p class="foundation-muted">开发对照改善不是未来保证；Brier更低也不单独证明校准更好。尚无新未来独立验证，因此门禁保持关闭。</p></section><section class="foundation-card"><h3>模型方法与边界</h3><div class="foundation-method-grid"><article><b>联合对手修正</b><p>本队进球同时由本队进攻、对手防守、主场因素共同估计，不再只比较自身平均进失球。</p></article><article><b>保守收缩</b><p>攻防系数正则化并中心化，稀疏球队向赛事基准收缩；未知球队不会获得虚构的阵容优势。</p></article><article><b>一致的比分分布</b><p>胜平负、总进球和双方进球来自同一分布；这仍不表示战术与球员已经进入数值模型。</p></article></div><details><summary>拟合诊断、参数与来源</summary><pre>'+escape(JSON.stringify({parameters:model.params,fit:model.fitDiagnostics,sourceSet:model.sourceSet,releaseGate:model.releaseGate,updatePolicy:model.updatePolicy,limitations:model.limitations},null,2))+'</pre></details></section><section class="foundation-card"><h3>校准区间 · 仅开发样本</h3><p class="foundation-muted">合并三个胜平负类别，仅显示计数≥10的区间，不以少量高概率样本宣称准确。</p><div class="foundation-scroll"><table><thead><tr><th>预测区间</th><th>实验预测均值</th><th>实际发生率</th><th>样本数</th></tr></thead><tbody>'+(e?.opponent?.calibration||[]).filter(row=>row.count>=10).map(row=>'<tr><td>'+pct(row.lower)+'–'+pct(row.upper)+'</td><td>'+pct(row.predicted)+'</td><td>'+pct(row.observed)+'</td><td>'+escape(row.count)+'</td></tr>').join('')+'</tbody></table></div></section>';
  }
  async function attachComparison(current){
    if(!current?.fixture||!current.prediction||!window.uclSeason.current)return;
    lastForecast=current;await load();
    if(current!==lastForecast)return;
    const output=document.querySelector('#predictorOutput');if(!output)return;
    let container=output.querySelector('#opponentShadowComparison');
    if(!container){container=document.createElement('details');container.id='opponentShadowComparison';container.className='foundation-shadow';output.appendChild(container);}
    const model=artifacts.model;
    if(!model||!window.UclOpponentBaseline){container.innerHTML='<summary>对手强度实验暂不可用 · 正式预测未变</summary><p>实验资料加载失败；可在“阵容与数据”重新读取，不影响V1.0。</p>';return;}
    if(current.fixture.date<model.cutoffDate||model.version!==window.UclOpponentBaseline.VERSION||model.releaseGate?.enabled!==false){container.innerHTML='<summary>本场不适用该实验模型</summary><p>训练截点晚于目标比赛或版本门禁不符，已禁止调用，避免使用未来数据。正式概率未变。</p>';return;}
    try{
      const prediction=window.UclOpponentBaseline.forecast(model,current.fixture.home,current.fixture.away),original=current.prediction;
      container.innerHTML='<summary>对手强度实验对照 · 不替换上方正式概率</summary><p>固定模型最新训练赛果为 '+escape(model.latestObservedDate||model.lastDate)+'，不含当前赛季与阵容。两者数据更新范围可能不同，不能按本场概率差直接评判谁更准。</p><div class="foundation-scroll"><table><thead><tr><th>输出</th><th>原V1.0</th><th>对手强度实验</th></tr></thead><tbody>'+[['主胜',pct(original.result.home),pct(prediction.result.home)],['平局',pct(original.result.draw),pct(prediction.result.draw)],['客胜',pct(original.result.away),pct(prediction.result.away)],['主队模型预计进球',original.rates.home.toFixed(2),prediction.rates.home.toFixed(2)],['客队模型预计进球',original.rates.away.toFixed(2),prediction.rates.away.toFixed(2)]].map(row=>'<tr>'+row.map((cell,index)=>'<'+(index?'td':'th')+'>'+escape(cell)+'</'+(index?'td':'th')+'>').join('')+'</tr>').join('')+'</tbody></table></div><p>原模型数据截止 '+escape(original.cutoffDate)+'；实验训练截点 '+escape(model.cutoffDate)+'。实验主队样本 '+escape(prediction.rates.samples.home)+' / 客队 '+escape(prediction.rates.samples.away)+'；未见球队仅使用收缩基准，不是已验证球队强度。</p><button type="button" id="foundationOpenFromForecast">查看数据覆盖与全部开发对照 →</button>';
      container.querySelector('#foundationOpenFromForecast').onclick=()=>{state.tab='model';window.UclPredictorPage.showView('foundation');};
    }catch(error){container.innerHTML='<summary>实验对照不可用 · 正式概率未变</summary><p>'+escape(error.message)+'</p>';}
  }
  function download(value,name){
    const url=URL.createObjectURL(new Blob([JSON.stringify(value,null,2)],{type:'application/json;charset=utf-8'})),anchor=document.createElement('a');
    anchor.href=url;anchor.download=name;anchor.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  function mergeRegistry(incoming){
    api.createRegistry(incoming);
    const merged=clone(registryData);
    if(incoming.clubs.length!==merged.clubs.length||merged.clubs.some(club=>!incoming.clubs.some(row=>row.id===club.id&&row.name===club.name&&row.zh===club.zh)))throw new Error('导入不得更改或遗漏现有36队唯一身份。');
    for(const key of ['players','sources','memberships','observations','eligibility','availability']){
      const rows=new Map(merged[key].map(row=>[row.id,row]));
      for(const row of incoming[key]){
        if(rows.has(row.id)&&JSON.stringify(rows.get(row.id))!==JSON.stringify(row))throw new Error('同一ID内容冲突：'+row.id+'；未合并任何条目，请人工核对身份与来源。');
        if(!rows.has(row.id)){rows.set(row.id,row);merged[key].push(clone(row));}
      }
    }
    const next=api.createRegistry(merged),text=JSON.stringify(merged);
    if(text.length>2000000)throw new Error('本机球员库超过容量限制，未覆盖已有内容。');
    localStorage.setItem(REGISTRY_KEY,text);registryData=merged;registry=next;
  }
  function importLineups(payload){
    if(payload?.version!==STORE_VERSION||!Array.isArray(payload.records)||payload.records.length>50)throw new Error('阵容备份版本或格式错误。');
    const records=readLineups(),ids=new Set(records.map(row=>row.id)),importedAt=new Date().toISOString(),imported=[];
    for(const row of payload.records){
      if(!row||typeof row.id!=='string'||ids.has(row.id)||!row.input||!row.snapshot||!Number.isFinite(Date.parse(row.recordedAt))||Date.parse(row.recordedAt)>Date.now())throw new Error('导入记录ID重复、缺少原输入或保存时间无效，整批未导入。');
      const asOf=row.snapshot.asOf;
      if(!api.validTime(asOf)||Date.parse(asOf)>Date.parse(row.recordedAt))throw new Error('导入的原始截止时间与保存时间关系错误，未导入。');
      const snapshot=api.buildLineupSnapshot(row.input,{registry,asOf,now:row.recordedAt});
      imported.push({id:row.id,input:clone(row.input),snapshot:{...clone(snapshot),trainingEligible:false,importProvenance:'unverified'},recordedAt:row.recordedAt,importedAt,provenance:'imported-unverified'});ids.add(row.id);
    }
    writeLineups(records.concat(imported));
  }
  async function onClick(event){
    const button=event.target.closest('button');if(!button)return;
    try{
      if(button.dataset.foundationTab){state.tab=button.dataset.foundationTab;render();remember();return;}
      if(button.hasAttribute('data-foundation-retry')){await show(true);if(lastForecast)attachComparison(lastForecast);return;}
      if(button.hasAttribute('data-registry-export'))download(registryData,'ucl-player-registry.json');
      if(button.hasAttribute('data-lineups-export'))download({version:STORE_VERSION,exportedAt:new Date().toISOString(),records:readLineups()},'ucl-player-lineups.json');
      if(button.hasAttribute('data-lineup-add')){
        const id=$('#lineupPlayerPicker').value;if(!id)throw new Error('请先选择一个已登记的球员身份。');
        if(state.selected.some(row=>row.playerId===id))throw new Error('名单中已存在该球员，不重复添加。');
        state.selected.push({playerId:id,role:'unknown',starter:true,expectedMinutes:null});renderLineups();
      }
      if(button.dataset.lineupRemove){state.selected=state.selected.filter(row=>row.playerId!==button.dataset.lineupRemove);renderLineups();}
      if(button.dataset.lineupDelete&&window.confirm('删除这一份本机阵容记录？不影响个人预测或战术快照；若需恢复请先导出备份。')){
        const records=readLineups().filter(row=>row.id!==button.dataset.lineupDelete);writeLineups(records);renderSavedLineups(records);message('已删除该本机阵容记录；如果已导出备份，可重新导入为未验证记录。');
      }
      if(button.hasAttribute('data-lineup-validate'))validateCurrentLineup(false);
    }catch(error){message(error.name==='QuotaExceededError'?'本机存储配额不足，未主动删除原记录。请先导出备份。':error.message,true);}
  }
  function onInput(event){
    const target=event.target;
    if(target.id==='foundationPlayerSearch'){state.query=target.value;const query=state.query.toLowerCase(),ids=new Set(registry.historicalObservations(state.clubId).map(row=>row.playerId));$('#foundationPlayerRows').innerHTML=playerRows(registry.all().filter(row=>ids.has(row.id)&&[row.displayName,row.id,...row.aliases].join(' ').toLowerCase().includes(query)));}
    const fields={lineupMatchId:'matchId',lineupKickoff:'kickoff',lineupStatus:'status',lineupSource:'sourceId',lineupPublishedAt:'publishedAt',lineupObservedAt:'observedAt',lineupNotes:'notes'};
    if(fields[target.id])state.lineupDraft[fields[target.id]]=target.value;
    if(target.id==='lineupPartial')state.lineupDraft.partial=target.checked;
    if(target.dataset.lineupPlayer){const row=state.selected.find(row=>row.playerId===target.dataset.lineupPlayer);if(row)row[target.dataset.lineupField]=target.dataset.lineupField==='starter'?target.checked:target.dataset.lineupField==='expectedMinutes'?(target.value===''?null:Number(target.value)):target.value;}
  }
  async function onChange(event){
    onInput(event);const target=event.target;
    try{
      if(target.id==='foundationClub'){state.clubId=target.value;state.query='';renderPlayers();}
      if(target.id==='lineupTeam'){state.lineupDraft.teamId=target.value;state.lineupDraft.sourceId='';state.selected=[];renderLineups();}
      if(['foundationRegistryImport','foundationLineupsImport'].includes(target.id)&&target.files[0]){
        const file=target.files[0];if(file.size>4000000)throw new Error('导入文件超过4MB，未读取或覆盖已有记录。');
        const payload=JSON.parse(await file.text());
        if(target.id==='foundationRegistryImport'){mergeRegistry(payload);message('已校验并合并到本机球员库。没有上传、自动认证或启用概率修正。');renderPlayers();}
        else{importLineups(payload);message('阵容记录已合并。导入条目均标为外部未验证，不认证为真实赛前证据。');renderLineups();}
      }
    }catch(error){message(error.name==='QuotaExceededError'?'本机存储已满，原有内容未主动删除。':error.message,true);if(target.type==='file')target.value='';}
  }
  function onSubmit(event){if(event.target.id!=='foundationLineupForm')return;event.preventDefault();try{validateCurrentLineup(true);}catch(error){message(error.name==='QuotaExceededError'?'本机存储配额不足，阵容未保存，原记录未主动删除。':error.message,true);}}
  document.head.insertAdjacentHTML('beforeend','<link rel="stylesheet" href="css/prediction-foundation.css">');
  window.addEventListener('ucl:predictor-view',event=>{if(event.detail==='foundation')show();});
  window.addEventListener('ucl:forecast-rendered',event=>{attachComparison(event.detail).catch(()=>{/* Formal predictions remain independent. */});});
  window.UclPredictionFoundation={show,getRegistry:()=>registry,getArtifacts:()=>artifacts,getSelected:()=>clone(state.selected)};
  const existing=window.UclPredictorPage?.getForecast?.();if(existing)attachComparison(existing);
  if(!host.hidden)show();
})();
