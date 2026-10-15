import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';

const require = createRequire(import.meta.url);
const api = require('../js/services/opponent-baseline.js');
const baseline = require('../js/services/prediction-baseline.js');
const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const input = await fs.readFile(path.join(root, 'research/ucl-history/prediction-dataset.json'), 'utf8');
const dataset = JSON.parse(input);
if (dataset.license !== 'CC0-1.0' || dataset.source !== 'OpenFootball') throw new Error('Only the audited CC0 OpenFootball dataset is authorized for this experiment.');
const rows = dataset.rows.filter(row => ['group', 'league'].includes(row.stage));
const original = JSON.parse(await fs.readFile(path.join(root, 'js/data/prediction/model.json'), 'utf8'));
const cutoffDate = '2026-10-15';
const labels = ['home', 'draw', 'away'];
const clampProbability = p => Math.max(1e-12, Math.min(1 - 1e-12, p));
const newBins = () => Array.from({ length: 10 }, (_, i) => ({ lower: i / 10, upper: (i + 1) / 10, count: 0, predicted: 0, observed: 0 }));
const addBin = (bins, p, y) => { const b = bins[Math.min(9, Math.floor(p * 10))]; b.count++; b.predicted += p; b.observed += y; };
const finishBins = bins => bins.filter(b => b.count).map(b => ({ ...b, predicted: b.predicted / b.count, observed: b.observed / b.count }));
function summarize(samples) {
  let logLoss = 0, brier = 0, correct = 0, scoreLogLoss = 0;
  const calibration = newBins();
  const binary = Object.fromEntries(['over25', 'over35', 'btts'].map(key => [key, { logLoss: 0, brier: 0, bins: newBins() }]));
  for (const sample of samples) {
    const { prediction, h, a } = sample, actual = api.outcome(h, a), p = prediction.result;
    logLoss -= Math.log(clampProbability(p[actual]));
    correct += Number(labels.reduce((best, key) => p[key] > p[best] ? key : best, 'home') === actual);
    for (const key of labels) { const y = Number(key === actual); brier += (p[key] - y) ** 2; addBin(calibration, p[key], y); }
    const hp = api.poisson(prediction.rates.home), ap = api.poisson(prediction.rates.away);
    scoreLogLoss -= Math.log(Math.max(1e-12, hp[h] * ap[a]));
    const values = prediction.markets || { over25: prediction.totals.slice(3).reduce((s, v) => s + v, 0),
      over35: prediction.totals.slice(4).reduce((s, v) => s + v, 0), btts: (1 - hp[0]) * (1 - ap[0]) };
    for (const [key, y] of Object.entries({ over25: Number(h + a > 2.5), over35: Number(h + a > 3.5), btts: Number(h > 0 && a > 0) })) {
      const q = clampProbability(values[key]), m = binary[key];
      m.logLoss -= y * Math.log(q) + (1 - y) * Math.log(1 - q); m.brier += (q - y) ** 2; addBin(m.bins, q, y);
    }
  }
  const n = samples.length;
  return { matches: n, logLoss: logLoss / n, brier: brier / n, accuracy: correct / n, scoreLogLoss: scoreLogLoss / n,
    calibration: finishBins(calibration), markets: Object.fromEntries(Object.entries(binary).map(([key, m]) => [key,
      { logLoss: m.logLoss / n, brier: m.brier / n, calibration: finishBins(m.bins) }])) };
}
const convergence = [];
function evaluate(seasons, params, kind = 'opponent') {
  const cache = new Map(), samples = [];
  for (const row of rows.filter(row => seasons.includes(row.season))) {
    if (!cache.has(row.date)) {
      const model = kind === 'opponent' ? api.fit(rows, row.date, params) : baseline.buildModel(rows, row.date, null, original.params);
      cache.set(row.date, model);
      if (kind === 'opponent') convergence.push({ cutoffDate: row.date, ridge: params.ridge, ...model.fitDiagnostics });
    }
    const prediction = kind === 'opponent' ? api.forecast(cache.get(row.date), row.home, row.away)
      : baseline.forecast(cache.get(row.date), row.home, row.away, { includeHalfFull: false });
    const [h, a] = row.score.split('-').map(Number); samples.push({ prediction, h, a });
  }
  return summarize(samples);
}
// Only 2023/24 chooses ridge. Later seasons are already-viewed development comparisons, not a fresh test.
const candidates = [2, 6, 12].map(ridge => {
  const params = { ...api.DEFAULT_PARAMS, ridge, halfLifeDays: 730 };
  const comparison = evaluate(['2023-24'], params);
  console.log(JSON.stringify({ stage: 'development-selection', ridge, matches: comparison.matches, logLoss: comparison.logLoss }));
  return { params, comparison };
}).sort((a, b) => a.comparison.logLoss - b.comparison.logLoss);
const params = candidates[0].params;
const bySeason = ['2024-25', '2025-26'].map(season => ({ season, opponent: evaluate([season], params), baseline: evaluate([season], params, 'baseline') }));
// Concatenated metric values are a match-weighted average; calibration is recomputed over all rows.
const opponent = evaluate(['2024-25', '2025-26'], params), reference = evaluate(['2024-25', '2025-26'], params, 'baseline');
const checkpoint = api.fit(rows, cutoffDate, params);
const gate = { enabled: false, status: 'experimental-shadow-only',
  reason: 'No new prospective independent evaluation; no lineup data integrated; official V1.0 unchanged.' };
