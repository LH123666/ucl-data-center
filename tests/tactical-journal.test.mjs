import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { createJournal, JournalError, VERSION, STORAGE_KEY, MAX_SNAPSHOTS } = require('../js/services/tactical-journal.js');

function memory(initial = {}) {
  const values = new Map(Object.entries(initial));
  return { getItem: key => values.has(key) ? values.get(key) : null, setItem: (key, value) => values.set(key, value), values };
}
function input(overrides = {}) {
  return {
    fixture: { id: 'ucl-2026-27-1', season: '2026-27', homeId: 'arsenal', awayId: 'barcelona', home: 'Arsenal', away: 'Barcelona',
      kickoff: '2026-10-20T19:00:00Z', status: 'scheduled', timeSource: '官方赛程' },
    report: { version: 'tactical-matchup-1.1', mechanisms: [{ id: 'press-build', detail: '双向压迫与出球，保留替代剧本' }], evidence: [{ source: 'https://example.com/match', observedAt: '2026-10-01' }] },
    profiles: [{ id: 'arsenal', revision: 'a-2', traits: [{ detail: '观察而非胜负保证' }] }, { id: 'barcelona', reviewedAt: '2026-10-15', sources: [{ url: 'https://example.com/barca' }] }],
    lineups: { home: { status: 'expected', source: '俱乐部赛前说明', checkedAt: '2026-10-15T08:00:00Z', roles: ['组织核心'], players: ['甲'] }, away: { status: 'unknown' } },
    baseline: { modelVersion: 'score-poisson-1.0', prediction: { home: 0.4, draw: 0.3, away: 0.3 } },
    selectedHypotheses: ['press-build'], notes: '主剧本与替代剧本分别核查', ...overrides
  };
}
function setup(date = '2026-10-15T12:00:00Z') {
  const storage = memory({ 'ucl-personal-predictions': 'old-user-data' });
  let current = date;
  return { storage, journal: createJournal({ storage, now: () => current }), setNow: date => { current = date; } };
}
function review(overrides = {}) {
  return { verdicts: [{ mechanismId: 'press-build', verdict: 'supported', evidence: '前二十分钟两次形成压迫回收；人工观察，未提供事件数据。' }],
    form: { verdict: 'unknown', evidence: '' }, actual: { completed: true, homeGoals: 2, awayGoals: 1, sourceType: 'manual', source: '用户手动核查比赛记录' },
    errorCause: '阵容核查不完整', notes: '', ...overrides };
}
const fails = (fn, code) => assert.throws(fn, error => error instanceof JournalError && error.code === code);

test('snapshot is an independent deeply frozen pre-match evidence copy and preserves the raw baseline', () => {
  const { journal, storage } = setup(), source = input(), before = structuredClone(source.baseline);
  const row = journal.saveSnapshot(source);
  assert.equal(row.actualType, 'pre-match'); assert.equal(row.createdAt, '2026-10-15T12:00:00.000Z');
  assert.equal(row.cutoff, row.createdAt); assert.equal(row.kickoff, '2026-10-20T19:00:00.000Z');
  assert.equal(row.modelVersion, 'score-poisson-1.0'); assert.deepEqual(row.baseline, before);
  assert.equal(row.profileRevisions[0].revision, 'a-2'); assert.equal(row.profileRevisions[1].revision, 'legacy-2026-10-15');
  source.report.mechanisms[0].detail = '后来修改'; source.baseline.prediction.home = 0.99;
  assert.equal(row.report.mechanisms[0].detail, '双向压迫与出球，保留替代剧本'); assert.deepEqual(journal.get(row.id).baseline, before);
  assert.throws(() => { row.profiles[0].traits[0].detail = '变更'; }, TypeError);
  assert.ok(Object.isFrozen(journal.list()) && Object.isFrozen(journal.get(row.id).lineups.home));
  assert.equal(storage.values.get('ucl-personal-predictions'), 'old-user-data'); assert.equal(journal.list().length, 1);
});

test('late saves and completed fixtures cannot be relabelled as historic pre-match by a past cutoff or supplied creation date', () => {
  const { journal } = setup('2026-10-21T09:00:00Z');
  const row = journal.saveSnapshot(input({ cutoff: '2026-10-01T00:00:00Z', createdAt: '2026-10-01T00:00:00Z' }));
  assert.equal(row.actualType, 'research-retrospective'); assert.equal(row.createdAt, '2026-10-21T09:00:00.000Z');
  const sameTime = setup('2026-10-20T19:00:00Z').journal.saveSnapshot(input());
  assert.equal(sameTime.actualType, 'research-retrospective');
  const fixture = { ...input().fixture, status: 'completed' };
  assert.equal(setup().journal.saveSnapshot(input({ fixture })).actualType, 'research-retrospective');
});

test('null baseline is a valid research snapshot and missing lineups remain explicitly unknown', () => {
  const { journal } = setup(), row = journal.saveSnapshot(input({ baseline: null, lineups: null }));
  assert.equal(row.baselineAvailable, false); assert.equal(row.baseline, null); assert.equal(row.modelVersion, null);
  assert.equal(row.lineups.home.status, 'unknown'); assert.equal(row.lineups.home.checkedAt, null);
});

