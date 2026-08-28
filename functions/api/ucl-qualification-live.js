const OFFICIAL_URL='https://www.uefa.com/uefachampionsleague/accesslist/';
const RESULTS_URL='https://www.uefa.com/uefachampionsleague/news/02a6-20e5a8be4e63-ae971c582f8c-1000--champions-league-qualifying-results-how-it-worked/';
const TEAMS_URL='https://www.uefa.com/uefachampionsleague/news/02a8-2171a88881a0-c70193b972c6-1000--meet-the-2026-27-champions-league-league-phase-teams/';
const PLAYOFF_TIES=[
  ['Levski Sofia','AEK Athens'],['Dinamo Zagreb','Viking'],['Hapoel Beer-Sheva','Sabah'],
  ['Celtic','LASK'],['Slovan Bratislava','Celje'],['Fenerbahce','Lyon'],['NEC Nijmegen','Bodo/Glimt']
];
const DATES=new Map([
  ['Levski Sofia|AEK Athens',['2026-08-18','2026-08-26']],['Dinamo Zagreb|Viking',['2026-08-18','2026-08-26']],
  ['Hapoel Beer-Sheva|Sabah',['2026-08-19','2026-08-25']],['Celtic|LASK',['2026-08-19','2026-08-25']],
  ['Slovan Bratislava|Celje',['2026-08-19','2026-08-26']],['Fenerbahce|Lyon',['2026-08-18','2026-08-26']],
  ['NEC Nijmegen|Bodo/Glimt',['2026-08-19','2026-08-25']]
]);
const VERIFIED=[
  ['2026-08-18','Levski Sofia','AEK Athens',0,0],
  ['2026-08-18','Dinamo Zagreb','Viking',2,2],
  ['2026-08-18','Fenerbahce','Lyon',1,1],
  ['2026-08-19','Celtic','LASK',3,0],
  ['2026-08-19','NEC Nijmegen','Bodo/Glimt',1,3],
  ['2026-08-19','Slovan Bratislava','Celje',1,1],
  ['2026-08-19','Hapoel Beer-Sheva','Sabah',2,1],
  ['2026-08-25','Sabah','Hapoel Beer-Sheva',5,2],
  ['2026-08-25','LASK','Celtic',5,1],
  ['2026-08-25','Bodo/Glimt','NEC Nijmegen',3,0],
  ['2026-08-26','AEK Athens','Levski Sofia',4,0],
  ['2026-08-26','Viking','Dinamo Zagreb',3,1],
  ['2026-08-26','Celje','Slovan Bratislava',1,2],
  ['2026-08-26','Lyon','Fenerbahce',1,2]
].map(([date,home,away,homeScore,awayScore])=>({date,round:'附加赛',home,away,homeScore,awayScore,completed:true,inProgress:false}));
const LEAGUE_TEAMS=[['AEK Athens','AEK'],['Arsenal','ARS'],['Aston Villa','AVL'],['Atlético Madrid','ATM'],['Barcelona','BAR'],['Bayern Munich','FCB'],['Bodo/Glimt','BOG'],['Borussia Dortmund','BVB'],['Club Brugge','BRU'],['Como','COM'],['Fenerbahce','FEN'],['Feyenoord','FEY'],['Galatasaray','GAL'],['Internazionale','INT'],['LASK','LASK'],['RB Leipzig','RBL'],['Lens','LEN'],['Lille','LIL'],['Liverpool','LIV'],['Manchester City','MCI'],['Manchester United','MUN'],['Napoli','NAP'],['Paris Saint-Germain','PSG'],['FC Porto','POR'],['PSV Eindhoven','PSV'],['Real Betis','BET'],['Real Madrid','RMA'],['Roma','ROM'],['Sabah','SAB'],['Shakhtar Donetsk','SHK'],['Slavia Prague','SLA'],['Slovan Bratislava','SLO'],['Sporting CP','SCP'],['VfB Stuttgart','VFB'],['Viking','VIK'],['Villarreal','VIL']];
const ALIASES=new Map(Object.entries({
  'GNK Dinamo':'Dinamo Zagreb','Fenerbahçe':'Fenerbahce','N.E.C.':'NEC Nijmegen',
  'N.E.C. Nijmegen':'NEC Nijmegen','Bodø/Glimt':'Bodo/Glimt','FK Bodø/Glimt':'Bodo/Glimt'
}));
const NAME_VARIANTS=new Map([
  ['Levski Sofia',['Levski Sofia']],['AEK Athens',['AEK Athens']],['Dinamo Zagreb',['GNK Dinamo','Dinamo Zagreb']],
  ['Viking',['Viking']],['Hapoel Beer-Sheva',['Hapoel Beer-Sheva','H. Beer-Sheva']],['Sabah',['Sabah']],
  ['Celtic',['Celtic']],['LASK',['LASK']],['Slovan Bratislava',['Slovan Bratislava','S. Bratislava']],
  ['Celje',['Celje']],['Fenerbahce',['Fenerbahçe','Fenerbahce']],['Lyon',['Lyon']],
  ['NEC Nijmegen',['N.E.C.','N.E.C. Nijmegen','NEC Nijmegen']],['Bodo/Glimt',['Bodø/Glimt','Bodo/Glimt']]
]);

