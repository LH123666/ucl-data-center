import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),api=require('../js/services/player-registry.js');
const now='2026-10-15T10:00:00Z';
const stamp={publishedAt:'2026-10-01T10:00:00Z',observedAt:'2026-10-01T10:00:00Z',retrievedAt:'2026-10-02T10:00:00Z'};
const source=(id,kind,extra={})=>({id,title:'Unit test source '+id,url:'https://example.com/'+id,kind,...stamp,...extra});
function data(){
  const players=Array.from({length:11},(_,i)=>({id:'player-test-'+i,displayName:'Test player '+i,aliases:[],birthDate:null,externalIds:[],identityStatus:'verified',identitySourceIds:['identity']}));
  return {schemaVersion:api.VERSION,generatedAt:'2026-10-15',probabilityAdjustmentEnabled:false,scope:{season:'2026-27',clubCount:2},clubs:[{id:'a',name:'A',zh:'甲队'},{id:'b',name:'B',zh:'乙队'}],
    sources:[source('identity','identity'),source('registration','registration'),source('eligibility','eligibility'),source('lineup','lineup',{matchId:'test-match',teamId:'a'}),source('historical','historical-editorial',{observedAt:null})],players,
    memberships:players.map((p,i)=>({id:'membership-'+i,playerId:p.id,teamId:'a',season:'2026-27',status:'registered',validFrom:'2026-07-01',validUntil:null,sourceIds:['registration'],...stamp})),
    observations:[],eligibility:players.map((p,i)=>({id:'eligibility-'+i,playerId:p.id,teamId:'a',season:'2026-27',competitionId:'uefa-champions-league',status:'eligible',validFrom:'2026-07-01',validUntil:null,sourceIds:['eligibility'],...stamp})),availability:[]};
}
function lineup(patch={}){return {id:'test-lineup',matchId:'test-match',teamId:'a',season:'2026-27',competitionId:'uefa-champions-league',kickoff:'2026-10-20T19:00:00Z',status:'confirmed',partial:false,
  players:Array.from({length:11},(_,i)=>({playerId:'player-test-'+i,role:i===0?'GK':'MF',starter:true,expectedMinutes:90})),sourceReferences:[{sourceId:'lineup',...stamp}],...patch};}
const validate=(input,raw=data(),asOf=now)=>api.validateLineup(input,{registry:api.createRegistry(raw),asOf,now});