const sourceSet = [{ name: 'OpenFootball Champions League', license: 'CC0-1.0', repository: dataset.sourceRepository,
  seasons: dataset.sources.map(source => source.season), stages: ['group', 'league'], datasetSha256: createHash('sha256').update(input).digest('hex') }];
const report = { schemaVersion: 1, version: api.VERSION, generatedAt: new Date().toISOString(), releaseGate: gate, params,
  selection: { season: '2023-24', criterion: 'lowest 1X2 log loss on chronological development predictions', candidates },
  evaluation: { designation: 'development-comparison', seasons: ['2024-25', '2025-26'], opponent, baseline: reference,
    relativeLogLossImprovement: 1 - opponent.logLoss / reference.logLoss, relativeBrierImprovement: 1 - opponent.brier / reference.brier,
    scoreLogLossDifference: opponent.scoreLogLoss - reference.scoreLogLoss, accuracyDifference: opponent.accuracy - reference.accuracy },
  bySeason, referenceModel: { version: baseline.VERSION, params: original.params }, sourceSet,
  protocol: { cutoff: 'Strictly earlier calendar dates only; group/league stages only; exact same input rows and dates for both models.',
    refit: 'Joint model refitted independently once per match calendar date; no target-day match can train another target-day prediction.',
    estimation: checkpoint.fitDiagnostics.estimation, weights: 'Exponential recency decay, half-life 730 days.',
    selection: 'Only ridge is selected on 2023/24; no tuning on 2024/25 or 2025/26.',
    validation: '2024/25 and 2025/26 scores were already examined in V1.0. These are development comparisons, NOT independent holdout results.',
    lineup: 'No player, injury, lineup, domestic league or tactical numerical effects.' },
  fitAudit: { fits: convergence.length, unconverged: convergence.filter(row => !row.converged).length,
    maximumIterations: Math.max(...convergence.map(row => row.iterations)), finalFit: checkpoint.fitDiagnostics },
  caveats: ['Historical scores were downloaded after matches; original publication timestamps are unavailable.',
    'Chronological reconstruction is not a historical saved live-prediction record.',
    'The source set ends before the 2026/27 season: no current-season results or lineup observations are included.',
    'Unknown teams shrink to zero attack/defense effects; this is not proof they have average real-world ability.',
    'Independent Poisson does not model low-score dependence, injuries or tactical interactions.',
    'Metrics are aggregate comparisons without uncertainty intervals and do not guarantee future improvement.',
    'Brier score measures more than calibration; inspect reliability bins alongside proper scoring rules.'] };
const artifact = { ...checkpoint, trainingCutoff: cutoffDate, latestObservedDate: checkpoint.lastDate, sourceSet, releaseGate: gate,
  source: 'OpenFootball', license: 'CC0-1.0', sourceRepository: dataset.sourceRepository,
  sourceSeasons: dataset.sources.map(({ season, sha256, counts }) => ({ season, sha256, counts })),
  auditedMatches: dataset.total, trainingMatches: checkpoint.count,
  updatePolicy: 'Fixed locally built coefficients. Website update-data button does not refit this artifact.',
  inferencePolicy: 'Only use for fixtures whose calendar date is >= trainingCutoff. Earlier dates require a separately refitted earlier snapshot.',
  limitations: report.caveats };
const out = path.join(root, 'js/data/prediction');
await fs.writeFile(path.join(out, 'opponent-model.json'), JSON.stringify(artifact, null, 2) + '\n');
await fs.writeFile(path.join(out, 'opponent-backtest.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ version: api.VERSION, params, trainingMatches: checkpoint.count, latestObservedDate: checkpoint.lastDate,
  comparison: { opponentLogLoss: opponent.logLoss, baselineLogLoss: reference.logLoss, relativeImprovement: report.evaluation.relativeLogLossImprovement },
  fitAudit: report.fitAudit, releaseGate: gate }, null, 2));
