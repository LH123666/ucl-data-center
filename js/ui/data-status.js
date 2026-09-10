(function(){
  const labels={league:'联赛阶段赛果',qualifying:'资格赛',knockout:'淘汰赛'};
  const sources={league:'ESPN Scoreboard',qualifying:'UEFA / 本地核验数据',knockout:'ESPN / UEFA赛程'};
  const states={};let panel,summary;
  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const rowsFor=key=>matches.filter(row=>row[5]===key);
  const fingerprint=rows=>new Map(rows.map(row=>[row.slice(0,3).join('|'),row[3]]));
  const time=value=>value?new Date(value).toLocaleString('zh-CN',{hour12:false}):'尚无记录';
  const names={checking:'检查中',success:'更新成功',fallback:'使用缓存／本地回退',unavailable:'数据源不可用',scheduled:'尚未开赛',archive:'历史归档'};
  const snapshot=(key,rows=rowsFor(key))=>{states[key].count=rows.length;states[key].latest=rows.map(row=>row[0]).sort().at(-1)||'暂无赛果';states[key].last=fingerprint(rows)};
  function render(){
    if(!panel)return;
    const list=Object.values(states),ok=list.filter(item=>['success','scheduled'].includes(item.status)).length;
    summary=list.every(item=>item.status==='archive')?'历史归档':list.some(item=>item.status==='checking')?'正在分项检查…':ok===3?'全部检查成功':ok?'部分更新成功':list.some(item=>item.count)?'更新失败，保留已有数据':'数据源不可用';
    document.querySelector('#updatedAt').textContent=summary;
    panel.querySelector('summary').textContent='数据状态 · '+summary;
    panel.querySelector('.data-status-items').innerHTML=Object.entries(states).map(([key,s])=>`<article><div><b>${labels[key]}</b><strong class="status-${s.status}">${names[s.status]}</strong></div><p>来源：${esc(s.source)}</p><p>最近检查：${esc(time(s.checked))}</p><p>最近成功获取：${esc(time(s.success))}</p><p>当前收录：${s.count} 场 · 最新赛果日期：${esc(s.latest)}</p><small>${esc(s.message||'')}</small></article>`).join('');
  }
  window.uclDataStatus={
    init(){
      for(const key of Object.keys(labels)){states[key]={status:window.uclSeason.current?'fallback':'archive',source:window.uclSeason.current?sources[key]:'本站历史赛季归档',checked:null,success:null,message:window.uclSeason.current?'首次检查前使用本站随代码发布的数据':'归档载入不等同于实时获取'};snapshot(key)}
      panel=document.createElement('details');panel.className='data-status-panel';panel.innerHTML='<summary>数据状态</summary><div class="data-status-items"></div><p class="data-status-note">最新赛果日期不表示此前全部比赛已完整收录。检查时间与实际数据日期分别展示；时间为当前设备本地时间。</p>';
      document.querySelector('.update-wrap').appendChild(panel);render();
      document.head.insertAdjacentHTML('beforeend','<link rel="stylesheet" href="css/data-status.css">');
    },
    begin(key){const s=states[key];if(!s)return;s.before=s.last||fingerprint(rowsFor(key));s.status='checking';s.checked=new Date().toISOString();render()},
    finish(key,{ok=false,source,warning='',scheduled=false,cached=false,checkedAt,rows}={}){
      const s=states[key];if(!s)return;
      snapshot(key,rows);if(source)s.source=source;
      if(!s.checked)s.checked=new Date().toISOString();
      if(ok&&!warning&&!cached){
        s.status=scheduled?'scheduled':'success';if(!scheduled)s.success=checkedAt||new Date().toISOString();
        const now=fingerprint(rows||rowsFor(key));let added=0,changed=0;
        for(const [id,score] of now){if(!s.before?.has(id))added++;else if(s.before.get(id)!==score)changed++}
        s.message=scheduled?'根据本站赛程确认尚未开赛；未请求未来赛果':added||changed?`新增 ${added} 场，更新比分 ${changed} 场`:'检查完成，暂无新赛果';
      }else{
        s.status=s.count?'fallback':'unavailable';
        s.message=warning||'在线数据不可用，保留上次数据或本站静态数据';
        if(cached){s.status='fallback';s.message='接口返回缓存；当前检查时间不等于原始获取时间';if(checkedAt)s.success=checkedAt}
      }
      render();
    },
    archive(){for(const key of Object.keys(labels)){snapshot(key);states[key].status='archive';states[key].checked=new Date().toISOString()}render()},
    summary:()=>summary,
    get:()=>JSON.parse(JSON.stringify(states))
  };
})();
