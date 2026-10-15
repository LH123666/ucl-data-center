import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { createCatalog, validDay } = require('../js/services/tactical-profiles.js');
const baseline = require('../js/services/prediction-baseline.js');
const context = vm.createContext({});
vm.runInContext(await fs.readFile(new URL('../js/data/matches-data.js', import.meta.url), 'utf8'), context);
const roster = JSON.parse(vm.runInContext('JSON.stringify(leagueTeamCatalog)', context));
const framework = JSON.parse(await fs.readFile(new URL('../js/data/tactics/framework.json', import.meta.url), 'utf8'));
const shards = await Promise.all(['a', 'b', 'c'].map(async group => JSON.parse(await fs.readFile(new URL('../js/data/tactics/clubs-' + group + '.json', import.meta.url), 'utf8'))));
const fresh = () => ({ roster: structuredClone(roster), shards: structuredClone(shards), framework: structuredClone(framework) });
const build = payload => createCatalog(payload.roster, payload.shards, payload.framework);

test('tactical dossiers cover exactly the 36 canonical clubs and preserve Chinese identities', () => {
  const catalog = build(fresh());
  assert.equal(catalog.all().length, 36);
  for (const team of roster) {
    assert.equal(catalog.get(team.id).name, team.name);
    assert.equal(catalog.get(team.name).zh, team.zh);
    assert.equal(catalog.get(team.id).logo, team.logo);
  }
  assert.equal(catalog.get('Unknown club'), null);
  assert.ok(catalog.all().every(profile => /[\u4e00-\u9fff]/.test(profile.zh)));
});

test('all factual traits and named personnel have traceable HTTPS sources and observation periods', () => {
  const catalog = build(fresh());
  assert.equal(catalog.all().reduce((sum, row) => sum + row.traits.length, 0), 85);
  for (const profile of catalog.all()) {
    const sources = new Set(profile.sources.map(source => source.id));
    assert.ok(profile.evidencePeriod && profile.coachContext && profile.personnel.status);
    assert.ok(profile.sources.every(source => source.url.startsWith('https://')));
    assert.ok(profile.traits.every(trait => trait.sourceIds.length && trait.sourceIds.every(id => sources.has(id))));
    for (const player of profile.personnel.observedPlayers) assert.ok(player.period && player.sourceIds.every(id => sources.has(id)));
  }
});

test('limited evidence stays limited; unknown tactics are not filled from player biographies', () => {
  const catalog = build(fresh());
  assert.equal(catalog.all().filter(profile => profile.coverage === 'limited').length, 13);
  assert.equal(catalog.get('Fenerbahce').traits.length, 0);
  assert.equal(catalog.get('AEK Athens').traits.length, 0);
  assert.equal(catalog.get('Slovan Bratislava').traits.length, 0);
  assert.equal(catalog.get('Sabah').name, 'Sabah');
  assert.match(catalog.get('Sabah').coachContext, /阿塞拜疆/);
});

test('each club has at least two conditional matchups without fabricated probabilities', () => {
  const catalog = build(fresh());
  const styles = new Set(framework.styles.map(style => style.id));
  for (const profile of catalog.all()) {
    assert.ok(profile.matchups.length >= 2);
    assert.ok(profile.matchups.every(matchup => styles.has(matchup.opponentStyle) && matchup.branches.length >= 2));
    for (const matchup of profile.matchups) for (const branch of matchup.branches) {
      assert.ok(branch.condition && branch.form);
      assert.equal('probability' in branch, false);
      assert.equal('winner' in branch, false);
    }
  }
  assert.equal(framework.mechanisms.length, 14);
  assert.ok(framework.mechanisms.every(rule => rule.branches.length >= 2 && rule.styles.every(style => styles.has(style))));
});

test('catalog rejects duplicates, wrong identities, unsupported traits and dangling sources', () => {
  let data = fresh(); data.shards[0][0].name = data.shards[0][1].name;
  assert.throws(() => build(data), /重复|遗漏/);
  data = fresh(); data.shards[0][0].name = 'Not a club';
  assert.throws(() => build(data), /不在当前目录/);
  data = fresh(); data.shards[0][0].traits[0].sourceIds = ['missing'];
  assert.throws(() => build(data), /未关联/);
  data = fresh(); data.shards[0][0].traits[0].dimension = 'imaginary';
  assert.throws(() => build(data), /格式错误/);
  data = fresh(); data.shards[0][0].personnel.observedPlayers[0].sourceIds = ['missing'];
  assert.throws(() => build(data), /未关联/);
});

