/* Explicit historical aliases. Unknown identities fail the data build. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.UclPredictionIdentity = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const groups = {
    'Union Berlin': ['1. FC Union Berlin'], 'Hoffenheim': ['1899 Hoffenheim'],
    'AC Milan': ['AC Milan'], 'AEK Athens': ['AEK Athen', 'AEK Athens'],
    'Ajax': ['AFC Ajax'], 'Monaco': ['AS Monaco', 'AS Monaco FC'],
    'AS Roma': ['AS Roma'], 'Arsenal': ['Arsenal FC'], 'Aston Villa': ['Aston Villa FC'],
    'Atalanta': ['Atalanta', 'Atalanta BC'], 'Athletic Club': ['Athletic Club'],
    'Atlético Madrid': ['Atlético Madrid', 'Club Atlético de Madrid'],
    'Young Boys': ['BSC Young Boys'], 'Bayer Leverkusen': ['Bayer Leverkusen', 'Bayer 04 Leverkusen'],
    'Bayern Munich': ['Bayern München', 'FC Bayern München'], 'Besiktas': ['Beşiktaş'],
    'Borussia Monchengladbach': ['Bor. Mönchengladbach'], 'Borussia Dortmund': ['Borussia Dortmund'],
    'CSKA Moscow': ['CSKA Moskva'], 'Celtic': ['Celtic FC'], 'Chelsea': ['Chelsea FC'],
    'Club Brugge': ['Club Brugge KV'], 'Red Star Belgrade': ['Crvena Zvezda', 'FK Crvena Zvezda'],
    'Dynamo Kyiv': ['Dinamo Kiev'], 'Dinamo Zagreb': ['Dinamo Zagreb', 'GNK Dinamo Zagreb'],
    'Eintracht Frankfurt': ['Eintracht Frankfurt'], 'Barcelona': ['FC Barcelona'],
    'Internazionale': ['FC Internazionale Milano', 'Inter'], 'Copenhagen': ['FC København'],
    'Midtjylland': ['FC Midtjylland'], 'FC Porto': ['FC Porto'],
    'Red Bull Salzburg': ['FC Red Bull Salzburg', 'RB Salzburg'], 'Schalke 04': ['FC Schalke 04'],
    'Sheriff Tiraspol': ['FC Sheriff'], 'Krasnodar': ['FK Krasnodar'],
    'Shakhtar Donetsk': ['FK Shakhtar Donetsk', 'Shakhtar Donetsk'],
    'Ferencvaros': ['Ferencvárosi TC'], 'Feyenoord': ['Feyenoord Rotterdam'],
    'Galatasaray': ['Galatasaray', 'Galatasaray SK'], 'Juventus': ['Juventus', 'Juventus FC'],
    'Genk': ['KRC Genk'], 'Lazio': ['Lazio Roma', 'SS Lazio'], 'Lille': ['Lille OSC'],
    'Liverpool': ['Liverpool FC'], 'Lokomotiv Moscow': ['Lokomotiv Moskva'],
    'Maccabi Haifa': ['Maccabi Haifa'], 'Malmo FF': ['Malmö FF'],
    'Manchester City': ['Manchester City', 'Manchester City FC'],
    'Manchester United': ['Manchester United', 'Manchester United FC'],
    'Newcastle United': ['Newcastle United FC'], 'Olympiacos': ['Olympiakos Piraeus', 'PAE Olympiakos SFP'],
    'Lyon': ['Olympique Lyonnais'], 'Marseille': ['Olympique Marseille', 'Olympique de Marseille'],
    'PSV Eindhoven': ['PSV', 'PSV Eindhoven'],
    'Paris Saint-Germain': ['Paris Saint-Germain', 'Paris Saint-Germain FC'],
    'RB Leipzig': ['RB Leipzig'], 'Lens': ['Racing Club de Lens'], 'Rangers': ['Rangers FC'],
    'Real Madrid': ['Real Madrid', 'Real Madrid CF'], 'Real Sociedad': ['Real Sociedad de Fútbol'],
    'Antwerp': ['Royal Antwerp FC'], 'Benfica': ['SL Benfica', 'Sport Lisboa e Benfica'],
    'Napoli': ['SSC Napoli'], 'Sevilla': ['Sevilla FC'], 'Slavia Prague': ['Slavia Praha', 'SK Slavia Praha'],
    'Sporting CP': ['Sporting CP', 'Sporting Clube de Portugal'], 'Braga': ['Sporting Clube de Braga'],
    'Rennes': ['Stade Rennais'], 'Tottenham Hotspur': ['Tottenham Hotspur', 'Tottenham Hotspur FC'],
    'Valencia': ['Valencia CF'], 'Wolfsburg': ['VfL Wolfsburg'], 'Viktoria Plzen': ['Viktoria Plzeň'],
    'Villarreal': ['Villarreal CF'], 'Zenit': ['Zenit St. Petersburg'], 'Istanbul Basaksehir': ['İstanbul Başakşehir'],
    'Sparta Prague': ['AC Sparta Praha'], 'Bologna': ['Bologna FC 1909'],
    'Bodo/Glimt': ['FK Bodø/Glimt'], 'Kairat Almaty': ['FK Kairat'], 'Girona': ['Girona FC'],
    'Pafos': ['Paphos FC'], 'Qarabag': ['Qarabağ Ağdam FK'],
    'Union Saint-Gilloise': ['Royale Union Saint-Gilloise'], 'Sturm Graz': ['SK Sturm Graz'],
    'Brest': ['Stade Brestois 29'], 'VfB Stuttgart': ['VfB Stuttgart'],
    'Slovan Bratislava': ['ŠK Slovan Bratislava']
  };
  const normalize = value => String(value).replace(/\s+\([A-Z]{3}\)$/, '').normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
  const aliases = new Map();
  for (const [canonical, names] of Object.entries(groups)) for (const name of [canonical, ...names]) {
    const key = normalize(name);
    if (aliases.has(key) && aliases.get(key) !== canonical) throw new Error('Historical identity collision: ' + name);
    aliases.set(key, canonical);
  }
  return {
    canonical: value => aliases.get(normalize(value)) || null,
    id: value => normalize(value).replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
  };
});
