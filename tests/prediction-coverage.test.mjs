import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { calculateCoverage, auditLocalCoverage } from '../scripts/audit-prediction-coverage.mjs';

test('missing inputs are not zero-valued valid training features', () => {
  const report = calculateCoverage({ dataset: { rows: [{ season: '2025-26', date: '2025-10-01', home: 'A', away: 'B', score: '1-0', stage: 'league' }] },
    roster: [{ id: 'a', name: 'A', zh: '甲队' }] });
  assert.equal(report.fields.find(field => field.id === 'startingXI').training.present, 0);
  assert.equal(report.fields.find(field => field.id === 'historicalMinutes').training.status, 'missing');
  assert.equal(report.fields.find(field => field.id === 'shotXg').sample.ratio, null);
  assert.equal(report.localDatasets.playerRegistry.players, null);
  assert.equal(report.localDatasets.playerRegistry.status, 'not-ready');
  assert.equal(report.gates.lineupProbabilityEnabled, false);
});

test('historical player descriptions never imply a current complete roster', () => {
  const report = calculateCoverage({ dataset: { rows: [] }, roster: [{ id: 'a', name: 'A', zh: '甲队' }],
    profiles: [{ name: 'A', personnel: { observedPlayers: [{ name: 'One player' }] } }],
    registry: { players: [{ playerId: 'one', historicalObservations: [{ clubId: 'a' }] }] } });
  assert.equal(report.clubCoverage.rows[0].historicalPlayerObservations, 1);
  assert.equal(report.clubCoverage.rows[0].verifiedCurrentRoster, false);
  assert.equal(report.clubCoverage.clubsWithTrainingLineups, 0);
  assert.equal(report.localDatasets.playerRegistry.historicalObservations, 1);
  const current = calculateCoverage({ dataset: { rows: [] }, roster: [{ id: 'a', name: 'A', zh: '甲队' }], registry: { players: [{id:'player-a'}], observations: [{id:'obs-a',playerId:'player-a',teamId:'a'}] } });
  assert.equal(current.localDatasets.playerRegistry.historicalObservations,1);
});

test('actual local sample is distinguished from eligible training coverage', async () => {
  const report = await auditLocalCoverage();
  assert.equal(report.localDatasets.scores.matches, 1122);
  assert.equal(report.localDatasets.scores.eligibleTrainingMatches, 864);
  assert.equal(report.localDatasets.scores.clubs, 87);
  assert.equal(report.localDatasets.scores.seasons.length, 8);
  assert.deepEqual(report.localDatasets.scores.seasons.map(row => row.eligibleTrainingMatches), [96, 96, 96, 96, 96, 96, 144, 144]);
  const sample = report.localDatasets.statsbombSample;
  assert.equal(sample.matches, 1);
  assert.equal(sample.stage, 'knockout');
  assert.equal(sample.eligibleTrainingMatches, 0);
  assert.equal(sample.listedPlayers, 46);
  assert.equal(sample.starters, 22);
  assert.equal(sample.substitutions, 6);
  assert.equal(sample.events, 3165);
  assert.equal(sample.shotsWithXg, 30);
  assert.equal(sample.playersWithPositionIntervals, 28);
  assert.equal(sample.normalizedPlayerMinutes, 0);
  assert.equal(report.localDatasets.playerRegistry.players,33);
  assert.equal(report.localDatasets.playerRegistry.historicalObservations,33);
  for (const id of ['startingXI', 'bench', 'substitutions', 'historicalMinutes', 'events', 'shotXg', 'injuries', 'suspensions', 'preMatchPublishedAt']) {
    assert.equal(report.fields.find(field => field.id === id).training.present, 0, id);
  }
  assert.equal(report.fields.find(field => field.id === 'startingXI').sample.present, 1);
  assert.equal(report.fields.find(field => field.id === 'historicalMinutes').sample.status, 'reconstructable-not-normalized');
  assert.equal(report.clubCoverage.rows.find(row => row.clubId === 'liverpool').localEventSampleMatches, 1);
  assert.equal(report.clubCoverage.rows.find(row => row.clubId === 'liverpool').eligibleTrainingLineups, 0);
});

test('published audit is aggregates only, clear denominators, closed promotion gates', () => {
  const report = JSON.parse(fs.readFileSync('js/data/prediction/coverage-audit.json', 'utf8'));
  assert.equal(report.auditedAt, '2026-10-15');
  assert.equal(report.clubCoverage.denominator, 36);
  assert.equal(report.clubCoverage.rows.length, 36);
  assert.equal(new Set(report.clubCoverage.rows.map(row => row.clubId)).size, 36);
  assert.equal(report.clubCoverage.clubsWithVerifiedCurrentRoster, 0);
  assert.equal(report.gates.lineupProbabilityEnabled, false);
  assert.equal(report.gates.opponentBaselinePromotion, false);
  assert.ok(report.fields.every(field => field.training.denominator === 864));
  assert.equal(report.scope.rawDataPublished, false);
  const serialized = JSON.stringify(report);
  for (const rawField of ['player_name', 'statsbomb_xg', 'sourceLine', 'jersey_number', 'shot_freeze_frame']) {
    assert.equal(serialized.includes('"' + rawField + '"'), false, rawField);
  }
});
