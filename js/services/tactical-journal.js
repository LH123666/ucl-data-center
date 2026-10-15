/* Local, append-only research journal. Never trains or changes prediction probabilities. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.UclTacticalJournal = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const VERSION = 'tactical-journal-1.0';
  const STORAGE_KEY = 'ucl:tactical-journal:v1';
  const MAX_SNAPSHOTS = 50, MAX_CHARS = 2000000, MAX_SNAPSHOT_CHARS = 240000;
  const REVIEW_DELAY_MS = 2 * 60 * 60 * 1000;
  const VERDICTS = new Set(['supported', 'contradicted', 'unknown']);
  const SEASONS = new Set(['2024-25', '2025-26', '2026-27']);
  let sequence = 0;

  class JournalError extends Error {
    constructor(code, message) { super(message); this.name = 'JournalError'; this.code = code; }
  }
  function check(condition, message, code = 'VALIDATION') { if (!condition) throw new JournalError(code, message); }
  function object(value) { return value !== null && typeof value === 'object' && !Array.isArray(value); }
  function text(value, max = 1000) { return typeof value === 'string' && value.trim().length > 0 && value.length <= max; }
  function id(value) { return typeof value === 'string' && /^[a-z0-9][a-z0-9._:-]{0,159}$/i.test(value); }
  function hypothesisId(value) {
    return id(value) || (typeof value === 'string' && value.length <= 320
      && /^[a-z0-9]+(?:-[a-z0-9]+)*->[a-z0-9]+(?:-[a-z0-9]+)*:[a-z0-9][a-z0-9._:-]*$/.test(value));
  }
  function teamId(value) { return typeof value === 'string' && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value) && value.length <= 100; }
  function iso(value, label) {
    check(typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(value)
      && Number.isFinite(Date.parse(value)), (label || '时间') + ' 必须是带时区的 ISO 时间');
    const datePart = value.slice(0, 10), d = new Date(datePart + 'T00:00:00Z');
    check(d.toISOString().slice(0, 10) === datePart, (label || '时间') + ' 的日期无效');
    return new Date(value).toISOString();
  }
  function optionalText(value, max, label) {
    if (value === undefined || value === null) return '';
    check(typeof value === 'string' && value.length <= max, label + ' 过长或格式错误');
    return value;
  }
  function cloneJSON(value) {
    let nodes = 0;
    function inspect(item, depth) {
      check(depth <= 30 && ++nodes <= 90000, '记录嵌套过深或内容过大');
      if (item === null || typeof item === 'boolean') return;
      if (typeof item === 'string') { check(item.length <= 40000, '记录中存在过长文本'); return; }
      if (typeof item === 'number') { check(Number.isFinite(item), '记录中不能包含非有限数值'); return; }
      check(typeof item === 'object', '记录只能包含可保存的 JSON 数据');
      check(Array.isArray(item) || Object.getPrototypeOf(item) === Object.prototype || Object.getPrototypeOf(item) === null, '记录不能包含日期对象或自定义对象');
      for (const key of Object.keys(item)) {
        check(!['__proto__', 'constructor', 'prototype'].includes(key), '记录包含不安全的字段名');
        inspect(item[key], depth + 1);
      }
    }
    inspect(value, 0);
    try { return JSON.parse(JSON.stringify(value)); }
    catch { throw new JournalError('VALIDATION', '记录不是有效 JSON，可能包含循环引用'); }
  }
  function freeze(value) {
    if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
    return value;
  }
  function expose(value) { return freeze(cloneJSON(value)); }
  function fixtureRecord(input) {
    check(object(input) && id(input.id), '比赛必须有有效的唯一 ID');
    check(SEASONS.has(input.season), '比赛赛季必须是 2024-25、2025-26 或 2026-27');
    check(teamId(input.homeId) && teamId(input.awayId) && input.homeId !== input.awayId, '比赛双方必须是不同的有效球队 ID');
    check(text(input.home, 180) && text(input.away, 180), '比赛双方名称不完整');
    const row = cloneJSON(input); row.kickoff = iso(input.kickoff, '开赛时间');
    check(['scheduled', 'completed', 'in-progress', 'postponed'].includes(input.status), '比赛状态无效');
    check(input.timeSource === undefined || text(input.timeSource, 1000), '开赛时间来源无效');
    return row;
  }
  function profileRecords(profiles, fixture) {
    check(Array.isArray(profiles) && profiles.length === 2, '快照必须保存双方球队档案副本');
    check(profiles.every(object), '球队档案格式无效');
    const expected = new Set([fixture.homeId, fixture.awayId]);
    check(new Set(profiles.map(p => p.id)).size === 2 && profiles.every(p => expected.has(p.id)), '档案球队与比赛双方不匹配');
    return cloneJSON(profiles);
  }
  function lineupRecords(input, createdAt) {
    if (input === undefined || input === null) input = {};
    check(object(input), '阵容核查记录格式错误');
    const result = {};
    for (const side of ['home', 'away']) {
      const supplied = input[side] || { status: 'unknown' };
      check(object(supplied) && ['unknown', 'expected', 'confirmed'].includes(supplied.status), '阵容状态必须为未知、预计或已确认');
      const lineup = cloneJSON(supplied);
      lineup.source = optionalText(lineup.source, 2000, '阵容来源');
      if (lineup.checkedAt) {
        lineup.checkedAt = iso(lineup.checkedAt, '阵容核查时间');
        check(Date.parse(lineup.checkedAt) <= Date.parse(createdAt), '阵容核查时间不能晚于实际保存时间');
      } else lineup.checkedAt = null;
      if (lineup.status !== 'unknown') check(text(lineup.source, 2000) && lineup.checkedAt, '预计或确认阵容必须有来源与实际核查时间');
      check(lineup.players === undefined || Array.isArray(lineup.players), '阵容球员列表格式错误');
      check(lineup.roles === undefined || Array.isArray(lineup.roles), '阵容角色列表格式错误');
      result[side] = lineup;
    }
    return result;
  }
  function verdictRecord(input, label) {
    check(object(input) && VERDICTS.has(input.verdict), label + ' 判定无效');
    const evidence = optionalText(input.evidence, 6000, label + ' 证据');
    check(input.verdict === 'unknown' || text(evidence, 6000), label + ' 的支持或否定判定必须提供观察证据，不能仅凭比分');
    return { verdict: input.verdict, evidence, note: optionalText(input.note, 4000, label + ' 备注') };
  }
  function reviewRecord(input, snapshot, createdAt, revision) {
    check(object(input), '复盘格式无效');
    check(Date.parse(createdAt) >= Date.parse(snapshot.kickoff) + REVIEW_DELAY_MS, '开赛后至少两小时且已完赛，才能保存赛后复盘', 'NOT_COMPLETED');
    check(object(input.actual) && input.actual.completed === true, '复盘必须明确确认比赛已结束', 'NOT_COMPLETED');
    const actual = input.actual;
    check(Number.isInteger(actual.homeGoals) && actual.homeGoals >= 0 && actual.homeGoals <= 50
      && Number.isInteger(actual.awayGoals) && actual.awayGoals >= 0 && actual.awayGoals <= 50, '实际比分必须是 0 至 50 的整数');
    check(['feed', 'manual'].includes(actual.sourceType) && text(actual.source, 2000), '实际比分必须注明数据源，手填结果不能冒充接口数据');
    if (actual.completedAt) {
      const completedAt = iso(actual.completedAt, '完赛时间');
      check(Date.parse(completedAt) >= Date.parse(snapshot.kickoff) && Date.parse(completedAt) <= Date.parse(createdAt), '完赛时间必须处于开赛与实际复盘时间之间');
    }
    check(Array.isArray(input.verdicts) && input.verdicts.length <= 40, '机制复盘列表无效');
    const seen = new Set();
    const verdicts = input.verdicts.map(entry => {
      check(object(entry) && hypothesisId(entry.mechanismId) && !seen.has(entry.mechanismId), '机制复盘 ID 无效或重复'); seen.add(entry.mechanismId);
      return { mechanismId: entry.mechanismId, ...verdictRecord(entry, '机制') };
    });
    return { id: snapshot.id + ':review:' + revision, revision, createdAt, verdicts,
      form: verdictRecord(input.form, '比赛形式'), actual: cloneJSON(actual),
      errorCause: optionalText(input.errorCause, 4000, '误差原因'), notes: optionalText(input.notes, 6000, '复盘备注') };
  }
  function storedSnapshot(input) {
    check(object(input) && input.schemaVersion === VERSION && id(input.id), '快照版本或唯一 ID 无效');
    const row = cloneJSON(input), fixture = fixtureRecord(row.fixture);
    row.createdAt = iso(row.createdAt, '快照创建时间'); row.cutoff = iso(row.cutoff, '数据截止时间');
    row.kickoff = iso(row.kickoff, '快照开赛时间');
    check(row.kickoff === fixture.kickoff && Date.parse(row.cutoff) <= Date.parse(row.createdAt), '快照时间关系无效');
    check(['pre-match', 'research-retrospective'].includes(row.actualType) && ['local', 'imported-unverified'].includes(row.provenance), '快照类型或来源无效');
    check(row.actualType !== 'pre-match' || (row.provenance === 'local' && fixture.status === 'scheduled'
      && Date.parse(row.createdAt) < Date.parse(row.kickoff)), '赛前快照时间或来源无效');
    row.fixture = fixture; row.profiles = profileRecords(row.profiles, fixture);
    row.lineups = lineupRecords(row.lineups, row.createdAt);
    check(object(row.report), '快照缺少对位报告');
    check(row.baseline === null || object(row.baseline), '数值基线格式错误');
    check(typeof row.baselineAvailable === 'boolean' && row.baselineAvailable === (row.baseline !== null), '数值基线可用性标记错误');
    check(row.modelVersion === null || text(row.modelVersion, 180), '数值模型版本格式错误');
    check(Array.isArray(row.profileRevisions) && row.profileRevisions.length === 2
      && row.profileRevisions.every(item => object(item) && [fixture.homeId, fixture.awayId].includes(item.teamId) && text(item.revision, 180)), '档案版本记录无效');
    row.notes = optionalText(row.notes, 6000, '赛前备注');
    if (row.provenance === 'imported-unverified') {
      check(['pre-match', 'research-retrospective'].includes(row.claimedActualType), '导入文件声称的快照类型无效');
      row.importedAt = iso(row.importedAt, '导入时间');
    }
    check(Array.isArray(row.selectedHypotheses) && row.selectedHypotheses.length <= 40 && row.selectedHypotheses.every(hypothesisId), '所选假设列表无效');
    check(Array.isArray(row.reviews) && row.reviews.length <= 30, '复盘修订历史无效');
    row.reviews = row.reviews.map((review, i) => reviewRecord(review, row, iso(review.createdAt, '复盘创建时间'), i + 1));
    check(JSON.stringify(row).length <= MAX_SNAPSHOT_CHARS, '单份快照过大，请减少备注或重复资料', 'SIZE_LIMIT');
    return row;
  }

  function createJournal(options = {}) {
    let storage;
    try { storage = Object.prototype.hasOwnProperty.call(options, 'storage') ? options.storage : globalThis.localStorage; }
    catch { throw new JournalError('STORAGE_UNAVAILABLE', '浏览器不允许访问本地存储；请检查隐私或站点存储设置'); }
    check(storage && typeof storage.getItem === 'function' && typeof storage.setItem === 'function', '本地存储不可用，无法保证快照保存', 'STORAGE_UNAVAILABLE');
    const now = options.now || (() => new Date());
    check(typeof now === 'function', '当前时间提供器必须是函数');
    const currentISO = () => {
      const value = now();
      const time = value instanceof Date ? value.getTime() : typeof value === 'number' ? value : Date.parse(value);
      check(Number.isFinite(time), '实际当前时间无效'); return new Date(time).toISOString();
    };
    function read() {
      let raw;
      try { raw = storage.getItem(STORAGE_KEY); }
      catch { throw new JournalError('STORAGE_UNAVAILABLE', '无法读取本地快照；原有数据未覆盖'); }
      if (raw === null || raw === undefined) return [];
      check(typeof raw === 'string' && raw.length <= MAX_CHARS, '本地快照数据过大或损坏；原有数据未覆盖', 'CORRUPT_STORAGE');
      try {
        const payload = JSON.parse(raw);
        check(object(payload) && payload.schemaVersion === VERSION && Array.isArray(payload.snapshots) && payload.snapshots.length <= MAX_SNAPSHOTS, '本地快照结构错误');
        const rows = payload.snapshots.map(storedSnapshot);
        check(new Set(rows.map(row => row.id)).size === rows.length, '本地快照 ID 重复');
        return rows;
      } catch (error) { throw new JournalError('CORRUPT_STORAGE', '本地快照无法读取，原有内容未覆盖。请先备份站点存储。' + (error?.message || '')); }
    }
    function write(rows) {
      check(rows.length <= MAX_SNAPSHOTS, '最多保存 50 份快照，请先导出或删除不再需要的记录', 'CAPACITY');
      const payload = JSON.stringify({ schemaVersion: VERSION, snapshots: rows });
      check(payload.length <= MAX_CHARS, '快照总量过大，请先导出备份并清理记录', 'SIZE_LIMIT');
      try { storage.setItem(STORAGE_KEY, payload); }
      catch (error) { throw new JournalError(error?.name === 'QuotaExceededError' ? 'QUOTA_EXCEEDED' : 'STORAGE_UNAVAILABLE', '快照未保存：本地存储配额不足或访问被拒绝。原有记录未主动删除，请先导出备份。'); }
    }
    const api = {
      list() { return expose(read().sort((a, b) => b.createdAt.localeCompare(a.createdAt))); },
      get(snapshotId) { check(id(snapshotId), '快照 ID 无效'); const row = read().find(item => item.id === snapshotId); return row ? expose(row) : null; },
      saveSnapshot(input) {
        check(object(input), '快照内容无效');
        const createdAt = currentISO(), fixture = fixtureRecord(input.fixture);
        const cutoff = input.cutoff ? iso(input.cutoff, '数据截止时间') : createdAt;
        check(Date.parse(cutoff) <= Date.parse(createdAt), '数据截止时间不能晚于实际保存时间');
        const profiles = profileRecords(input.profiles, fixture);
        const baseline = input.baseline == null ? null : cloneJSON(input.baseline);
        const selectedHypotheses = input.selectedHypotheses || [];
        const snapshot = {
          schemaVersion: VERSION, id: 'tactical-' + Date.parse(createdAt).toString(36) + '-' + (++sequence).toString(36) + '-' + Math.random().toString(36).slice(2, 10),
          actualType: fixture.status === 'scheduled' && Date.parse(createdAt) < Date.parse(fixture.kickoff) ? 'pre-match' : 'research-retrospective',
          provenance: 'local', createdAt, cutoff, kickoff: fixture.kickoff, fixture,
          report: cloneJSON(input.report), profiles, lineups: lineupRecords(input.lineups, createdAt),
          baseline, baselineAvailable: baseline !== null,
          modelVersion: baseline?.modelVersion || baseline?.version || baseline?.prediction?.modelVersion || baseline?.prediction?.version || input.report?.modelVersion || null,
          profileRevisions: profiles.map(p => ({ teamId: p.id, revision: p.revision || p.version || ('legacy-' + (p.reviewedAt || 'undated')) })),
          selectedHypotheses: cloneJSON(selectedHypotheses), notes: optionalText(input.notes, 6000, '赛前备注'), reviews: []
        };
        const row = storedSnapshot(snapshot), rows = read(); rows.push(row); write(rows); return expose(row);
      },
      saveReview(snapshotId, review) {
        check(id(snapshotId), '快照 ID 无效');
        const rows = read(), index = rows.findIndex(row => row.id === snapshotId);
        check(index !== -1, '找不到待复盘快照', 'NOT_FOUND');
        check(rows[index].reviews.length < 30, '每份快照最多保留 30 次复盘修订', 'CAPACITY');
        const next = reviewRecord(review, rows[index], currentISO(), rows[index].reviews.length + 1);
        rows[index].reviews.push(next); rows[index] = storedSnapshot(rows[index]); write(rows); return expose(rows[index]);
      },
      remove(snapshotId) {
        check(id(snapshotId), '快照 ID 无效');
        const rows = read(), filtered = rows.filter(row => row.id !== snapshotId);
        check(rows.length !== filtered.length, '找不到待删除快照', 'NOT_FOUND'); write(filtered); return true;
      },
      exportJSON() { return JSON.stringify({ schemaVersion: VERSION, exportedAt: currentISO(), snapshots: read() }); },
      importJSON(raw) {
        check(typeof raw === 'string' && raw.length <= MAX_CHARS + 1000, '导入文件过大或格式错误', 'IMPORT_INVALID');
        let payload;
        try { payload = JSON.parse(raw); } catch { throw new JournalError('IMPORT_INVALID', '导入文件不是有效 JSON，现有记录未更改'); }
        check(object(payload) && payload.schemaVersion === VERSION && Array.isArray(payload.snapshots), '导入文件版本或结构错误', 'IMPORT_INVALID');
        check(payload.snapshots.length <= MAX_SNAPSHOTS, '导入文件超过 50 份快照', 'CAPACITY');
        const importedAt = currentISO(), existing = read(), existingIds = new Set(existing.map(row => row.id));
        const imported = payload.snapshots.map(input => {
          const candidate = cloneJSON(input);
          check(object(candidate) && ['pre-match', 'research-retrospective'].includes(candidate.actualType), '导入快照类型无效', 'IMPORT_INVALID');
          const claimedActualType = candidate.claimedActualType || candidate.actualType;
          candidate.provenance = 'imported-unverified'; candidate.actualType = 'research-retrospective';
          candidate.claimedActualType = claimedActualType; candidate.importedAt = importedAt;
          const row = storedSnapshot(candidate);
          check(!existingIds.has(row.id), '导入快照 ID 与现有或同批记录重复；为避免覆盖，未导入任何记录', 'DUPLICATE');
          existingIds.add(row.id); return row;
        });
        write(existing.concat(imported)); return expose(imported);
      }
    };
    return Object.freeze(api);
  }
  return Object.freeze({ VERSION, STORAGE_KEY, MAX_SNAPSHOTS, REVIEW_DELAY_MS, JournalError, createJournal });
});
