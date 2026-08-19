const OFFICIAL_URL='https://www.uefa.com/uefachampionsleague/accesslist/';
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
  ['2026-08-18','Fenerbahce','Lyon',1,1]
].map(([date,home,away,homeScore,awayScore])=>({date,round:'附加赛',home,away,homeScore,awayScore,completed:true,inProgress:false}));
const ALIASES=new Map(Object.entries({
  'GNK Dinamo':'Dinamo Zagreb','Fenerbahçe':'Fenerbahce','N.E.C.':'NEC Nijmegen',
  'N.E.C. Nijmegen':'NEC Nijmegen','Bodø/Glimt':'Bodo/Glimt','FK Bodø/Glimt':'Bodo/Glimt'
}));

function canonical(value){return ALIASES.get(value.trim())||value.trim()}
function key(match){return [match.date,canonical(match.home),canonical(match.away)].join('|')}
function monitored(home,away){return PLAYOFF_TIES.find(tie=>tie.includes(home)&&tie.includes(away))}
function parseOfficial(text){
  const plain=text.replace(/\[([^\]]+)\]\([^)]*\)/g,'$1').replace(/[*_`]/g,'');
  const rows=[];
  for(const line of plain.split(/\r?\n/)){
    const result=line.trim().match(/^(.+?)\s+(\d+)\s*[-–]\s*(\d+)\s+(.+?)\s*$/);
    if(!result)continue;
    const home=canonical(result[1]),away=canonical(result[4]);
    const tie=monitored(home,away);if(!tie)continue;
    const dates=DATES.get(tie.join('|'));
    rows.push({date:home===tie[0]?dates[0]:dates[1],round:'附加赛',home,away,homeScore:Number(result[2]),awayScore:Number(result[3]),completed:true,inProgress:false});
  }
  return rows;
}
function json(payload,status=200){return new Response(JSON.stringify(payload),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store, max-age=0','x-content-type-options':'nosniff'}})}

export async function onRequestGet(){
  const checkedAt=new Date().toISOString();
  let official=[],error='';
  try{
    const bucket=Math.floor(Date.now()/300000);
    const response=await fetch(`https://r.jina.ai/http://www.uefa.com/uefachampionsleague/accesslist/?refresh=${bucket}`,{headers:{accept:'text/plain'}});
    const length=Number(response.headers.get('content-length')||0);
    if(!response.ok)throw new Error(`UEFA proxy ${response.status}`);
    if(length>524288)throw new Error('UEFA response too large');
    const body=await response.text();
    if(body.length>524288)throw new Error('UEFA response too large');
    official=parseOfficial(body);
  }catch(cause){error=cause instanceof Error?cause.message:String(cause)}
  const merged=new Map(VERIFIED.map(match=>[key(match),match]));
  official.forEach(match=>merged.set(key(match),match));
  return json({source:'UEFA 官方资格赛',sourceUrl:OFFICIAL_URL,checkedAt,live:official.length>0,stale:official.length===0,matches:[...merged.values()],...(error?{warning:error}:{})});
}
