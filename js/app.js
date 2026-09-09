document.head.insertAdjacentHTML('beforeend','<link rel="stylesheet" href="css/enhancements.css"><link rel="stylesheet" href="css/result-clickable.css">');
const teams=leagueTeamCatalog.map(team=>[team.zh,team.name,team.code,0,0,0,0,0,0,0,'',team.pot,team.previousRank]);
const verifiedQualificationMatches=(typeof qualificationResults==='undefined'?[]:qualificationResults.map(m=>[m[0],m[3],m[4],`${m[5]}-${m[6]}`,'—','qualifying']));
const initialMatchMap=new Map([...rawMatches,...verifiedQualificationMatches].map(m=>{const row=[m[0],canonicalTeamName(m[1]),canonicalTeamName(m[2]),m[3],m[4],m[5]];return [row.slice(0,3).join('|'),row]}));
const matches=[...initialMatchMap.values()].sort((a,b)=>b[0].localeCompare(a[0]));
document.documentElement.dataset.staticVerified='2026-08-26';
const display=n=>String(n).includes(' / ')?`${n.split(' / ').map(team=>teamChineseName(team)).join(' / ')}（${n.split(' / ').map(team=>canonicalTeamName(team)).join(' / ')}）`:`${teamChineseName(n)}（${canonicalTeamName(n)}）`;
const tbody=document.querySelector('#standings');
document.querySelector('.standings-legends').insertAdjacentHTML('beforeend','<div class="history-legend" aria-label="上赛季排名变化说明"><b>排名变化</b><span><i class="previous-rank">上季 8</i>上季联赛阶段排名</span><span><i class="rank-change up">↑3</i>上升</span><span><i class="rank-change down">↓2</i>下降</span><span><i class="newcomer-knight">♞</i>上季未进入联赛阶段</span></div>');
const leaguePhaseStarted=()=>matches.some(match=>match[5]==='league');
const rankHistoryMarkup=(team,currentRank)=>{const previous=team[12],change=leagueRankChange(previous,currentRank,leaguePhaseStarted());if(change.kind==='new')return '<span class="newcomer-knight" title="上赛季未进入欧冠联赛阶段" aria-label="上赛季未进入欧冠联赛阶段">♞</span>';const previousBadge=`<span class="previous-rank" title="2025/26欧冠联赛阶段最终排名">上季 ${previous}</span>`;if(change.kind==='pending')return previousBadge;const arrow=change.kind==='up'?'↑':change.kind==='down'?'↓':'→';return `${previousBadge}<span class="rank-change ${change.kind}" title="相较上赛季联赛阶段排名${change.kind==='up'?'上升':change.kind==='down'?'下降':'不变'}${change.value}位">${arrow}${change.value}</span>`};
function render(q=''){tbody.innerHTML=teams.map((t,i)=>({t,i})).filter(({t})=>(t[0]+t[1]).toLowerCase().includes(q.toLowerCase())).map(({t,i})=>`<tr class="rank r${i+1} pot-${t[11]}" data-team="${t[1]}" tabindex="0" aria-label="查看${t[0]}详情"><td>${i+1}</td><td class="team"><i class="badge">${t[2]}</i><span class="bilingual"><strong>${t[0]}</strong><small>${t[1]}</small></span><span class="team-history">${rankHistoryMarkup(t,i+1)}</span><em class="pot-chip">第${t[11]}档</em></td><td>${t[3]}</td><td>${t[4]}</td><td>${t[5]}</td><td>${t[6]}</td><td>${t[7]}–${t[8]}</td><td>${t[7]-t[8]>0?'+':''}${t[7]-t[8]}</td><td class="pts">${t[9]}</td><td><span class="form">${[...t[10]].map(x=>`<i class="${x.toLowerCase()}">${x==='W'?'胜':x==='D'?'平':'负'}</i>`).join('')||'—'}</span></td></tr>`).join('');}
render();document.querySelector('#search').oninput=e=>render(e.target.value);
function renderResults(){
  const latest=matches.slice(0,8),grid=document.querySelector('#resultGrid');
  if(!document.querySelector('#resultColorLegend'))grid.insertAdjacentHTML('beforebegin','<div id="resultColorLegend" class="result-color-legend" aria-label="赛果底色说明"><span class="green">高档胜低档</span><span class="red">跨档平局 / 低档获胜</span><span class="yellow">同档平局</span><span class="blue">同档分出胜负</span><small>第1档最高 · 无完整档位时不分类</small></div>');
  grid.innerHTML=latest.map(m=>{
    const outcome=resultPotOutcome(leaguePotFor(m[1]),leaguePotFor(m[2]),m[3]);
    return `<div class="match result-${outcome.kind}" role="button" tabindex="0" aria-label="${escapeClubText(teamChineseName(m[1]))} 对 ${escapeClubText(teamChineseName(m[2]))}，${escapeClubText(m[3])}，${outcome.label}，查看详情" data-date="${m[0]}" data-home="${encodeURIComponent(m[1])}" data-away="${encodeURIComponent(m[2])}"><div class="result-card-meta"><time>${m[0].slice(5).replace('-',' / ')}</time><span class="result-verdict">${outcome.label}</span></div><div class="result-teams">${fixtureClubMarkup(m[1])}<b class="result-score">${escapeClubText(m[3])}</b>${fixtureClubMarkup(m[2])}</div><small class="result-half">半场 ${escapeClubText(m[4])}　·　全场 ${escapeClubText(m[3])}</small><span class="match-detail-cue">查看详细信息 →</span></div>`;
  }).join('');
  grid.querySelectorAll('.match').forEach(card=>{
    const open=()=>window.openFixtureDetail?.(decodeURIComponent(card.dataset.home),decodeURIComponent(card.dataset.away),card.dataset.date,'');
    card.onclick=open;card.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();open()}};
  });
  document.querySelector('.hero-stat b').textContent=matches.length;
}
renderResults();
const drawer=document.querySelector('#drawer'),overlay=document.querySelector('#overlay');
function close(){drawer.classList.remove('open');overlay.classList.remove('open');if(location.hash.startsWith('#team='))history.replaceState(null,'',location.pathname+location.search)}document.querySelector('#close').onclick=close;overlay.onclick=close;document.querySelector('#latestBtn').onclick=()=>document.querySelector('#latest').scrollIntoView({behavior:'smooth'});
