const ESPN_URL='https://site.api.espn.com/apis/site/v2/sports/soccer/uefa.champions/scoreboard';
const ALIASES=new Map(Object.entries({'Paris Saint Germain':'Paris Saint-Germain','Internazionale':'Internazionale','Inter Milan':'Internazionale','FC Barcelona':'Barcelona','Bayern München':'Bayern Munich','AS Roma':'Roma','FC Porto':'FC Porto','PSV':'PSV Eindhoven','Bodø/Glimt':'Bodo/Glimt','Fenerbahçe':'Fenerbahce','Sporting Lisbon':'Sporting CP','Slavia Praha':'Slavia Prague','Slovan Bratislava':'Slovan Bratislava'}));
function canonical(value=''){const name=value.trim();return ALIASES.get(name)||name}
function roundFor(date){if(date<'2027-03-01')return'playoff';if(date<'2027-04-01')return'round16';if(date<'2027-04-20')return'quarterfinal';if(date<'2027-05-20')return'semifinal';return'final'}
function eventText(detail,home,away){
  const athlete=detail.athletes?.[0]?.displayName||detail.athlete?.displayName||'';
  const team=detail.team?.id===home.id?home.team.displayName:detail.team?.id===away.id?away.team.displayName:'';
  const type=detail.type?.text||detail.type?.displayName||'';
  return [type,athlete,team].filter(Boolean).join(' · ')||detail.text||'关键事件';
}
function json(payload,status=200){return new Response(JSON.stringify(payload),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store, max-age=0','x-content-type-options':'nosniff'}})}
export async function onRequestGet(){
  const checkedAt=new Date().toISOString();
  try{
    const responses=await Promise.all([2026,2027].map(year=>fetch(`${ESPN_URL}?dates=${year}&limit=600`,{headers:{accept:'application/json','user-agent':'UCL-Data-Center/1.0'}})));
    if(responses.some(response=>!response.ok))throw new Error('ESPN upstream unavailable');
    const payloads=await Promise.all(responses.map(response=>response.json()));
    const matches=payloads.flatMap(payload=>payload.events||[]).map(event=>{
      const competition=event.competitions?.[0],home=competition?.competitors?.find(team=>team.homeAway==='home'),away=competition?.competitors?.find(team=>team.homeAway==='away');
      const date=event.date?.slice(0,10)||'';if(!competition||!home||!away||date<'2027-02-01'||date>'2027-06-10')return null;
      const completed=Boolean(event.status?.type?.completed),inProgress=Boolean(event.status?.type?.state==='in');
      const timeline=(competition.details||[]).filter(detail=>detail.scoringPlay||/card|goal|substitution/i.test(detail.type?.text||'')).map(detail=>({clock:detail.clock?.displayValue||'',type:detail.type?.text||'',text:eventText(detail,home,away)}));
      return {id:event.id,date,round:roundFor(date),home:canonical(home.team.displayName),away:canonical(away.team.displayName),homeScore:Number(home.score||0),awayScore:Number(away.score||0),completed,inProgress,status:event.status?.type?.shortDetail||event.status?.type?.description||'',timeline};
    }).filter(Boolean).sort((a,b)=>a.date.localeCompare(b.date));
    return json({source:'ESPN Scoreboard API',checkedAt,matches});
  }catch(error){return json({source:'ESPN Scoreboard API',checkedAt,matches:[],warning:error instanceof Error?error.message:String(error)},200)}
}
