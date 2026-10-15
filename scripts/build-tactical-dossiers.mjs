import fs from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import a from './tactical-notes/clubs-a.mjs';
import b from './tactical-notes/clubs-b.mjs';
import c from './tactical-notes/clubs-c.mjs';
import { REVISION, SOURCE_POLICY, claimEvidence } from './tactical-notes/evidence-metadata.mjs';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const framework = JSON.parse(await fs.readFile(path.join(root, 'js/data/tactics/framework.json'), 'utf8'));
const rules = new Map(framework.mechanisms.map(rule => [rule.id, rule]));
function expand(note, team) {
  const sources = note.sources.map(([title, url, publishedAt], i) => ({ id: 's' + (i + 1), title, url, publishedAt, accessedAt: framework.reviewedAt }));
  return {
    name: note.name, revision: REVISION, evidencePeriod: note.period, currentSeasonVerified: note.current === true,
    sourcePolicy: structuredClone(SOURCE_POLICY),
    changeLog: [{ revision: REVISION, date: framework.reviewedAt, type: 'metadata-migration',
      summary: '沿用初版来源，仅逐条重分类、加入稳定标识和编辑复核期限；未重新核查事实，未加入新比赛观察。' }],
    coachContext: note.coach, summary: note.summary,
    traits: note.traits.map((trait, index) => {
      const [dimension, label, detail, indexes = [1]] = trait;
      const sourceIds = indexes.map(i => 's' + i);
      return { id: team.id + ':claim:' + (index + 1), dimension, label, detail, sourceIds,
        evidence: claimEvidence(note, trait, index, sources.filter(source => sourceIds.includes(source.id)), framework.reviewedAt) };
    }),
    personnel: { status: '未接入实时首发、伤停与转会核对', watchRoles: note.roles,
      observedPlayers: (note.players || []).map(([name, role, period, indexes = [1]]) => ({ name, role, period, sourceIds: indexes.map(i => 's' + i) })) },
    matchups: note.angles.map(([opponentStyle, mechanism, ruleId]) => {
      const rule = rules.get(ruleId);
      if (!rule) throw new Error(note.name + ' 未知对位规则 ' + ruleId);
      return { opponentStyle, mechanism, branches: rule.branches.map(branch => ({ ...branch })) };
    }),
    uncertainties: [note.caveat, note.current ? '本季资料仅代表来源发表时的观察，不能据此确认比赛当天打法或首发。' : '历史观察不能自动套用到2026/27；换帅、转会及不同对手可能改变打法。',
      '对位分支是条件式分析假设，尚未用比赛事件验证发生率，不改变V1预测概率。'],
    sources
  };
}
const context = vm.createContext({});
vm.runInContext(await fs.readFile(path.join(root, 'js/data/matches-data.js'), 'utf8'), context);
const roster = JSON.parse(vm.runInContext('JSON.stringify(leagueTeamCatalog)', context));
const teams = new Map(roster.map(team => [team.name, team]));
const shards = [a, b, c].map(notes => notes.map(note => {
  const team = teams.get(note.name);
  if (!team) throw new Error('未找到球队唯一身份：' + note.name);
  return expand(note, team);
}));
const require = createRequire(import.meta.url);
require('../js/services/tactical-profiles.js').createCatalog(roster, shards, framework);
for (const [i, data] of shards.entries()) {
  await fs.writeFile(path.join(root, 'js/data/tactics/clubs-' + ['a', 'b', 'c'][i] + '.json'), JSON.stringify(data, null, 2) + '\n');
}
const all = shards.flat();
console.log(JSON.stringify({ clubs: all.length, observations: all.reduce((n, row) => n + row.traits.length, 0),
  sources: new Set(all.flatMap(row => row.sources.map(source => source.url))).size,
  currentSeasonEvidence: all.filter(row => row.currentSeasonVerified).length,
  limited: all.filter(row => row.traits.length < 3).length, probabilityAdjustmentEnabled: false }, null, 2));