test('fixture season, teams, explicit kickoff timezone, cutoff, and lineup evidence are validated before any write', () => {
  const { journal, storage } = setup();
  for (const fixture of [
    { ...input().fixture, season: '2026-28' }, { ...input().fixture, homeId: 'Barcelona' },
    { ...input().fixture, homeId: 'barcelona' }, { ...input().fixture, kickoff: '2026-10-20 19:00' },
    { ...input().fixture, kickoff: '2026-02-30T19:00:00Z' }, { ...input().fixture, id: '<script>' }
  ]) fails(() => journal.saveSnapshot(input({ fixture })), 'VALIDATION');
  fails(() => journal.saveSnapshot(input({ profiles: [{ id: 'arsenal' }, { id: 'liverpool' }] })), 'VALIDATION');
  fails(() => journal.saveSnapshot(input({ cutoff: '2026-10-16T00:00:00Z' })), 'VALIDATION');
  fails(() => journal.saveSnapshot(input({ lineups: { home: { status: 'confirmed', players: [], checkedAt: '2026-10-15T08:00:00Z' } } })), 'VALIDATION');
  fails(() => journal.saveSnapshot(input({ lineups: { home: { status: 'expected', source: '报纸', checkedAt: '2026-10-16T00:00:00Z' } } })), 'VALIDATION');
  fails(() => journal.saveSnapshot(input({ report: { value: NaN } })), 'VALIDATION');
  assert.equal(storage.values.has(STORAGE_KEY), false);
});

test('post-match reviews require both a delay and explicit finished result, never infer mechanisms from scores', () => {
  const { journal, setNow } = setup(), row = journal.saveSnapshot(input());
  fails(() => journal.saveReview(row.id, review()), 'NOT_COMPLETED');
  setNow('2026-10-20T20:59:59Z'); fails(() => journal.saveReview(row.id, review()), 'NOT_COMPLETED');
  setNow('2026-10-20T21:01:00Z');
  fails(() => journal.saveReview(row.id, review({ actual: { ...review().actual, completed: false } })), 'NOT_COMPLETED');
  fails(() => journal.saveReview(row.id, review({ verdicts: [{ mechanismId: 'press-build', verdict: 'supported', evidence: '' }] })), 'VALIDATION');
  fails(() => journal.saveReview(row.id, review({ form: { verdict: 'contradicted', evidence: '' } })), 'VALIDATION');
  const updated = journal.saveReview(row.id, review({ verdicts: [{ mechanismId: 'press-build', verdict: 'unknown', evidence: '' }] }));
  assert.equal(updated.reviews[0].verdicts[0].verdict, 'unknown'); assert.equal(updated.reviews[0].form.verdict, 'unknown');
  assert.equal(updated.reviews[0].actual.sourceType, 'manual'); assert.deepEqual(updated.report, row.report);
  assert.equal(updated.createdAt, row.createdAt); assert.deepEqual(updated.baseline, row.baseline);
});

test('review revisions append and preserve prior reasoning, with explicit source type and valid scores', () => {
  const { journal, setNow } = setup(), row = journal.saveSnapshot(input()); setNow('2026-10-21T09:00:00Z');
  const first = journal.saveReview(row.id, review());
  setNow('2026-10-22T09:00:00Z');
  const second = journal.saveReview(row.id, review({ verdicts: [{ mechanismId: 'press-build', verdict: 'contradicted', evidence: '补充观看完整录像，修正之前观察。' }] }));
  assert.equal(second.reviews.length, 2); assert.deepEqual(second.reviews[0], first.reviews[0]);
  assert.equal(second.reviews[1].revision, 2); assert.ok(Object.isFrozen(second.reviews[0]));
  for (const actual of [ { ...review().actual, homeGoals: -1 }, { ...review().actual, homeGoals: 1.5 },
    { ...review().actual, sourceType: 'official' }, { ...review().actual, source: '' } ]) {
    fails(() => journal.saveReview(row.id, review({ actual })), 'VALIDATION');
  }
  assert.equal(journal.get(row.id).reviews.length, 2);
});

test('export/import marks all imported pre-match claims unverified, preserves copies and does not overwrite another snapshot', () => {
  const first = setup(), row = first.journal.saveSnapshot(input());
  const second = setup('2026-11-01T09:00:00Z');
  const imported = second.journal.importJSON(first.journal.exportJSON());
  assert.equal(imported[0].actualType, 'research-retrospective'); assert.equal(imported[0].provenance, 'imported-unverified');
  assert.equal(imported[0].claimedActualType, 'pre-match'); assert.equal(imported[0].createdAt, row.createdAt);
  assert.equal(imported[0].importedAt, '2026-11-01T09:00:00.000Z'); assert.deepEqual(imported[0].report, row.report);
  fails(() => second.journal.importJSON(first.journal.exportJSON()), 'DUPLICATE');
  assert.equal(second.journal.list().length, 1);
  assert.equal(second.storage.values.get('ucl-personal-predictions'), 'old-user-data');
});

