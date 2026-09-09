const escapeClubText=value=>String(value??"").replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
  // Keep fixture labels tied to the same club identities as standings.
  // Absence is checked against UEFA's complete 2025/26 league-phase list:
  // https://www.uefa.com/uefachampionsleague/news/029c-1e92123f27d7-f1c1fabba5f1-1000/
  const fixtureClubMarkup=rawName=>{
    const name=canonicalTeamName(rawName),info=leagueTeamInfo(name),domestic=clubDomesticHistory[name];
    const domesticSeason=domestic?.league==='挪超'?'2025':'2025/26',rank=domestic?.ranks?.[2];
    const domesticText=rank==null?'国内排名待核实':typeof rank==='number'?`上季${domestic.league}第${rank}`:`上季${rank}`;
    const absent=new Set(['AEK Athens','Aston Villa','AS Roma','Como','FC Porto','Fenerbahce','Feyenoord','LASK','Lens','Lille','Manchester United','RB Leipzig','Real Betis','Sabah','Shakhtar Donetsk','Slovan Bratislava','VfB Stuttgart','Viking']);
    const ucl=info?.previousRank!=null?`<em class="previous-ucl" title="2025/26 欧冠联赛阶段最终第${info.previousRank}名">上季欧冠第${info.previousRank}</em>`:absent.has(name)?'<em class="ucl-new" title="2025/26 未进入欧冠联赛阶段（可能参加过资格赛）" aria-label="上赛季无欧冠联赛阶段排名">♞</em>':'<em>欧冠待核实</em>';
    return `<span class="fixture-club"><strong>${escapeClubText(teamChineseName(name))}</strong><small>${escapeClubText(name)}</small><span class="fixture-context"><em class="pot-${info?.pot||0}" title="2026/27 欧冠抽签档位">${info?`第${info.pot}档`:'档位待核实'}</em><em class="domestic-rank" title="${domesticSeason} 国内联赛最终排名">${escapeClubText(domesticText)}</em>${ucl}</span></span>`;
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
