import fs from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const require = createRequire(import.meta.url);
const api = require('../js/services/player-registry.js');
const defaultFile = path.join(root, 'js/data/players/registry.json');
const hash = text => createHash('sha256').update(text).digest('hex').slice(0, 16);
const normalized = value => value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
const readJson = async file => JSON.parse(await fs.readFile(file, 'utf8'));
const args = process.argv.slice(2);
const command = args.shift() || 'help';
function option(name) { const i = args.indexOf(name); return i < 0 ? null : args[i + 1] || null; }
function workspaceTarget(value) {
  const target = path.resolve(root, value || defaultFile), relative = path.relative(root, target);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative) || /^(?:\.git|\.agents|\.codex)(?:[\\/]|$)/.test(relative)) throw new Error('写入目标必须为本项目中的明确文件，不能覆盖根目录或系统元数据');
  return target;
}
async function atomicWrite(target, data, backup = false) {
  api.createRegistry(data);
  await fs.mkdir(path.dirname(target), { recursive: true });
  let prior = null;
  try { prior = await fs.readFile(target); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  if (backup && prior) {
    const backupDir = path.join(root, 'research/ucl-history/player-registry-backups');
    await fs.mkdir(backupDir, { recursive: true });
    const backupPath = path.join(backupDir, new Date().toISOString().replace(/[:.]/g, '-') + '-' + hash(prior) + '.json');
    await fs.writeFile(backupPath, prior, { flag: 'wx' });
    console.log('原数据已备份：' + path.relative(root, backupPath));
  }
  const temp = target + '.tmp-' + process.pid;
  try { await fs.writeFile(temp, JSON.stringify(data, null, 2) + '\n', { flag: 'wx' }); await fs.rename(temp, target); }
  catch (error) { try { await fs.unlink(temp); } catch {} throw error; }
}
async function buildSeeds() {
  const context = vm.createContext({});
  vm.runInContext(await fs.readFile(path.join(root, 'js/data/matches-data.js'), 'utf8'), context);
  const clubs = JSON.parse(vm.runInContext('JSON.stringify(leagueTeamCatalog)', context)).map(({ id, name, zh, logo, pot }) => ({ id, name, zh, logo, pot }));
  const byName = new Map(clubs.map(club => [club.name, club]));
  const framework = await readJson(path.join(root, 'js/data/tactics/framework.json'));
  const profiles = (await Promise.all(['a', 'b', 'c'].map(group => readJson(path.join(root, 'js/data/tactics/clubs-' + group + '.json'))))).flat();
  const data = { schemaVersion: api.VERSION, generatedAt: framework.reviewedAt, probabilityAdjustmentEnabled: false,
    scope: { season: '2026-27', clubCount: clubs.length, seedPolicy: 'historical-observations-only',
      caveat: '人员仅来自既有战术档案历史观察；不是现役名册、报名名单、首发、伤停或训练样本。未知日期不回填；同名跨队不自动合并。' },
    clubs, sources: [], players: [], memberships: [], observations: [], eligibility: [], availability: [] };
  for (const profile of profiles) {
    const club = byName.get(profile.name);
    if (!club) throw new Error('找不到球队唯一身份：' + profile.name);
    const usedSources = new Set();
    for (const [index, observed] of (profile.personnel?.observedPlayers || []).entries()) {
      const seedKey = club.id + ':' + normalized(observed.name);
      const playerId = 'player-research-' + hash(seedKey);
      if (data.players.some(player => player.id === playerId)) throw new Error('同队人员观察重复，需人工核查：' + observed.name);
      data.players.push({ id: playerId, displayName: observed.name, aliases: [], birthDate: null, externalIds: [], identityStatus: 'research-seed', seedKey });
      const sourceIds = observed.sourceIds.map(id => { usedSources.add(id); return 'tactics:' + club.id + ':' + id; });
      data.observations.push({ id: 'historical:' + club.id + ':' + (index + 1), playerId, teamId: club.id,
        period: observed.period, role: observed.role, observedAt: null, sourceIds, observationType: 'historical-personnel-reference' });
    }
    for (const source of profile.sources.filter(source => usedSources.has(source.id))) data.sources.push({ id: 'tactics:' + club.id + ':' + source.id,
      title: source.title, url: source.url, publishedAt: source.publishedAt, observedAt: null, retrievedAt: source.accessedAt,
      kind: 'historical-editorial', provenance: 'existing-tactical-dossiers', retrievalMeaning: '沿用既有档案访问日期；本次构建未重新核查网页或球员事实。' });
  }
  const target = workspaceTarget(option('--output'));
  try {
    const prior = await readJson(target); api.createRegistry(prior);
    // Never erase manually imported registrations, identities, eligibility or injury records.
    if (prior.memberships.length || prior.eligibility.length || prior.availability.length || prior.sources.some(source => source.kind !== 'historical-editorial') || prior.players.some(player => player.identityStatus !== 'research-seed')) throw new Error('目标已含人工核查数据，build-seeds拒绝覆盖；请用--output生成候选文件并人工合并');
    for (const player of data.players) { const same = prior.players.find(row => row.seedKey === player.seedKey); if (same && same.id !== player.id) throw new Error('已有稳定球员ID不一致，需要人工合并而非重新编号'); }
  } catch (error) { if (error.code !== 'ENOENT') throw error; }
  await atomicWrite(target, data);
  return api.createRegistry(data);
}
function summary(registry) {
  return { clubs: registry.clubs().length, researchIdentities: registry.all().length, sources: registry.data.sources.length,
    clubsWithHistoricalPersonnel: registry.coverage().filter(row => row.historicalPlayers > 0).length,
    datedRegistrations: registry.data.memberships.length, competitionEligibility: registry.data.eligibility.length, injurySuspensionRecords: registry.data.availability.length,
    probabilityAdjustmentEnabled: false };
}
try {
  if (command === 'build-seeds') console.log(JSON.stringify(summary(await buildSeeds()), null, 2));
  else if (command === 'validate') console.log(JSON.stringify({ valid: true, ...summary(api.createRegistry(await readJson(path.resolve(args[0] || defaultFile)))) }, null, 2));
  else if (command === 'read' || command === 'list') {
    const registry = api.createRegistry(await readJson(path.resolve(option('--registry') || defaultFile)));
    const teamId = option('--team');
    console.log(JSON.stringify(teamId ? { club: registry.clubs().find(club => club.id === teamId) || null,
      historicalObservations: registry.historicalObservations(teamId), registeredRoster: registry.roster(teamId, { asOf: option('--as-of'), season: option('--season') }),
      warning: '历史观察不等于当前注册；未提供asOf与season时不返回注册名册。' } : command === 'read' ? registry.data : { ...summary(registry), coverage: registry.coverage() }, null, 2));
  } else if (command === 'validate-lineup') {
    if (!args[0]) throw new Error('需要阵容JSON文件');
    const registry = api.createRegistry(await readJson(path.resolve(option('--registry') || defaultFile)));
    const result = api.validateLineup(await readJson(path.resolve(args[0])), { registry, asOf: option('--as-of') || undefined });
    console.log(JSON.stringify(result, null, 2)); if (!result.valid) process.exitCode = 1;
  } else if (command === 'import') {
    if (!args[0] || !args.includes('--confirm-replace')) throw new Error('用法：node scripts/player-registry.mjs import <已核查JSON> --confirm-replace [--output <项目内文件>]；先完整校验再原子替换并备份。');
    const candidate = await readJson(path.resolve(args[0]));
    const registry = api.createRegistry(candidate);
    const target = workspaceTarget(option('--output'));
    const canonical = api.createRegistry(await readJson(defaultFile));
    if (registry.clubs().length !== canonical.clubs().length || canonical.clubs().some(club => !registry.clubs().some(row => row.id === club.id && row.name === club.name && row.zh === club.zh))) throw new Error('导入不得丢失或更改当前36队唯一身份');
    let prior = null; try { prior = api.createRegistry(await readJson(target)); } catch (error) { if (error.code !== 'ENOENT') throw error; }
    if (prior && prior.all().some(player => !registry.get(player.id))) throw new Error('导入不能静默删除已有球员稳定ID；须保留历史身份并显式处理人工合并。');
    await atomicWrite(target, candidate, true); console.log(JSON.stringify({ imported: true, target: path.relative(root, target), ...summary(registry) }, null, 2));
  } else console.log('命令：build-seeds [--output 文件] | list [--team 球队ID --as-of 时间 --season 赛季] | read | validate <JSON> | validate-lineup <JSON> [--as-of 时间] | import <JSON> --confirm-replace。所有记录仅存证据，不调整预测概率。');
} catch (error) { console.error(error.message); process.exitCode = 1; }
