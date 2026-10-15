import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const analysis = require('../js/services/tactical-analysis.js');
const baseline = require('../js/services/prediction-baseline.js');
const framework = JSON.parse(await fs.readFile(new URL('../js/data/tactics/framework.json', import.meta.url), 'utf8'));
const asOf = '2026-10-15';
function profile(id, signals, patch = {}) {
  return { id, name: id, zh: id === 'a' ? '甲队' : '乙队', revision: '1.1', evidencePeriod: '2026/27', uncertainties: [],
    sources: [{ id: 's1', title: '赛后技术观察', url: 'https://example.com/' + id, publishedAt: '2026-10-11', accessedAt: '2026-10-12' }],
    traits: signals.map((signal, index) => ({ id: id + ':claim:' + (index + 1), dimension: 'buildUp', label: signal, detail: signal, sourceIds: ['s1'],
      evidence: { kind: 'observation', observedAt: '2026-10-10', period: '2026年10月10日', reviewedAt: '2026-10-12', validUntil: '2026-11-10', season: '2026-27', signals: [signal] } })), ...patch };
}
const run = (home, away, extra = {}) => analysis.analyze({ home, away, framework, asOf, ...extra });
const allMechanisms = report => report.directions.flatMap(direction => direction.mechanisms);

test('match-form descriptions name the supported sides and change with the actual mechanism', () => {
  const pressing=run(profile('a',['possession']),profile('b',['high-press']));
  const low=run(profile('a',['direct-play']),profile('b',['low-block']));
  assert.match(pressing.shape.control.text,/乙队.*前压.*甲队/);
  assert.match(low.shape.control.text,/第二落点|落点控制/);
  assert.notEqual(pressing.shape.control.text,low.shape.control.text);
  assert.match(pressing.shape.transition.text,/若/);
  assert.match(pressing.shape.goals.text,/不变/);
  assert.equal('probability' in pressing.shape.goals,false);
});

test('explicit bilateral signals trigger traceable directed mechanisms, not fixed winners', () => {
  const report = run(profile('a', ['possession']), profile('b', ['high-press']));
  assert.equal(report.version, 'tactical-analysis-1.1');
  assert.equal(report.directions.length, 2);
  assert.equal(report.directions[0].mechanisms[0].frameworkId, 'build-press');
  assert.equal(report.directions[0].mechanisms[0].status, 'candidate');
  assert.equal(report.directions[1].mechanisms.length, 0);
  const mechanism = allMechanisms(report)[0];
  assert.deepEqual(mechanism.evidence.map(row => row.teamId), ['a', 'b']);
  assert.ok(mechanism.evidence.every(row => row.traitId && row.sourceRefs[0].url.startsWith('https://')));
  assert.ok(report.scripts.main.mechanismIds.includes(mechanism.id));
  assert.deepEqual(JSON.parse(JSON.stringify(report)), report);
  assert.ok(report.directions.every(direction => direction.unknowns.length));
  assert.equal(report.probabilityAdjustmentEnabled, false);
});

test('missing metadata, dimensions, old example matchups and pots never fill missing styles', () => {
  const home = profile('a', ['possession']), away = profile('b', []);
  away.pot = 1;
  away.traits = [{ dimension: 'pressing', label: '高位', detail: '资料未标注', sourceIds: ['s1'] }];
  away.matchups = [{ opponentStyle: 'high-press', mechanism: '示例' }];
  const report = run(home, away);
  assert.equal(allMechanisms(report).length, 0);
  assert.equal(report.scripts.main.status, 'insufficient');
  assert.equal(report.coverage.away.missingMetadata, 1);
  assert.ok(report.unknowns.some(text => text.includes('元数据')));
});

test('historical, undated, expired and intended observations stay conditional', () => {
  for (const patch of [{ season: '2025-26' }, { observedAt: null }, { validUntil: '2026-10-01' }, { kind: 'intent' }, { applicability: 'needs-review' }]) {
    const home = profile('a', ['possession']), away = profile('b', ['low-block']);
    Object.assign(home.traits[0].evidence, patch);
    const report = run(home, away);
    assert.equal(allMechanisms(report)[0].status, 'conditional');
    assert.equal(report.scripts.main.status, 'conditional');
    assert.ok(allMechanisms(report)[0].evidence[0].limitations.length);
  }
});

test('future publication, future observation, future review and later retrieval cannot leak into snapshots', () => {
  const mutators = [
    home => { home.sources[0].publishedAt = '2026-10-16'; },
    home => { home.sources[0].accessedAt = '2026-10-16'; },
    home => { home.traits[0].evidence.observedAt = '2026-10-16'; },
    home => { home.traits[0].evidence.reviewedAt = '2026-10-16'; }
  ];
  for (const mutate of mutators) {
    const home = profile('a', ['possession']); mutate(home);
    const report = run(home, profile('b', ['high-press']));
    assert.equal(allMechanisms(report).length, 0);
    assert.equal(report.coverage.home.excluded, 1);
    assert.equal(report.scripts.main.status, 'insufficient');
  }
});

test('unsafe, missing or incomplete sources do not support a mechanism', () => {
  for (const url of ['javascript:alert(1)', 'http://example.com', '']) {
    const home = profile('a', ['possession']); home.sources[0].url = url;
    assert.equal(allMechanisms(run(home, profile('b', ['high-press']))).length, 0);
  }
  const home = profile('a', ['possession']); home.traits[0].sourceIds.push('missing');
  assert.equal(allMechanisms(run(home, profile('b', ['high-press']))).length, 0);
});

