import fs from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { parseSeason } from './collect-openfootball-history.mjs';
const require = createRequire(import.meta.url);
const identity = require('../js/services/prediction-identity.js');
const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const seasons = ['2018-19','2019-20','2020-21','2021-22','2022-23','2023-24','2024-25','2025-26'];
const expected = [125,119,125,125,125,125,189,189];
const rows = [], sources = [], aliasAudit = new Map();
for (const [index, season] of seasons.entries()) {
  const raw = await fs.readFile(path.join(root, 'research/ucl-history/raw', season + '-cl.txt'), 'utf8');
  const sourceUrl = 'https://github.com/openfootball/champions-league/blob/master/' + season + '/cl.txt';
  const parsed = parseSeason(season, sourceUrl, raw);
  if (parsed.length !== expected[index]) throw new Error(season + ' match count differs from audited total');
  const counts = { group: 0, league: 0, knockout: 0 };
  const membership = new Set(), fixtures = new Set();
  for (const row of parsed) {
    const home = identity.canonical(row.home), away = identity.canonical(row.away);
    if (!home || !away) throw new Error('Unmapped club: ' + (!home ? row.home : row.away));
    aliasAudit.set(row.home, home); aliasAudit.set(row.away, away);
    const stage = /^(?:Group|Gruppe)/.test(row.stage) ? 'group' : /^League/.test(row.stage) ? 'league' : 'knockout';
    counts[stage]++;
    membership.add(home); membership.add(away);
    const id = [season, row.date, identity.id(home), identity.id(away)].join(':');
    if (fixtures.has(id)) throw new Error('Duplicate fixture ' + id);
    fixtures.add(id);
    rows.push({ id, season, date: row.date, home, away, score: row.score90Home + '-' + row.score90Away,
      stage, sourceUrl, sourceLine: row.sourceLine, scoreStatus: row.scoreStatus,
      afterExtraTime: row.scoreAfterExtraTime, penalties: row.penaltyShootout });
  }
  const phase = index < 6 ? 'group' : 'league', expectedPhase = index < 6 ? 96 : 144;
  if (counts[phase] !== expectedPhase || membership.size !== (index < 6 ? 32 : 36)) throw new Error(season + ' phase/membership count mismatch');
  sources.push({ season, sourceUrl, sha256: createHash('sha256').update(raw).digest('hex'), total: parsed.length, counts, teams: membership.size });
}
rows.sort((a,b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
// Existing site archives are only a cross-check, never training input.
const context = vm.createContext({ window: {} });
vm.runInContext(await fs.readFile(path.join(root, 'js/data/season-archives.js'), 'utf8'), context);
const crossChecks = [];
for (const season of ['2024-25','2025-26']) {
  const old = context.window.uclSeasonArchives[season].matches.filter(row => row[5] === 'league');
  const current = rows.filter(row => row.season === season && row.stage === 'league');
  const differences = [];
  for (const row of current) {
    const match = old.find(item => item[1] === row.home && item[2] === row.away);
    if (!match || match[3] !== row.score) differences.push({ home: row.home, away: row.away, source: row.score, archive: match?.[3] ?? null });
  }
  crossChecks.push({ season, checked: current.length, archiveMatches: old.length, differences });
}
const report = {
  schemaVersion: 1, source: 'OpenFootball', license: 'CC0-1.0',
  sourceRepository: 'https://github.com/openfootball/champions-league',
  builtAt: new Date().toISOString(), sources, total: rows.length,
  trainingMatches: rows.filter(row => row.stage !== 'knockout').length,
  aliases: Object.fromEntries([...aliasAudit].sort()), crossChecks,
  limitations: ['No continuous xG, lineup, injuries or event stream.',
    'Historical source timezone is unknown: use only strictly earlier calendar dates.',
    'Regular-time group/league scores only are used for the V1 model; qualification, extra time and penalties are excluded.'],
  rows
};
await fs.writeFile(path.join(root, 'research/ucl-history/prediction-dataset.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ total: report.total, trainingMatches: report.trainingMatches, aliases: aliasAudit.size, sources, crossChecks }, null, 2));