function canonical(value){return ALIASES.get(value.trim())||value.trim()}
function key(match){return [match.date,canonical(match.home),canonical(match.away)].join('|')}
function monitored(home,away){return PLAYOFF_TIES.find(tie=>tie.includes(home)&&tie.includes(away))}
function escapePattern(value){return value.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}
function parseOfficial(text){
  const plain=text.replace(/<[^>]*>/g,' ').replace(/\[([^\]]+)\]\([^)]*\)/g,'$1').replace(/[*_`]/g,' ')
    .replace(/&oslash;/gi,'ø').replace(/&ccedil;/gi,'ç').replace(/&nbsp;|&#160;/gi,' ').replace(/&amp;/gi,'&')
    .replace(/&#(\d+);/g,(_,code)=>String.fromCharCode(Number(code))).replace(/\s+/g,' ');
  const rows=new Map();
  for(const tie of PLAYOFF_TIES){
    for(const [home,away] of [tie,[tie[1],tie[0]]]){
      const homeNames=NAME_VARIANTS.get(home).map(escapePattern).join('|'),awayNames=NAME_VARIANTS.get(away).map(escapePattern).join('|');
      const result=plain.match(new RegExp(`(?:${homeNames})\\s+(\\d+)\\s*[-–]\\s*(\\d+)(?:\\s*aet)?\\s+(?:${awayNames})`,'i'));
      if(!result)continue;
      const dates=DATES.get(tie.join('|')),match={date:home===tie[0]?dates[0]:dates[1],round:'附加赛',home,away,homeScore:Number(result[1]),awayScore:Number(result[2]),completed:true,inProgress:false};
      rows.set(key(match),match);
    }
  }
  return [...rows.values()];
}
function json(payload,status=200){return new Response(JSON.stringify(payload),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store, max-age=0','x-content-type-options':'nosniff'}})}

export async function onRequestGet(){
  const checkedAt=new Date().toISOString();
  let official=[],error='';
  const refresh=Math.floor(Date.now()/300000);
  for(const [url,label] of [
    [RESULTS_URL,'UEFA results'],[`https://r.jina.ai/http://www.uefa.com/uefachampionsleague/news/02a6-20e5a8be4e63-ae971c582f8c-1000--champions-league-qualifying-results-how-it-worked/?refresh=${refresh}`,'UEFA results proxy'],
    [OFFICIAL_URL,'UEFA access list']
  ]){
    try{
      const response=await fetch(url,{headers:{accept:'text/html, text/plain','user-agent':'UCL-Data-Center/1.0'}});
      const length=Number(response.headers.get('content-length')||0);
      if(!response.ok)throw new Error(`${label} ${response.status}`);
      if(length>1048576)throw new Error(`${label} response too large`);
      const body=await response.text();if(body.length>1048576)throw new Error(`${label} response too large`);
      const parsed=parseOfficial(body);if(parsed.length>official.length)official=parsed;
      if(official.length>=VERIFIED.length)break;
      throw new Error(`${label} returned ${official.length}/${VERIFIED.length} playoff results`);
    }catch(cause){error=cause instanceof Error?cause.message:String(cause)}
  }
  const merged=new Map(VERIFIED.map(match=>[key(match),match]));
  official.forEach(match=>merged.set(key(match),match));
  return json({source:'UEFA 官方资格赛完整结果',sourceUrl:RESULTS_URL,teamsSourceUrl:TEAMS_URL,checkedAt,sourceUpdatedAt:'2026-08-27',resultsUpdatedAt:'2026-08-26',live:official.length>=VERIFIED.length,stale:false,qualificationComplete:true,matches:[...merged.values()],leagueTeams:LEAGUE_TEAMS,...(official.length<VERIFIED.length&&error?{warning:error}:{})});
}
