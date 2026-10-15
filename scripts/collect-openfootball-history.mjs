import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

// Local research import only: not a verified website or prediction-model input.
const seasons = ["2018-19", "2019-20", "2020-21", "2021-22", "2022-23", "2023-24"];
if (process.argv.includes('--all')) seasons.push('2024-25', '2025-26');
const months = new Map(
  ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
    .map((month, index) => [month, index + 1]),
);
const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const outputDir = path.join(root, "research", "ucl-history");

export function parseScore(home, away, suffix, season, lineNumber) {
  const first = [Number(home), Number(away)];
  const extra = suffix.match(/a\.e\.t\.\s*\((\d+)-(\d+),\s*(\d+)-(\d+)\)/i);
  if (suffix.includes("pen.") && !extra) {
    throw new Error(season + ":" + lineNumber + " has unrecognized penalty notation");
  }
  const regulation = extra ? [Number(extra[1]), Number(extra[2])] : first;
  const afterExtraTime = extra
    ? (suffix.includes("pen.")
      ? (suffix.match(/(\d+)-(\d+)\s+a\.e\.t\./i) || []).slice(1).map(Number)
      : first)
    : null;
  if (extra && afterExtraTime.length !== 2) {
    throw new Error(season + ":" + lineNumber + " has unrecognized extra-time score");
  }
  const half = extra
    ? [Number(extra[3]), Number(extra[4])]
    : (suffix.match(/\((\d+)-(\d+)\)/) || []).slice(1).map(Number);
  return {
    score90Home: regulation[0],
    score90Away: regulation[1],
    scoreAfterExtraTime: afterExtraTime,
    penaltyShootout: suffix.includes("pen.") ? first : null,
    halfTime: half.length === 2 ? half : null,
    scoreStatus: suffix.includes("pen.") ? "penalties" : extra ? "extra_time" : "normal",
  };
}

export function parseSeason(season, url, raw) {
  let stage = null;
  let date = null;
  let declared = null;
  const matches = [];
  const lines = raw.replace(/\r/g, "").split("\n");
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i].trimEnd();
    const count = line.match(/^# Matches\s+(\d+)/);
    if (count) declared = Number(count[1]);
    const stageLine = line.match(/^\s*▪\s+(.+)$/);
    if (stageLine) stage = stageLine[1].trim();
    const day = line.match(/^\s+(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s+([A-Z][a-z]{2})\s+(\d{1,2})(?:\s+(\d{4}))?\s*$/);
    if (day) {
      const month = months.get(day[1]);
      if (!month) throw new Error(season + ":" + (i + 1) + " has unknown month");
      const year = day[3] ? Number(day[3]) : Number(season.slice(0, 4)) + (month < 9 ? 1 : 0);
      date = [year, String(month).padStart(2, "0"), day[2].padStart(2, "0")].join("-");
    }
    if (!/\sv\s/.test(line)) continue;
    const fixture = line.match(/^\s*(?:(\d{1,2}:\d{2})\s+)?(.+?)\s+v\s+(.+?)\s+(\d+)-(\d+)(.*)$/);
    if (!fixture || !date || !stage) {
      throw new Error(season + ":" + (i + 1) + " is an unrecognized fixture: " + line);
    }
    const [, localTime, home, away, homeScore, awayScore, suffix] = fixture;
    matches.push({
      season,
      stage,
      date,
      localTime: localTime || null,
      timeZone: null,
      home: home.trim(),
      away: away.trim(),
      ...parseScore(homeScore, awayScore, suffix, season, i + 1),
      sourceUrl: url,
      sourceLine: i + 1,
    });
  }
  if (declared === null || matches.length !== declared) {
    throw new Error(season + " parsed " + matches.length + " fixtures; source declares " + declared);
  }
  const keys = new Set(matches.map((m) => [m.date, m.home, m.away].join("|")));
  if (keys.size !== matches.length) throw new Error(season + " has duplicate fixtures");
  return matches;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
const allMatches = [];
const sources = [];
for (const season of seasons) {
  const url = "https://raw.githubusercontent.com/openfootball/champions-league/master/" + season + "/cl.txt";
  const localRaw = path.join(outputDir, "raw", season + "-cl.txt");
  let raw;
  try {
    raw = await readFile(localRaw, "utf8");
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    const response = await fetch(url, { headers: { "User-Agent": "ucl-data-center-history-audit/1.0" }, signal: AbortSignal.timeout(20000) });
    if (!response.ok) throw new Error(season + " download failed: HTTP " + response.status);
    raw = await response.text();
    await mkdir(path.dirname(localRaw), { recursive: true });
    await writeFile(localRaw, raw);
  }
  const matches = parseSeason(season, url, raw);
  allMatches.push(...matches);
  sources.push({
    season,
    url,
    sha256: createHash("sha256").update(raw).digest("hex"),
    count: matches.length,
    extraTime: matches.filter((m) => m.scoreStatus === "extra_time").length,
    penalties: matches.filter((m) => m.scoreStatus === "penalties").length,
  });
}
const document = {
  schemaVersion: 1,
  purpose: "local research import; not a verified website or model input",
  retrievedAt: new Date().toISOString(),
  sourceRepository: "https://github.com/openfootball/champions-league",
  sourceLicense: "CC0-1.0; verify provenance before public reuse",
  caveats: [
    "Dates follow the source's local calendar; kickoff time zones are unknown.",
    "Team names are source spellings, not this site's canonical team IDs.",
    "Extra-time and penalty scores are separated from 90-minute scores.",
    "This source has no xG, lineup, injury, or event-level dataset.",
  ],
  sources,
  matches: allMatches,
};
await mkdir(outputDir, { recursive: true });
const output = path.join(outputDir, seasons.length === 8 ? "openfootball-2018-2026.json" : "openfootball-2018-2024.json");
await writeFile(output, JSON.stringify(document, null, 2) + "\n");
if (seasons.length === 8) {
  const licensePath = path.join(outputDir, 'OPENFOOTBALL-LICENSE.md');
  try { await readFile(licensePath, 'utf8'); }
  catch (error) {
    if (error.code !== 'ENOENT') throw error;
    const response = await fetch('https://raw.githubusercontent.com/openfootball/champions-league/master/LICENSE.md', { signal: AbortSignal.timeout(20000) });
    if (!response.ok) throw new Error('License download failed');
    await writeFile(licensePath, await response.text());
  }
}
console.log(JSON.stringify({
  seasons: sources,
  totalMatches: allMatches.length,
  uniqueTeams: new Set(allMatches.flatMap((m) => [m.home, m.away])).size,
  output,
}, null, 2));
}
