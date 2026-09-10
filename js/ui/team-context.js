const escapeClubText=value=>String(value??"").replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
const teamLogoMarkup=(rawName,size='small')=>{
  const name=canonicalTeamName(rawName),info=leagueTeamInfo(name),code=info?.code||teamChineseName(name).replace(/[^\p{L}\p{N}]/gu,'').slice(0,2).toUpperCase()||'?';
  const image=info?.logo?`<img src="${escapeClubText(info.logo)}" width="128" height="128" loading="lazy" decoding="async" alt="" data-club-logo>`:'';
  return `<span class="club-logo club-logo-${escapeClubText(size)}" aria-hidden="true"><span>${escapeClubText(code)}</span>${image}</span>`;
};
if(typeof document!=='undefined')document.addEventListener('error',event=>{if(event.target?.matches?.('img[data-club-logo]'))event.target.hidden=true},true);
  // Keep fixture labels tied to the same club identities as standings.
  // Absence is checked against UEFA's complete 2025/26 league-phase list:
  // https://www.uefa.com/uefachampionsleague/news/029c-1e92123f27d7-f1c1fabba5f1-1000/
  const fixtureClubMarkup=rawName=>{
    const name=canonicalTeamName(rawName),info=leagueTeamInfo(name),domestic=clubDomesticHistory[name];
    const season=globalThis.window?.uclSeason||{current:true,label:'2026/27',previousLabel:'2025/26'},domesticSeason=domestic?.league==='挪超'?season.previousLabel.slice(0,4):season.previousLabel,rank=domestic?.ranks?.[2];
    const domesticText=rank==null?'国内排名待核实':typeof rank==='number'?`上季${domestic.league}第${rank}`:`上季${rank}`;
    const absent=new Set(['AEK Athens','Aston Villa','AS Roma','Como','FC Porto','Fenerbahce','Feyenoord','LASK','Lens','Lille','Manchester United','RB Leipzig','Real Betis','Sabah','Shakhtar Donetsk','Slovan Bratislava','VfB Stuttgart','Viking']);
    const ucl=info?.previousRank!=null?`<em class="previous-ucl" title="${season.previousLabel} 欧冠联赛阶段最终第${info.previousRank}名">上季欧冠第${info.previousRank}</em>`:season.previousLabel==='2023/24'?'<em title="上季为小组赛制，没有统一联赛排名">上季小组赛制</em>':(absent.has(name)||!season.current)?`<em class="ucl-new" title="${season.previousLabel} 未进入欧冠联赛阶段" aria-label="上赛季无欧冠联赛阶段排名">♞</em>`:'<em>欧冠待核实</em>';
    return `<span class="fixture-club"><span class="fixture-club-heading">${teamLogoMarkup(name,'card')}<span><strong>${escapeClubText(teamChineseName(name))}</strong><small>${escapeClubText(name)}</small></span></span><span class="fixture-context"><em class="pot-${info?.pot||0}" title="${season.label} 欧冠抽签档位">${info?`第${info.pot}档`:'档位待核实'}</em><em class="domestic-rank" title="${domesticSeason} 国内联赛最终排名">${escapeClubText(domesticText)}</em>${ucl}</span></span>`;
  };
/** Lower pot numbers mean higher draw pots; missing pots remain unclassified. */
function resultPotOutcome(homePot,awayPot,score){
  const valid=pot=>Number.isInteger(pot)&&pot>=1&&pot<=4;
  const goals=/^(\d+)\s*[-–]\s*(\d+)$/.exec(String(score).trim());
  if(!valid(homePot)||!valid(awayPot)||!goals)return {kind:'unknown',label:'档位或比分不足，未分类'};
  const home=Number(goals[1]),away=Number(goals[2]);
  if(homePot===awayPot)return home===away?{kind:'yellow',label:'同档平局'}:{kind:'blue',label:'同档分出胜负'};
  if(home===away)return {kind:'red',label:'跨档平局'};
  const winnerPot=home>away?homePot:awayPot;
  return winnerPot===Math.min(homePot,awayPot)?{kind:'green',label:'高档球队获胜'}:{kind:'red',label:'低档球队获胜'};
}