test('actual seed stores only 33 historical research identities, not registered squads',()=>{
  const raw=JSON.parse(fs.readFileSync('js/data/players/registry.json','utf8')),registry=api.createRegistry(raw);
  assert.equal(registry.clubs().length,36);assert.equal(registry.all().length,33);assert.equal(raw.observations.length,33);
  assert.equal(raw.memberships.length,0);assert.equal(raw.eligibility.length,0);assert.equal(raw.availability.length,0);
  assert.ok(registry.all().every(p=>p.birthDate===null&&p.identityStatus==='research-seed'));
  for(const club of registry.clubs())assert.deepEqual(registry.roster(club.id,{asOf:now,season:'2026-27'}),[]);
  assert.throws(()=>{registry.all().push({});},TypeError);
});
test('complete source-timed XI validates and stays isolated from probability models',()=>{
  const result=validate(lineup());assert.equal(result.valid,true);assert.equal(result.snapshot.selected.length,11);assert.equal(result.snapshot.trainingEligible,true);
  assert.equal(result.snapshot.probabilityAdjustmentEnabled,false);assert.equal(result.snapshot.modelUse,'evidence-storage-only');
  assert.throws(()=>{result.snapshot.selected[0].expectedMinutes=12;},TypeError);
});
test('duplicate names are ambiguous identities until context resolves registration',()=>{
  const raw=data();raw.players[1].displayName=raw.players[0].displayName;raw.memberships[1].teamId='b';
  const registry=api.createRegistry(raw);assert.equal(registry.resolve(raw.players[0].displayName).status,'ambiguous');
  assert.equal(registry.resolve(raw.players[0].displayName,{teamId:'b',asOf:now,season:'2026-27'}).player.id,raw.players[1].id);
  assert.equal(registry.resolve('not a real player').status,'unresolved');
});
test('future registration or source retrieval does not produce a known roster',()=>{
  const raw=data();raw.sources.find(row=>row.id==='registration').retrievedAt='2026-10-16T10:00:00Z';
  assert.deepEqual(api.createRegistry(raw).roster('a',{asOf:now,season:'2026-27'}),[]);
  const result=validate(lineup(),raw);assert.equal(result.valid,true);assert.equal(result.snapshot.trainingEligible,false);
  assert.ok(result.snapshot.selected.every(row=>row.membershipStatus==='unknown'));
});
test('transfers and conflicting memberships never silently make two current teams',()=>{
  const raw=data();raw.memberships.push({...raw.memberships[0],id:'conflicting-registration',teamId:'b'});const registry=api.createRegistry(raw);
  assert.equal(registry.membershipStatus('player-test-0','a',{asOf:now,season:'2026-27'}),'conflict');
  assert.equal(registry.roster('a',{asOf:now,season:'2026-27'}).length,10);
  raw.memberships[0].validUntil='2026-10-10';assert.equal(api.createRegistry(raw).membershipStatus('player-test-0','b',{asOf:now,season:'2026-27'}),'verified');
});
test('multiple valid registration records keep one unique player in a roster',()=>{
  const raw=data();raw.memberships.push({...raw.memberships[0],id:'same-player-second-evidence'});
  assert.equal(api.createRegistry(raw).roster('a',{asOf:now,season:'2026-27'}).length,11);
});
test('qualification and suspension remain competition-specific',()=>{
  const raw=data();raw.sources.push(source('domestic-ban','suspension'));
  raw.availability.push({id:'domestic-ban-p0',playerId:'player-test-0',teamId:'a',kind:'suspension',competitionId:'domestic-league',status:'unavailable',validFrom:'2026-10-01',validUntil:null,sourceIds:['domestic-ban'],...stamp});
  const registry=api.createRegistry(raw);assert.equal(registry.availabilityStatus('player-test-0','a',{competitionId:'uefa-champions-league',asOf:now,effectiveAt:'2026-10-20'}).length,0);
  raw.availability[0].competitionId='uefa-champions-league';assert.equal(validate(lineup(),raw).snapshot.trainingEligible,false);
});
test('unknown dates, history and partial lineups are not usable training evidence',()=>{
  const partial=validate(lineup({partial:true,players:lineup().players.slice(0,1)}));assert.equal(partial.valid,true);assert.equal(partial.snapshot.trainingEligible,false);
  const empty=validate(lineup({partial:true,status:'unknown',players:[],sourceReferences:[]}));assert.equal(empty.valid,true);assert.equal(empty.snapshot.trainingEligible,false);
  const historical=validate(lineup({sourceReferences:[{sourceId:'historical',publishedAt:stamp.publishedAt,observedAt:null,retrievedAt:stamp.retrievedAt}]}));assert.equal(historical.valid,true);assert.equal(historical.snapshot.evidenceStatus,'unverified');assert.equal(historical.snapshot.trainingEligible,false);
});
test('lineups reject missing players, duplicates, impossible minutes and illegal complete XIs',()=>{
  for(const players of [lineup().players.slice(0,10),[...lineup().players,lineup().players[0]],lineup().players.map((row,i)=>i===1?{...row,role:'GK'}:row),lineup().players.map((row,i)=>i===0?{...row,expectedMinutes:91}:row)])assert.equal(validate(lineup({players})).valid,false);
  const input=lineup();input.players[0].playerId='player-unknown';assert.equal(validate(input).valid,false);
});
test('actual minutes and other post-match fields cannot enter pre-match features',()=>{
  for(const key of ['actualMinutes','minutesPlayed','actualSubstitutionMinute','actualStarting','actualLineup','result','score','minutes']){
    const input=lineup();input.players[0][key]=32;const result=validate(input);assert.equal(result.valid,false,key);assert.ok(result.errors.some(error=>error.includes(key)));
  }
});
test('future or unrelated lineup sources are rejected, no backdated source dates',()=>{
  let raw=data();raw.sources.find(row=>row.id==='lineup').matchId='other-match';assert.equal(validate(lineup(),raw).valid,false);
  raw=data();const input=lineup();input.sourceReferences[0].publishedAt='2026-09-30T10:00:00Z';assert.equal(validate(input,raw).valid,false);
  const future=lineup();future.sourceReferences[0].retrievedAt='2026-10-16T10:00:00Z';assert.equal(validate(future).valid,false);
  assert.equal(validate(lineup(),data(),'2026-10-20T19:00:00Z').valid,false);
});
test('unsafe or duplicate registry references are rejected before use',()=>{
  let raw=data();raw.sources[0].url='javascript:alert(1)';assert.throws(()=>api.createRegistry(raw),/来源/);
  raw=data();raw.players.push(raw.players[0]);assert.throws(()=>api.createRegistry(raw),/身份/);
  raw=data();raw.eligibility[0].sourceIds=['historical'];assert.throws(()=>api.createRegistry(raw),/报名资格/);
  raw=data();raw.probabilityAdjustmentEnabled=true;assert.throws(()=>api.createRegistry(raw),/概率/);
});