test('unsafe URLs, future source dates and invalid calendar dates cannot pass the dossier validator', () => {
  let data = fresh(); data.shards[0][0].sources[0].url = 'javascript:alert(1)';
  assert.throws(() => build(data), /不安全/);
  data = fresh(); data.shards[0][0].sources[0].publishedAt = '2026-10-16';
  assert.throws(() => build(data), /发布日期无效/);
  data = fresh(); data.shards[0][0].sources[0].accessedAt = '2026-10-16';
  assert.throws(() => build(data), /访问日期无效/);
  assert.equal(validDay('2026-02-30'), false);
  assert.equal(validDay('2024-02-29'), true);
});

test('research catalog is immutable and leaves the numerical prediction bit-for-bit unchanged', () => {
  const model = baseline.buildModel([{season:'2025-26',date:'2025-10-01',home:'Arsenal',away:'Liverpool',score:'2-1',stage:'league'}], '2026-10-15');
  const before = JSON.stringify(baseline.forecast(model, 'Arsenal', 'Liverpool', {includeHalfFull:false}));
  const catalog = build(fresh());
  assert.equal(catalog.probabilityAdjustmentEnabled, false);
  assert.ok(catalog.all().every(profile => profile.probabilityAdjustmentEnabled === false));
  assert.throws(() => { catalog.get('Arsenal').traits.push({}); }, TypeError);
  const after = JSON.stringify(baseline.forecast(model, 'Arsenal', 'Liverpool', {includeHalfFull:false}));
  assert.equal(after, before);
  const data = fresh(); data.framework.probabilityAdjustmentEnabled = true;
  assert.throws(() => build(data), /隔离/);
});

test('revision 1.1 retains all claims with stable identities, separate date meanings and conservative source policy', () => {
  const catalog = build(fresh());
  assert.equal(catalog.evidenceRevision, '1.1');
  const ids = [];
  for (const profile of catalog.all()) {
    assert.equal(profile.revision, '1.1');
    assert.equal(profile.sourcePolicy.publicationIsNotObservation, true);
    assert.equal(profile.sourcePolicy.expiryIsEditorialPolicy, true);
    assert.match(profile.sourcePolicy.reviewedAtMeaning, /未重新/);
    assert.match(profile.changeLog[0].summary, /未重新核查/);
    profile.traits.forEach((trait, index) => {
      ids.push(trait.id);
      assert.equal(trait.id, profile.id + ':claim:' + (index + 1));
      assert.ok(trait.evidence.period && trait.evidence.reviewedAt);
      assert.ok(['observation', 'intent', 'background', 'hypothesis'].includes(trait.evidence.kind));
    });
  }
  assert.equal(ids.length, 85);
  assert.equal(new Set(ids).size, 85);
  const paris = catalog.get('Paris Saint-Germain').traits[0];
  assert.equal(paris.evidence.observedAt, null, 'publication date must not be relabelled as observation date');
  assert.equal(paris.evidence.expiryBasis, 'source-publication');
  assert.equal(paris.evidence.validUntil, '2025-10-01', 'metadata migration must not reset an old publication-based review deadline');
  assert.equal(paris.evidence.applicability, 'historical');
});

test('style signals are manually claim-scoped; negative statements, generic dimensions and player biographies yield no inferred labels', () => {
  const catalog = build(fresh());
  assert.deepEqual(catalog.get('AS Roma').traits.find(trait => trait.dimension === 'marking').evidence.signals, []);
  assert.deepEqual(catalog.get('Bayern Munich').traits.find(trait => trait.dimension === 'progression').evidence.signals, []);
  assert.deepEqual(catalog.get('Viking').traits[0].evidence.signals, []);
  assert.deepEqual(catalog.get('Sabah').traits[0].evidence.signals, []);
  assert.deepEqual(catalog.get('Paris Saint-Germain').traits[0].evidence.signals, ['high-press']);
  assert.equal(catalog.get('LASK').traits[1].evidence.kind, 'intent');
  assert.equal(catalog.get('Feyenoord').traits[1].evidence.kind, 'background');
});

