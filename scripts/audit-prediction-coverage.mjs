import fs from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const require = createRequire(import.meta.url);
const identity = require('../js/services/prediction-identity.js');
const AUDIT_DATE = '2026-10-15';
const ratio = (present, denominator) => denominator ? present / denominator : null;
const completeXI = row => ['home', 'away'].every(side => Array.isArray(row.lineups?.[side]?.starters) && row.lineups[side].starters.length === 11);
const coverage = (present, denominator, status) => ({ present, denominator, ratio: ratio(present, denominator), status: status || (present ? 'present' : denominator ? 'missing' : 'not-held') });

// This audit never downloads data or exports individual match/player records.
export function calculateCoverage({ dataset, roster, events = null, lineups = null, profiles = [], registry = null, auditedAt = AUDIT_DATE }) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(auditedAt)) throw new Error('Invalid audit date');
  if (!Array.isArray(dataset?.rows) || !Array.isArray(roster) || !roster.length) throw new Error('Required local inputs are missing');
  const rows = dataset.rows;
  const training = rows.filter(row => ['group', 'league'].includes(row.stage));
  const allClubs = new Set(rows.flatMap(row => [row.home, row.away]));
  const trainingClubs = new Set(training.flatMap(row => [row.home, row.away]));
  const sampleHeld = Array.isArray(events) && events.length > 0 && Array.isArray(lineups) && lineups.length === 2;
  const sampleMatches = sampleHeld ? 1 : 0;
  const sampleNames = sampleHeld ? lineups.map(row => identity.canonical(row.team_name) || row.team_name) : [];
  // Local SOURCE-AUDIT.md identifies 22912 as the 2018/19 final. Events alone do not contain fixture dates.
  const matchedRows = sampleHeld ? rows.filter(row => row.season === '2018-19' && sampleNames.includes(row.home) && sampleNames.includes(row.away)) : [];
  if (sampleHeld && matchedRows.length !== 1) throw new Error('StatsBomb sample does not uniquely match its audited final');
  const sampleTrainingMatches = matchedRows.filter(row => ['group', 'league'].includes(row.stage)).length;
  const starters = sampleHeld ? events.filter(row => row.type?.name === 'Starting XI') : [];
  const starterCount = starters.reduce((n, row) => n + (row.tactics?.lineup?.length || 0), 0);
  const completeSampleXI = sampleHeld && starters.length === 2 && starters.every(row => row.tactics?.lineup?.length === 11);
  const substitutions = sampleHeld ? events.filter(row => row.type?.name === 'Substitution') : [];
  const listedPlayers = sampleHeld ? lineups.reduce((n, team) => n + team.lineup.length, 0) : 0;
  const positionPlayers = sampleHeld ? lineups.flatMap(team => team.lineup).filter(player => player.positions?.length).length : 0;
  const shots = sampleHeld ? events.filter(row => row.type?.name === 'Shot') : [];
  const xgShots = shots.filter(row => Number.isFinite(row.shot?.statsbomb_xg));
  const observedPlayers = profiles.flatMap(profile => (profile.personnel?.observedPlayers || []).map(player => ({ club: profile.name, ...player })));
  const registryPlayers = Array.isArray(registry?.players) ? registry.players : [];
  const registryReady = Array.isArray(registry?.players);
  const registryObservations = Array.isArray(registry?.observations) ? registry.observations : registryPlayers.flatMap(player => player.historicalObservations || []);
  const knownSeasons = [...new Set(rows.map(row => row.season))].sort();
  const field = (id, label, predicate, samplePresent, note, sampleStatus) => ({
    id, label, training: coverage(training.filter(predicate).length, training.length),
    sample: coverage(samplePresent ? sampleMatches : 0, sampleMatches, sampleStatus), note
  });
  const fields = [
    field('score90', '90分钟比分', row => /^\d+-\d+$/.test(row.score), sampleHeld && matchedRows.every(row => /^\d+-\d+$/.test(row.score)), '训练分母为小组/联赛阶段比赛，不含淘汰赛样本。'),
    field('calendarDate', '比赛日历日期', row => /^\d{4}-\d{2}-\d{2}$/.test(row.date), sampleHeld, '样本比赛日期来自本地比分档案与既有样本身份核查，不来自事件内时钟。'),
    field('kickoffUtc', '可信开球时间与时区', row => typeof row.kickoffUtc === 'string' && /(?:Z|[+-]\d{2}:\d{2})$/.test(row.kickoffUtc), false, '不能把比赛分钟、文件修改时间或日历日期当成UTC开球时间。'),
    field('startingXI', '双方完整首发', completeXI, completeSampleXI, '单场决赛的22名首发真实存在，但不属于864场训练比赛；历史球员观察不等于首发。'),
    field('bench', '双方比赛替补名单', row => completeXI(row) && ['home', 'away'].every(side => row.lineups?.[side]?.benchComplete === true && Array.isArray(row.lineups[side].bench)), completeSampleXI && listedPlayers > starterCount, '样本有双方各23人比赛名单；名单中非首发人数不代表全部实际出场。'),
    field('substitutions', '换人事件', row => row.substitutionsComplete === true && Array.isArray(row.substitutions), substitutions.length > 0, '样本中确有6次换人；不能将未知换人填为零次。'),
    field('historicalMinutes', '已规范化逐人出场分钟', row => row.appearancesComplete === true && Array.isArray(row.appearances) && row.appearances.length > 0 && row.appearances.every(item => Number.isFinite(item.minutes)), false, '样本位置时段与换人事件可用于重建分钟，尚未完成统一分钟与补时口径；不得直接声称已有分钟训练集。', sampleHeld && positionPlayers ? 'reconstructable-not-normalized' : undefined),
    field('events', '完整事件流', row => row.eventsComplete === true && Array.isArray(row.events) && row.events.length > 0, sampleHeld, '样本事件为赛后记录，不能当作同场赛前特征。'),
    field('shotXg', '射门级xG', row => row.shotsComplete === true && Array.isArray(row.shots) && row.shots.every(shot => Number.isFinite(shot.xg)), sampleHeld && shots.length > 0 && shots.length === xgShots.length, '仅30次射门的单场样本；不同供应商口径不可直接拼接。'),
    field('injuries', '带时间戳的伤停状态', row => row.injuriesComplete === true && Array.isArray(row.injuries) && row.injuries.every(item => typeof item.knownAt === 'string'), false, '未见可按预测时点还原的伤停资料；空白并非全员健康。'),
    field('suspensions', '带时间戳的停赛状态', row => row.suspensionsComplete === true && Array.isArray(row.suspensions) && row.suspensions.every(item => typeof item.knownAt === 'string'), false, '比赛黄红牌记录不自动等于下一场停赛或报名资格。'),
    field('preMatchPublishedAt', '可证实的赛前信息发布时间', row => typeof row.sourcePublishedAt === 'string' && typeof row.kickoffUtc === 'string' && Date.parse(row.sourcePublishedAt) < Date.parse(row.kickoffUtc), false, '模型构建日、文章复核日、抓取日、文件修改时间都不能代替历史赛前可用时间。'),
    field('sourceLineage', '比分来源追溯', row => /^https:\/\//.test(row.sourceUrl || '') && Number.isInteger(row.sourceLine), sampleHeld, '比分逐行来源与哈希可追溯；这并不证明历史信息最早发布时间。')
  ];
  const clubRows = roster.map(club => ({
    clubId: club.id, name: club.name, zh: club.zh,
    historicalScoreMatches: rows.filter(row => row.home === club.name || row.away === club.name).length,
    eligibleTrainingScoreMatches: training.filter(row => row.home === club.name || row.away === club.name).length,
    eligibleTrainingLineups: training.filter(row => (row.home === club.name || row.away === club.name) && completeXI(row)).length,
    localEventSampleMatches: sampleNames.includes(club.name) ? sampleMatches : 0,
    historicalPlayerObservations: observedPlayers.filter(player => player.club === club.name).length,
    verifiedCurrentRoster: false
  }));
  return {
    version: 'prediction-coverage-1.0', auditedAt,
    scope: { season: '2026-27', currentClubs: roster.length, historicalSeasons: knownSeasons,
      trainingStages: ['group', 'league'], probabilityFeatureScope: 'existing-local-score-training-only',
      auditedAtMeaning: '本地文件与来源元信息审计日期；不是数据发布日、球员状态核查日或历史赛前可用时间。',
      rawDataPublished: false, siteRosterRevalidated: false },
    localDatasets: {
      scores: { status: 'held', source: 'OpenFootball', license: dataset.license, matches: rows.length,
        eligibleTrainingMatches: training.length, excludedKnockoutMatches: rows.length - training.length,
        clubs: allClubs.size, eligibleTrainingClubs: trainingClubs.size,
        seasons: knownSeasons.map(season => ({ season, matches: rows.filter(row => row.season === season).length,
          eligibleTrainingMatches: training.filter(row => row.season === season).length })),
        historicalPublishedAt: null, domesticMatches: 0,
        note: '1122场完整正赛比分与864场训练口径分开统计；未持有国内联赛训练输入。' },
      statsbombSample: { status: sampleHeld ? 'held-local-only' : 'not-held', source: 'StatsBomb Open Data',
        license: 'provider-specific-terms-not-CC0', matches: sampleMatches, matchId: sampleHeld ? 22912 : null,
        stage: matchedRows[0]?.stage || null, matchedScoreRows: matchedRows.length, eligibleTrainingMatches: sampleTrainingMatches,
        teams: sampleNames.length, listedPlayers, starters: starterCount,
        listedNonStarters: listedPlayers - starterCount, substitutions: substitutions.length,
        playersWithPositionIntervals: positionPlayers, normalizedPlayerMinutes: 0,
        events: sampleHeld ? events.length : 0, shots: shots.length, shotsWithXg: xgShots.length,
        preMatchPublishedAt: null,
        note: '仅2018/19决赛样本；位置时段可重建分钟但未规范化，样本不参与现有训练或本次球员注册种子。' },
      tacticalDossiers: { status: 'held', clubs: profiles.length,
        observations: profiles.reduce((n, profile) => n + (profile.traits?.length || 0), 0),
        namedPlayerObservations: observedPlayers.length,
        clubsWithNamedPlayers: new Set(observedPlayers.map(player => player.club)).size,
        note: '编辑观察与角色描述，不是完整名单、球员统计、当前注册或赛前伤停。' },
      playerRegistry: { status: registryReady ? 'historical-seed-only' : 'not-ready',
        players: registryReady ? registryPlayers.length : null,
        historicalObservations: registryReady ? registryObservations.length : null,
        verifiedCurrentRosters: 0, trainingLineupMatches: 0,
        note: '历史人名种子与球队关联不证明当前转会、报名、可出场或首发；未就绪时计数为null而不是零条有效样本。' }
    },
    fields,
    clubCoverage: { denominator: roster.length, denominatorMeaning: '网站现有2026/27球队目录；未重新认证官方参赛名单',
      clubsWithScoreHistory: clubRows.filter(row => row.eligibleTrainingScoreMatches > 0).length,
      clubsWithTrainingLineups: clubRows.filter(row => row.eligibleTrainingLineups > 0).length,
      clubsWithVerifiedCurrentRoster: 0, rows: clubRows },
    sources: [
      { id: 'openfootball', name: 'OpenFootball Champions League', url: 'https://github.com/openfootball/champions-league',
        termsUrl: 'https://github.com/openfootball/champions-league/blob/master/LICENSE.md',
        status: 'held-local-and-score-aggregates', checkedAt: auditedAt, publishedAt: null,
        license: 'CC0-1.0', note: '上游标注公共领域CC0；本地八季输入不含连续阵容/事件/xG。许可不保证准确性或历史发布时间。' },
      { id: 'statsbomb', name: 'StatsBomb Open Data', url: 'https://github.com/hudl/open-data',
        termsUrl: 'https://github.com/hudl/open-data/blob/master/LICENSE.pdf',
        status: 'single-local-sample-plus-candidate-expansion', checkedAt: auditedAt, publishedAt: null,
        license: 'provider-specific-terms-not-CC0',
        note: '官方仅开放部分赛事，提供JSON比赛、阵容、事件和部分360数据。公开研究或分析须按其条款署名及使用标识；本次只核对元信息，不批量采集或发布样本派生分析。' }
    ],
    gates: { lineupProbabilityEnabled: false, opponentBaselinePromotion: false,
      reasons: ['864场训练输入没有可用的首发与分钟特征；单场淘汰赛样本不能代替训练覆盖。',
        '缺少赛前可用时间、完整当前报名与伤停数据，不能排除信息泄漏。',
        '新对手强度模型尚无新的未来独立验证；历史开发回测不自动开启正式替换。'] },
    nextActions: [
      '优先确认覆盖目标比赛的许可、完整首发/替补/换人/分钟口径以及赛前可用时间。',
      '对当前36队分别追踪名单覆盖；无资料球队保留未知，不以球星个案代替全队。',
      '用角色、替代差距和历史常态阵容做保守的影子实验，暂不影响正式概率。',
      '建立新的真实赛前快照与未来独立检验，达标后再决定是否启用数值阵容修正。'
    ],
    limitations: ['未下载新赛事批次、未购买或订阅数据、未运行受限爬虫。',
      '字段覆盖的零表示未持有合格记录，不表示球员零分钟、零伤停或球队零能力。',
      '仅导出计数、来源元信息和缺口；原始比分、事件、球员表现不进入本摘要。',
      '已查看的2024/25、2025/26回测是开发对照，不能继续调参后冒充未触碰独立验证。']
  };
}