test('swapping the teams swaps attack and defence without turning the rule around', () => {
  const a = profile('a', ['possession']), b = profile('b', ['high-press']);
  const first = run(a, b), swapped = run(b, a);
  assert.deepEqual(first.directions[0], swapped.directions[1]);
  assert.deepEqual(first.directions[1], swapped.directions[0]);
  assert.equal(swapped.directions[1].mechanisms[0].attackTeamId, undefined);
  assert.equal(swapped.directions[1].attackTeamId, 'a');
});

test('whole report is limited to four key mechanisms and preserves both supported directions', () => {
  const signals = ['possession', 'low-block', 'high-press', 'direct-play', 'high-line', 'counter-attack', 'wide-play', 'man-marking'];
  const report = run(profile('a', signals), profile('b', signals));
  assert.equal(allMechanisms(report).length, 4);
  assert.equal(report.directions[0].mechanisms.length, 2);
  assert.equal(report.directions[1].mechanisms.length, 2);
  assert.ok(report.scripts.scoreChange.mechanismIds.every(id => allMechanisms(report).some(mechanism => mechanism.id === id)));
});

test('lineup scenarios are manual, temporal and never automatically officially verified', () => {
  const report = run(profile('a', ['possession']), profile('b', ['high-press']), { lineups: {
    home: { status: 'confirmed', formation: '4-3-3', players: ['球员甲'], roles: ['接应核心'], source: '人工核查正式名单', checkedAt: '2026-10-15' },
    away: { status: 'expected', formation: '4-4-2', players: ['未来名单'], source: '预测名单', checkedAt: '2026-10-16' }
  } });
  assert.equal(report.lineups.home.status, 'confirmed');
  assert.equal(report.lineups.home.officiallyVerified, false);
  assert.equal(report.lineups.home.probabilityAdjustmentEnabled, false);
  assert.equal(report.lineups.away.status, 'unknown');
  assert.deepEqual(report.lineups.away.players, []);
  assert.match(report.lineups.notice, /人工/);
});

test('an exact ISO cutoff rejects later same-day evidence and lineup checks', () => {
  const home = profile('a', ['possession']);
  home.sources[0].publishedAt = '2026-10-15T11:30:00Z';
  home.sources[0].accessedAt = '2026-10-15T11:30:00Z';
  const report = run(home, profile('b', ['high-press']), { asOf: '2026-10-15T10:00:00Z', lineups: {
    home: { status: 'confirmed', checkedAt: '2026-10-15T11:00:00Z', source: '稍后的正式名单', players: ['未来首发'] }
  } });
  assert.equal(report.cutoffAt, '2026-10-15T10:00:00.000Z');
  assert.equal(allMechanisms(report).length, 0);
  assert.equal(report.lineups.home.status, 'unknown');
  assert.deepEqual(report.lineups.home.players, []);
  home.sources[0].publishedAt = '2026-10-15';
  home.sources[0].accessedAt = '2026-10-15';
  const dated = run(home, profile('b', ['high-press']), { asOf: '2026-10-15T10:00:00Z' });
  assert.equal(allMechanisms(dated)[0].status, 'conditional');
  assert.ok(allMechanisms(dated)[0].evidence[0].limitations.some(text => text.includes('同日')));
});

test('analysis is pure and leaves existing numerical forecasts bit-for-bit unchanged', () => {
  const home = profile('a', ['possession']), away = profile('b', ['high-press']);
  const beforeInputs = JSON.stringify([home, away, framework]);
  const model = baseline.buildModel([{ season: '2025-26', date: '2025-10-01', home: 'Arsenal', away: 'Liverpool', score: '2-1', stage: 'league' }], asOf);
  const before = JSON.stringify(baseline.forecast(model, 'Arsenal', 'Liverpool', { includeHalfFull: false }));
  const report = run(home, away);
  assert.equal(JSON.stringify([home, away, framework]), beforeInputs);
  assert.equal(JSON.stringify(baseline.forecast(model, 'Arsenal', 'Liverpool', { includeHalfFull: false })), before);
  const forbidden = ['probability', 'winner', 'adjustment', 'confidenceScore', 'expectedGoals'];
  function visit(value) {
    if (!value || typeof value !== 'object') return;
    for (const [key, child] of Object.entries(value)) { assert.ok(!forbidden.includes(key)); visit(child); }
  }
  visit(report);
  for (const axis of Object.values(report.shape)) assert.ok(axis.label && axis.status && axis.text);
});

test('missing profiles, missing framework rules and invalid dates yield explicit unknowns', () => {
  const report = analysis.analyze({ asOf, home: null, away: profile('b', ['high-press']), framework: {} });
  assert.equal(allMechanisms(report).length, 0);
  assert.ok(report.unknowns.some(text => text.includes('档案缺失')));
  assert.equal(run(profile('a', ['possession']), profile('b', ['high-press']), { framework: {} }).scripts.main.status, 'insufficient');
  assert.equal(run(profile('a', []), profile('b', []), { asOf: '2026-02-30' }).asOf, framework.reviewedAt);
  assert.throws(() => run(profile('a', []), profile('a', [])), /不同球队/);
});