test('mixed-season dossiers use each claim period, not the profile-level current-season flag', () => {
  const catalog = build(fresh());
  const galatasaray = catalog.get('Galatasaray');
  assert.equal(galatasaray.currentSeasonVerified, true);
  assert.equal(galatasaray.traits[0].evidence.season, '2025-26');
  assert.equal(galatasaray.traits[0].evidence.observedAt, '2025-10-22');
  assert.equal(galatasaray.traits[0].evidence.applicability, 'historical');
  assert.deepEqual(catalog.get('Real Betis').traits.map(trait => trait.evidence.season), ['2024-25', '2025-26', '2025-26']);
  assert.equal(catalog.all().flatMap(profile => profile.traits).filter(trait => trait.evidence.applicability === 'current-window').length, 0);
});

test('unpublished source dates retain null expiry; the date of metadata review is not a fresh football observation', () => {
  const catalog = build(fresh());
  for (const name of ['Feyenoord', 'Como', 'Napoli']) for (const trait of catalog.get(name).traits) {
    assert.equal(trait.evidence.observedAt, null);
    assert.equal(trait.evidence.validUntil, null);
    assert.equal(trait.evidence.expiryBasis, 'unknown');
    assert.notEqual(trait.evidence.applicability, 'current-window');
  }
});

test('invalid evidence kinds, signals, IDs, seasons and future observation dates are rejected', () => {
  const mutations = [
    [data => { data.shards[0][0].traits[0].evidence.kind = 'certain-fact'; }, /证据类型/],
    [data => { data.shards[0][0].traits[0].evidence.signals = ['invented-style']; }, /球风信号/],
    [data => { data.shards[0][0].traits[0].evidence.signals = ['high-press', 'high-press']; }, /球风信号/],
    [data => { data.shards[0][0].traits[1].id = data.shards[0][0].traits[0].id; }, /标识重复/],
    [data => { data.shards[0][0].traits[0].evidence.season = '2025-99'; }, /证据赛季/],
    [data => { data.shards[0][0].traits[0].evidence.observedAt = '2026-10-16'; }, /观察或核查日期/],
    [data => { data.shards[0][0].traits[0].evidence.reviewedAt = '2026-02-30'; }, /观察或核查日期/]
  ];
  for (const [mutate, expected] of mutations) { const data = fresh(); mutate(data); assert.throws(() => build(data), expected); }
});

test('expiry follows its stated policy and historical material cannot claim current applicability', () => {
  let data = fresh(); data.shards[0][0].traits[0].evidence.validUntil = '2027-01-01';
  assert.throws(() => build(data), /期限与政策不一致/);
  data = fresh(); data.shards[0][0].traits[0].evidence.applicability = 'current-window';
  assert.throws(() => build(data), /旧资料|历史赛季/);
  data = fresh(); data.shards[0][0].traits[0].evidence.expiryBasis = 'unknown';
  assert.throws(() => build(data), /未知依据/);
  data = fresh(); data.shards[0][0].traits[0].evidence.reviewedAt = '2024-01-01';
  assert.throws(() => build(data), /早于关联来源/);
  data = fresh(); data.shards[0][0].sourcePolicy.expiryIsEditorialPolicy = false;
  assert.throws(() => build(data), /编辑复核政策/);
});

test('legacy dossiers remain readable but normalize to background without inferred style signals or renewed validity', () => {
  const data = fresh();
  for (const profile of data.shards.flat()) {
    delete profile.revision; delete profile.sourcePolicy; delete profile.changeLog;
    for (const trait of profile.traits) { delete trait.id; delete trait.evidence; }
  }
  const catalog = build(data);
  assert.equal(catalog.all().length, 36);
  for (const profile of catalog.all()) for (const trait of profile.traits) {
    assert.equal(trait.evidence.kind, 'background');
    assert.deepEqual(trait.evidence.signals, []);
    assert.equal(trait.evidence.validUntil, null);
    assert.equal(trait.evidence.applicability, 'needs-review');
  }
});