test('malformed, malicious, mixed-invalid, or excessive imports are atomic and keep existing data', () => {
  const { journal, storage } = setup(), row = journal.saveSnapshot(input()), original = storage.getItem(STORAGE_KEY);
  fails(() => journal.importJSON('{oops'), 'IMPORT_INVALID');
  fails(() => journal.importJSON(JSON.stringify({ schemaVersion: 'unknown', snapshots: [] })), 'IMPORT_INVALID');
  fails(() => journal.importJSON('{"schemaVersion":"' + VERSION + '","snapshots":[{"__proto__":{"polluted":true}}]}'), 'VALIDATION');
  const validNew = structuredClone(row); validNew.id = 'another-valid-id';
  fails(() => journal.importJSON(JSON.stringify({ schemaVersion: VERSION, snapshots: [validNew, { id: 'bad', actualType: 'research-retrospective' }] })), 'VALIDATION');
  assert.equal(storage.getItem(STORAGE_KEY), original); assert.equal({}.polluted, undefined);
  fails(() => journal.importJSON(JSON.stringify({ schemaVersion: VERSION, snapshots: Array(MAX_SNAPSHOTS + 1).fill(row) })), 'CAPACITY');
});

test('full capacity never silently deletes old snapshots; remove targets only the journal key', () => {
  const { journal, storage } = setup();
  for (let i = 0; i < MAX_SNAPSHOTS; i++) journal.saveSnapshot(input());
  const prior = journal.list(), original = storage.getItem(STORAGE_KEY);
  fails(() => journal.saveSnapshot(input()), 'CAPACITY'); assert.equal(storage.getItem(STORAGE_KEY), original);
  const removedId = prior[0].id; assert.equal(journal.remove(removedId), true); assert.equal(journal.get(removedId), null);
  assert.equal(journal.list().length, 49); assert.equal(storage.values.get('ucl-personal-predictions'), 'old-user-data');
  fails(() => journal.remove('does-not-exist'), 'NOT_FOUND');
});

test('unavailable storage, corruption, quota and non-JSON values fail clearly without silent memory fallback', () => {
  fails(() => createJournal({ storage: null }), 'STORAGE_UNAVAILABLE');
  const inaccessible = createJournal({ storage: { getItem() { throw new Error('Denied'); }, setItem() {} } });
  fails(() => inaccessible.list(), 'STORAGE_UNAVAILABLE');
  const corruptStorage = memory({ [STORAGE_KEY]: '{broken' });
  const corrupt = createJournal({ storage: corruptStorage, now: () => '2026-10-15T12:00:00Z' }); fails(() => corrupt.saveSnapshot(input()), 'CORRUPT_STORAGE');
  assert.equal(corruptStorage.getItem(STORAGE_KEY), '{broken');
  const quota = createJournal({ storage: { getItem() { return null; }, setItem() { const error = new Error('Full'); error.name = 'QuotaExceededError'; throw error; } }, now: () => '2026-10-15T12:00:00Z' });
  fails(() => quota.saveSnapshot(input()), 'QUOTA_EXCEEDED');
  const cycle = {}; cycle.self = cycle; fails(() => setup().journal.saveSnapshot(input({ report: cycle })), 'VALIDATION');
});

test('existing predictor nested version is captured and timezone offsets normalize without changing source copies', () => {
  const { journal } = setup();
  const fixture = { ...input().fixture, kickoff: '2026-10-21T03:00:00+08:00' };
  const baseline = { fixture: { id: fixture.id }, prediction: { version: 'score-poisson-1.0', cutoffDate: '2026-10-15', home: 0.4 }, generatedAt: '2026-10-15T11:30:00Z' };
  const row = journal.saveSnapshot(input({ fixture, baseline }));
  assert.equal(row.modelVersion, 'score-poisson-1.0'); assert.deepEqual(row.baseline, baseline);
  assert.equal(row.kickoff, '2026-10-20T19:00:00.000Z');
});

test('directional mechanism ids and research lineup metadata survive snapshots and reviews', () => {
  const { journal, setNow } = setup();
  const mechanismId = 'arsenal->barcelona:build-press';
  const lineups = { home: { status: 'unknown', source: '', checkedAt: '', officiallyVerified: false, notice: '尚未核查' }, away: { status: 'unknown' } };
  const row = journal.saveSnapshot(input({ selectedHypotheses: [mechanismId], lineups }));
  assert.equal(row.selectedHypotheses[0], mechanismId); assert.equal(row.lineups.home.officiallyVerified, false);
  assert.equal(row.lineups.home.checkedAt, null);
  setNow('2026-10-21T09:00:00Z');
  const saved = journal.saveReview(row.id, review({ verdicts: [{ mechanismId, verdict: 'unknown', evidence: '' }] }));
  assert.equal(saved.reviews[0].verdicts[0].mechanismId, mechanismId);
});
