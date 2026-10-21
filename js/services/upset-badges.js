(function(root){
  'use strict';

  const escape=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const score=value=>/^\d+\s*[-–]\s*\d+$/.test(String(value))?String(value).split(/[-–]/).map(Number):null;

  // Pots are draw seeds (1 is highest), not the changing league-table position.
  // Rebuild from completed rows: refreshing never increments a stored counter.
  function calculate(rows,catalog,canonical=value=>String(value||'').trim(),seasonKey=''){
    const clubs=new Map(catalog.map(team=>[canonical(team.name),team]));
    const counters=new Map([...clubs].map(([name])=>[name,{bull:0,rabbit:0,wins:[],losses:[]}]));
    const games=new Map();
    const year=/^\d{4}-\d{2}$/.test(seasonKey)?Number(seasonKey.slice(0,4)):null;
    for(const row of rows||[]){
      if(!Array.isArray(row)||!['league','knockout'].includes(row[5]))continue;
      const [date,rawHome,rawAway]=row,home=canonical(rawHome),away=canonical(rawAway);
      if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date+'T12:00:00Z'))||new Date(date+'T12:00:00Z').toISOString().slice(0,10)!==date||!clubs.has(home)||!clubs.has(away)||home===away)continue;
      if(year&&(date<`${year}-07-01`||date>`${year+1}-06-30`))continue;
      // League opponents meet once; use the latest date if a fixture was moved.
      // Knockout matches are individual legs, never a tie's aggregate score.
      const key=`${row[5]}|${row[5]==='league'?'':date+'|'}${home}|${away}`;
      if(!games.has(key)||date>=games.get(key).date)games.set(key,{date,home,away,score:row[3]});
    }
    for(const game of games.values()){
      const result=score(game.score),hp=clubs.get(game.home).pot,ap=clubs.get(game.away).pot;
      if(!result||!Number.isInteger(hp)||!Number.isInteger(ap)||hp<1||hp>4||ap<1||ap>4||hp===ap||result[0]===result[1])continue;
      const winner=result[0]>result[1]?game.home:game.away,loser=winner===game.home?game.away:game.home;
      if(clubs.get(winner).pot<clubs.get(loser).pot)continue;
      counters.get(winner).bull++;counters.get(winner).wins.push(game);
      counters.get(loser).rabbit++;counters.get(loser).losses.push(game);
    }
    return counters;
  }

  function icon(kind,count=''){
    const shape=kind==='bull'
      ?'<path d="M15 16C7 18 2 12 3 4c3 7 7 7 12 5l9 3 9-3c5 2 9 2 12-5 1 8-4 14-12 12Z"/><path d="m13 18-7-2 5 10 4 1 3 12q6 5 12 0l3-12 4-1 5-10-7 2q-11-10-22 0Z"/><path class="upset-face" d="m13 25 4 2m18-2-4 2M21 38h6"/>'
      :'<path d="M12 22C3 7 10-5 17 4l6 15h2L31 4c7-9 14 3 5 18 11 17 0 22-12 22S1 39 12 22Z"/><path class="upset-face" d="m12 7 5 12M36 7l-5 12m-17 12h1m18 0h1M22 39h4"/>';
    return `<svg viewBox="0 0 48 48" aria-hidden="true" focusable="false">${shape}${count!==''?`<text x="24" y="${kind==='bull'?29:33}" text-anchor="middle" class="upset-count${String(count).length>1?' upset-count-wide':''}">${count}</text>`:''}</svg>`;
  }

  let counters=new Map();
  const canonical=name=>typeof canonicalTeamName==='function'?canonicalTeamName(name):String(name||'').trim();
  const info=name=>typeof leagueTeamInfo==='function'?leagueTeamInfo(name):null;
  const get=name=>counters.get(canonical(name))||{bull:0,rabbit:0,wins:[],losses:[]};
  function badge(kind,count,name){
    if(!count)return '';
    const label=`${info(name)?.zh||name}：${kind==='bull'?'低档胜高档':'高档负低档'} ${count} 次（${root.uclSeason?.label||'本赛季'}正赛累计）`;
    return `<span class="upset-badge upset-${kind}" role="img" aria-label="${escape(label)}" title="${escape(label)}" data-upset-kind="${kind}" data-count="${count}">${icon(kind,count)}</span>`;
  }
  const badges=name=>{const s=get(name);return badge('bull',s.bull,name)+badge('rabbit',s.rabbit,name);};
  const slot=name=>info(name)?`<span class="upset-badges" data-upset-team="${escape(canonical(name))}">${badges(name)}</span>`:'';
  function refresh(rows){
    counters=calculate(rows,typeof leagueTeamCatalog==='undefined'?[]:leagueTeamCatalog,canonical,root.uclSeason?.key||'');
    root.document?.querySelectorAll('[data-upset-team]').forEach(el=>{const html=badges(el.dataset.upsetTeam);if(el.innerHTML!==html)el.innerHTML=html;});
    return counters;
  }
  const legend=()=>`<div class="upset-legend"><span><i class="upset-legend-icon upset-bull">${icon('bull')}</i>红牛头：低档胜高档</span><span><i class="upset-legend-icon upset-rabbit">${icon('rabbit')}</i>绿兔头：高档负低档</span><small>数字为所选赛季正赛（联赛阶段及淘汰赛单场）累计次数；第1档最高。平局、同档、资格赛与档位缺失的比赛不计入，不以两回合总比分或点球判定胜负，0次不显示。</small></div>`;
  root.uclUpsets={calculate,score,get,slot,refresh,legend};
})(typeof window!=='undefined'?window:globalThis);

