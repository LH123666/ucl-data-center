(function(root){
  'use strict';
  const SCORE_KEYS=['1:0','2:0','2:1','3:0','3:1','3:2','4:0','4:1','4:2','5:0','5:1','5:2','胜其他','0:0','1:1','2:2','3:3','平其他','0:1','0:2','1:2','0:3','1:3','2:3','0:4','1:4','2:4','0:5','1:5','2:5','负其他'];
  const HALF_KEYS=['胜胜','胜平','胜负','平胜','平平','平负','负胜','负平','负负'];
  const HALF_SOURCES=new Set(['official','events','zero-zero','archive','snapshot']);
  const parseScore=value=>{const m=/^(\d{1,2})\s*[-–:]\s*(\d{1,2})$/.exec(String(value??'').trim());return m?[Number(m[1]),Number(m[2])]:null;};
  const outcome=([home,away])=>home>away?'胜':home<away?'负':'平';
  const bins=keys=>Object.fromEntries(keys.map(key=>[key,0]));
  const distribution=(counts,total,samples={})=>({total,present:Object.values(counts).filter(n=>n>0).length,cells:Object.entries(counts).map(([key,count])=>({key,count,percent:total?count/total*100:null,matches:samples[key]||[]}))});
  const validDate=value=>{if(!/^\d{4}-\d{2}-\d{2}$/.test(String(value)))return false;const date=new Date(value+'T12:00:00Z');return Number.isFinite(date.getTime())&&date.toISOString().slice(0,10)===value;};

  // The table is a league-phase table, so these samples use the same phase.
  // No live scores, qualifiers, aggregate scores or inferred handicaps enter it.
  function summarize(rows,{fixtures=[],canonicalize=value=>String(value||'').trim(),seasonKey='',matchday=0}={}){
    const pair=(home,away)=>`${canonicalize(home)}|${canonicalize(away)}`;
    const baseline=new Map(fixtures.map(f=>[pair(f.home,f.away),f]));
    const games=new Map(),year=/^\d{4}-\d{2}$/.test(seasonKey)?Number(seasonKey.slice(0,4)):null;
    for(const row of rows||[]){
      if(!Array.isArray(row)||row[5]!=='league'||!validDate(row[0]))continue;
      if(year&&(row[0]<`${year}-07-01`||row[0]>`${year+1}-06-30`))continue;
      const home=canonicalize(row[1]),away=canonicalize(row[2]);
      if(!home||!away||home===away)continue;
      const key=pair(home,away),base=baseline.get(key),md=Number(row[7]||base?.matchday)||null;
      const game={date:row[0],time:row[9]||base?.time||'',home,away,score:row[3],half:row[4],halfSource:row[10],matchday:md};
      if(!games.has(key)||game.date>=games.get(key).date)games.set(key,game);
    }
    const counts={had:bins(['主胜','平局','客胜']),score:bins(SCORE_KEYS),goals:bins(['0','1','2','3','4','5','6','7+']),half:bins(HALF_KEYS)};
    const samples={goals:Object.fromEntries(Object.keys(counts.goals).map(key=>[key,[]])),half:Object.fromEntries(HALF_KEYS.map(key=>[key,[]]))};
    let total=0,halfTotal=0,invalidScores=0,latest='';
    for(const game of games.values()){
      if(matchday&&game.matchday!==Number(matchday))continue;
      const full=parseScore(game.score);
      if(!full){invalidScores++;continue;}
      total++;if(game.date>latest)latest=game.date;
      const result=outcome(full),key=full.join(':');
      counts.had[{胜:'主胜',平:'平局',负:'客胜'}[result]]++;
      counts.score[Object.hasOwn(counts.score,key)?key:result+'其他']++;
      const half=parseScore(game.half)||(full[0]===0&&full[1]===0?[0,0]:null);
      const knownHalf=half&&(HALF_SOURCES.has(game.halfSource)||(full[0]===0&&full[1]===0))&&half[0]<=full[0]&&half[1]<=full[1];
      const sample={...game,score:full.join('-'),half:knownHalf?half.join('-'):'—'};
      const goals=full[0]+full[1],goalKey=goals>=7?'7+':String(goals);counts.goals[goalKey]++;samples.goals[goalKey].push(sample);
      if(knownHalf){
        const halfKey=outcome(half)+result;halfTotal++;counts.half[halfKey]++;samples.half[halfKey].push(sample);
      }
    }
    return {total,latest,invalidScores,halfMissing:total-halfTotal,
      had:distribution(counts.had,total),score:distribution(counts.score,total),goals:distribution(counts.goals,total,samples.goals),half:distribution(counts.half,halfTotal,samples.half)};
  }

  // One absolute percentage scale is shared by all panels, not normalized per row.
  const stops=[[0,[255,255,255]],[1,[255,244,208]],[8,[255,190,37]],[16,[255,122,15]],[25,[217,43,32]],[40,[180,8,52]],[55,[101,7,60]],[100,[72,6,41]]];
  const luminance=rgb=>rgb.map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;}).reduce((n,v,i)=>n+v*[.2126,.7152,.0722][i],0);
  function tone(percent){
    if(percent===null)return {background:'#f2f3f4',foreground:'#6c7177'};
    const p=Math.max(0,Math.min(100,percent));let lower=stops[0],upper=stops[1];
    for(let i=1;i<stops.length;i++){upper=stops[i];lower=stops[i-1];if(p<=upper[0])break;}
    const ratio=(p-lower[0])/(upper[0]-lower[0]),rgb=lower[1].map((v,i)=>Math.round(v+(upper[1][i]-v)*ratio)),l=luminance(rgb),dark=[54,24,12];
    const whiteContrast=1.05/(l+.05),darkContrast=(l+.05)/(luminance(dark)+.05);
    const foreground=Math.max(whiteContrast,darkContrast)<4.5?'#000000':whiteContrast>darkContrast?'#ffffff':'#36180c';
    return {background:`rgb(${rgb.join(',')})`,foreground};
  }

  const esc=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const pct=percent=>percent===null?'—':percent.toFixed(2)+'%';
  const clickable=new Set(['goals','half']);
  let selectedRound=0,latestRows=[],container,selectedCell=null,activeGames=[];
  function cell(value,total,kind){
    const colors=tone(value.percent),label=`${value.key}：${value.count}次，${pct(value.percent)}，${total}场有效样本`;
    const interactive=clickable.has(kind),tag=interactive?'button':'div',expanded=selectedCell?.kind===kind&&selectedCell?.key===value.key;
    const attrs=interactive?`type="button" data-heatmap-select="${kind}" aria-controls="heatmapMatchDetails" aria-expanded="${expanded}" aria-label="${esc(label)}，查看对应比赛"`:'role="listitem"';
    return `<${tag} class="heatmap-cell${interactive?' heatmap-clickable':''}${value.percent===null?' heatmap-no-data':''}" ${attrs} data-key="${esc(value.key)}" data-count="${value.count}" data-total="${total}" style="background:${colors.background};color:${colors.foreground}" title="${esc(label)}${interactive?'，点击查看具体比赛':''}"><span>${esc(value.key)}</span><strong>${pct(value.percent)}</strong><small>${total?`${value.count}次出现 / ${total}场`:'暂无有效样本'}</small></${tag}>`;
  }
  function panel(kind,title,code,data,note=''){
    const interactive=clickable.has(kind),meta=`${data.total}场有效样本 · ${data.present}种结果已出现${interactive?' · 点击方框查看比赛':''}`;
    return `<section class="heatmap-panel" data-heatmap-kind="${kind}" aria-label="${title}分布"><div class="heatmap-panel-head"><h3>${title} <small>${code}</small></h3><span>${meta}</span></div><div class="heatmap-grid heatmap-${kind}" role="${interactive?'group':'list'}" aria-label="${title}出现次数与比例">${data.cells.map(value=>cell(value,data.total,kind)).join('')}</div>${note?`<p class="heatmap-panel-note">${note}</p>`:''}</section>`;
  }
  function matchDetails(data,kind){
    activeGames=[...data.matches].sort((a,b)=>(b.date+b.time).localeCompare(a.date+a.time)||a.home.localeCompare(b.home));
    const label=kind==='goals'?`总进球 ${data.key==='7+'?'7球及以上':data.key+'球'}`:`半全场 ${data.key}`;
    const resultWords={胜:'领先',平:'打平',负:'落后'},fullWords={胜:'获胜',平:'打平',负:'落败'};
    const explanation=kind==='half'?`主队半场${resultWords[data.key[0]]}、全场${fullWords[data.key[1]]}。`:'全场双方总进球'+(data.key==='7+'?'达到7球或以上。':`为${data.key}球。`);
    const club=name=>{if(typeof fixtureClubMarkup!=='function')return '<span>'+esc(name)+'</span>';const html=fixtureClubMarkup(name),profile=typeof clubHistoryFor==='function'&&leagueTeamInfo(name)?clubHistoryFor(name):null;return profile?html.replace(/<\/span><\/span>$/,`<em class="entry-route" title="${esc(root.uclSeason?.label||'')}进入欧冠正赛方式">${profile.entry==='qualifying'?'资格赛晋级':'直接入围正赛'}</em></span></span>`):html;};
    const describe=name=>typeof teamChineseName==='function'?teamChineseName(name):name;
    const sourceNote='<p class="heatmap-panel-note">球队标签与所选赛季的身份目录一致；国内名次、上季欧冠记录未核实的项目不推算。历史日期沿用归档原记录，未确认时区不另作换算；当前在线赛果时间为北京时间。</p>';
    return `<section id="heatmapMatchDetails" class="heatmap-match-details" aria-labelledby="heatmapMatchTitle" tabindex="-1"><div class="heatmap-detail-head"><div><p>${esc(root.uclSeason?.label||'')} · ${selectedRound?'第'+selectedRound+'轮':'全部轮次'} · 联赛阶段</p><h3 id="heatmapMatchTitle">${label}<span>${activeGames.length}场比赛</span></h3></div><button type="button" class="heatmap-detail-close" data-close-heatmap aria-label="关闭对应比赛列表">关闭 ×</button></div><p class="heatmap-detail-note">${explanation}比分以主队–客队排列；点击比赛可查看详细信息。</p><div class="heatmap-match-list" role="list" aria-label="${label}对应比赛">${activeGames.length?activeGames.map((game,index)=>{const date=game.date,time=game.time?`${game.time} 北京时间`:'开球时间未记录',goals=parseScore(game.score).reduce((a,b)=>a+b,0);return `<div role="listitem"><button type="button" class="heatmap-match-row" data-heatmap-match="${index}" aria-label="${esc(date+' '+describe(game.home)+'，比分'+game.score+'，'+describe(game.away))}，半场${esc(game.half)}，查看比赛详情"><time datetime="${esc(date)}">${esc(date)}<small>${esc(time)}</small></time><span class="heatmap-match-fixture">${club(game.home)}<b class="heatmap-match-score">${esc(game.score)}</b>${club(game.away)}</span><span class="heatmap-match-meta">半场 <b>${esc(game.half)}</b><small>总进球 ${goals}${game.matchday?' · 第'+game.matchday+'轮':''}</small><i>查看详情 →</i></span></button></div>`;}).join(''):'<p class="heatmap-matches-empty">当前赛季和轮次下，暂无符合条件的已获取比赛。</p>'}</div>${sourceNote}</section>`;
  }
  function closeDetails(){
    const previous=selectedCell;selectedCell=null;render(latestRows);
    if(previous)[...container.querySelectorAll('[data-heatmap-select]')].find(el=>el.dataset.heatmapSelect===previous.kind&&el.dataset.key===previous.key)?.focus({preventScroll:true});
  }
  function mount(){
    if(container)return container;
    const layout=root.document?.querySelector('.layout');if(!layout)return null;
    container=root.document.createElement('section');container.id='resultsHeatmap';container.className='ucl-heatmap';container.setAttribute('aria-labelledby','heatmapTitle');
    container.innerHTML=`<div class="heatmap-intro"><div><p class="eyebrow">RESULT DISTRIBUTION</p><h2 id="heatmapTitle">赛果分布热力图</h2><p id="heatmapSampleStatus" aria-live="polite">正在整理联赛阶段赛果…</p></div><label class="heatmap-filter" for="heatmapRound">联赛轮次 <select id="heatmapRound"><option value="0">全部8轮</option>${Array.from({length:8},(_,i)=>`<option value="${i+1}">第${i+1}轮</option>`).join('')}</select></label></div><div id="heatmapPanels"></div><div class="heatmap-footnote"><div class="heatmap-scale"><b>出现比例</b><span>低</span>${[0,8,16,25,40,55].map(v=>`<i style="background:${tone(v).background}" aria-hidden="true"></i>`).join('')}<span>高</span></div><p>以主队为视角；仅统计所选赛季已获取的联赛阶段完赛比分，不含资格赛、淘汰赛和点球大战。颜色表示历史出现比例，不是下一场比赛的预测概率；样本数不代表本赛季已经完整更新。半全场仅使用有来源且与全场比分一致的半场数据，分母单独计算；无数据以“—”显示。</p></div>`;
    layout.insertAdjacentElement('afterend',container);
    root.document.querySelector('nav')?.addEventListener('click',event=>{const button=event.target.closest('button');if(button)container.hidden=(button.id||'standings')!=='standings';});
    container.querySelector('#heatmapRound').onchange=event=>{selectedRound=Number(event.target.value);render(latestRows);};
    container.addEventListener('click',event=>{
      const trigger=event.target.closest('[data-heatmap-select]');
      if(trigger){
        const kind=trigger.dataset.heatmapSelect,key=trigger.dataset.key;
        if(selectedCell?.kind===kind&&selectedCell?.key===key){closeDetails();return;}
        selectedCell={kind,key};render(latestRows);
        const details=container.querySelector('#heatmapMatchDetails');details.focus({preventScroll:true});details.scrollIntoView?.({behavior:root.matchMedia?.('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'nearest'});return;
      }
      if(event.target.closest('[data-close-heatmap]')){closeDetails();return;}
      const row=event.target.closest('[data-heatmap-match]'),game=row&&activeGames[Number(row.dataset.heatmapMatch)];
      if(game)root.openFixtureDetail?.(game.home,game.away,game.date,game.time);
    });
    container.addEventListener('keydown',event=>{if(event.key==='Escape'&&selectedCell){event.preventDefault();closeDetails();}});
    return container;
  }
  function render(rows){
    latestRows=rows||[];const el=mount();if(!el)return;
    const stats=summarize(latestRows,{fixtures:typeof uclLeaguePhaseSchedule==='undefined'?[]:uclLeaguePhaseSchedule.map((f,i)=>({date:f[0],home:f[1],away:f[2],matchday:Math.floor(i/18)+1})),canonicalize:typeof canonicalTeamName==='function'?canonicalTeamName:undefined,seasonKey:root.uclSeason?.key||'',matchday:selectedRound});
    const scope=selectedRound?`第${selectedRound}轮`:'全部轮次';
    el.querySelector('#heatmapSampleStatus').textContent=`${root.uclSeason?.label||''} · 联赛阶段 · ${scope} · 已获取${stats.total}场完赛样本${stats.latest?' · 最新赛果日期 '+stats.latest:''}${stats.invalidScores?' · '+stats.invalidScores+'场比分无效未纳入':''}。样本数不代表赛季赛果已完整更新。`;
    const halfNote=stats.halfMissing?`${stats.halfMissing}场缺少可核验或一致的半场比分，未纳入本项统计。`:'半场来源：所选赛季快照/归档的已记录半场、官方半场字段、完整进球事件或0–0结果校验。';
    activeGames=[];
    const details=kind=>{const value=selectedCell?.kind===kind?stats[kind].cells.find(cell=>cell.key===selectedCell.key):null;return value?matchDetails(value,kind):'';};
    el.querySelector('#heatmapPanels').innerHTML=panel('had','胜平负','H / D / A',stats.had)
      +panel('score','比分','SCORE',stats.score)
      +panel('goals','总进球数','GOALS',stats.goals)+details('goals')
      +panel('half','半全场','HT / FT',stats.half,halfNote)+details('half')
      +(selectedCell?'':'<div id="heatmapMatchDetails" hidden></div>');
    return stats;
  }
  root.uclHeatmap={summarize,parseScore,tone,render};
})(typeof window!=='undefined'?window:globalThis);