async function optionalJson(relative) {
  try { return JSON.parse(await fs.readFile(path.join(root, relative), 'utf8')); }
  catch (error) { if (error.code === 'ENOENT') return null; throw error; }
}

export async function auditLocalCoverage() {
  const dataset = await optionalJson('research/ucl-history/prediction-dataset.json');
  if (!dataset) throw new Error('Local CC0 history is required; this audit never downloads missing files.');
  // Assert the existing audited files match their recorded hashes before counting them.
  for (const source of dataset.sources) {
    const raw = await fs.readFile(path.join(root, 'research/ucl-history/raw', source.season + '-cl.txt'));
    if (createHash('sha256').update(raw).digest('hex') !== source.sha256) throw new Error('Source hash mismatch: ' + source.season);
    if (dataset.rows.filter(row => row.season === source.season).length !== source.total) throw new Error('Season count mismatch: ' + source.season);
  }
  const context = vm.createContext({});
  vm.runInContext(await fs.readFile(path.join(root, 'js/data/matches-data.js'), 'utf8'), context);
  const roster = JSON.parse(vm.runInContext('JSON.stringify(leagueTeamCatalog)', context));
  const [events, lineups, registry, ...shards] = await Promise.all([
    optionalJson('research/ucl-history/raw/statsbomb-22912-events.json'),
    optionalJson('research/ucl-history/raw/statsbomb-22912-lineups.json'),
    optionalJson('js/data/players/registry.json'),
    ...['a', 'b', 'c'].map(shard => optionalJson('js/data/tactics/clubs-' + shard + '.json'))
  ]);
  return calculateCoverage({ dataset, roster, events, lineups, registry, profiles: shards.flatMap(shard => shard || []) });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const report = await auditLocalCoverage();
  await fs.mkdir(path.join(root, 'js/data/prediction'), { recursive: true });
  await fs.writeFile(path.join(root, 'js/data/prediction/coverage-audit.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ auditedAt: report.auditedAt, scores: report.localDatasets.scores.matches,
    training: report.localDatasets.scores.eligibleTrainingMatches, localSample: report.localDatasets.statsbombSample,
    registry: report.localDatasets.playerRegistry, gates: report.gates }, null, 2));
}
