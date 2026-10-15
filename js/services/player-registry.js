/* Player identity and pre-match evidence only; never modifies prediction probabilities. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.UclPlayerRegistry = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const VERSION = 'player-registry-1.0';
  const ROLES = Object.freeze(['GK', 'CB', 'FB', 'WB', 'DM', 'CM', 'AM', 'W', 'ST', 'DF', 'MF', 'FW', 'unknown']);
  const SOURCE_KINDS = Object.freeze(['historical-editorial', 'identity', 'registration', 'eligibility', 'injury', 'suspension', 'lineup']);
  const text = value => typeof value === 'string' && value.trim().length > 0;
  const assert = (condition, message) => { if (!condition) throw new Error(message); };
  const clone = value => JSON.parse(JSON.stringify(value));
  function freeze(value) { if (value && typeof value === 'object' && !Object.isFrozen(value)) { Object.values(value).forEach(freeze); Object.freeze(value); } return value; }
  function time(value, endOfDay = false) {
    if (!text(value)) return NaN;
    const day = value.slice(0, 10), midnight = Date.parse(day + 'T00:00:00Z');
    if (!Number.isFinite(midnight) || new Date(midnight).toISOString().slice(0, 10) !== day) return NaN;
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return midnight + (endOfDay ? 86399999 : 0);
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(value)) return NaN;
    return Date.parse(value);
  }
  const validTime = value => Number.isFinite(time(value));
  const nullableTime = value => value === null || validTime(value);
  const seasonValid = value => /^\d{4}-\d{2}$/.test(value || '') && ((Number(value.slice(0, 4)) + 1) % 100) === Number(value.slice(5));
  const normalized = value => String(value || '').trim().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
  const safeUrl = value => { try { return new URL(value).protocol === 'https:'; } catch { return false; } };
  const recordKnown = (record, asOf) => ['publishedAt', 'observedAt', 'retrievedAt'].every(key => validTime(record[key]) && time(record[key], true) <= time(asOf, true));
  function validateTemporal(record, label) {
    for (const key of ['publishedAt', 'observedAt']) assert(nullableTime(record[key]), label + ': ' + key + '必须为带时区时间、日期或null');
    assert(validTime(record.retrievedAt), label + ': retrievedAt无效');
    if (record.publishedAt !== null) assert(time(record.publishedAt) <= time(record.retrievedAt, true), label + ': 发表时间晚于获取时间');
    if (record.observedAt !== null) assert(time(record.observedAt) <= time(record.retrievedAt, true), label + ': 观察时间晚于获取时间');
  }
  function createRegistry(original) {
    assert(original && original.schemaVersion === VERSION, '球员身份数据库版本无效');
    assert(original.probabilityAdjustmentEnabled === false, '球员库不得直接启用概率修正');
    const data = clone(original);
    assert(validTime(data.generatedAt), '球员库生成日期无效');
    for (const key of ['clubs', 'sources', 'players', 'memberships', 'observations', 'eligibility', 'availability']) assert(Array.isArray(data[key]), '球员库缺少数组：' + key);
    assert(data.scope && data.scope.clubCount === data.clubs.length && seasonValid(data.scope.season), '球员库覆盖元数据无效');
    const clubs = new Map(), sources = new Map(), players = new Map(), ids = new Set();
    for (const club of data.clubs) { assert(text(club.id) && text(club.name) && text(club.zh) && !clubs.has(club.id), '球队身份无效或重复'); clubs.set(club.id, club); }
    for (const source of data.sources) {
      assert(text(source.id) && !sources.has(source.id) && text(source.title) && safeUrl(source.url) && SOURCE_KINDS.includes(source.kind), '球员来源无效或重复');
      validateTemporal(source, '来源 ' + source.id);
      if (source.kind === 'lineup') assert(text(source.matchId) && clubs.has(source.teamId), '阵容来源必须明确比赛与球队作用域');
      sources.set(source.id, source);
    }
    const externalIds = new Set();
    for (const player of data.players) {
      assert(text(player.id) && /^player-[a-z0-9-]+$/.test(player.id) && !players.has(player.id) && text(player.displayName), '球员身份无效或重复');
      assert(Array.isArray(player.aliases) && player.aliases.every(text) && new Set(player.aliases.map(normalized)).size === player.aliases.length, player.id + ': 别名无效');
      assert(player.birthDate === null || (/^\d{4}-\d{2}-\d{2}$/.test(player.birthDate) && validTime(player.birthDate)), player.id + ': 出生日期须核查或为null');
      assert(['research-seed', 'verified', 'needs-review'].includes(player.identityStatus), player.id + ': 身份审核状态无效');
      assert(Array.isArray(player.externalIds), player.id + ': externalIds必须为数组');
      if (player.identityStatus === 'verified') assert(Array.isArray(player.identitySourceIds) && player.identitySourceIds.length > 0 && player.identitySourceIds.every(id => sources.get(id)?.kind === 'identity'), player.id + ': 已核查身份必须有identity类型来源');
      for (const entry of player.externalIds) {
        const key = entry.provider + ':' + entry.id;
        assert(text(entry.provider) && text(entry.id) && !externalIds.has(key) && Array.isArray(entry.sourceIds) && entry.sourceIds.length > 0 && entry.sourceIds.every(id => sources.has(id)), player.id + ': 外部身份重复或缺少出处'); externalIds.add(key);
      }
      players.set(player.id, player);
    }
    function link(record, label) {
      assert(text(record.id) && !ids.has(record.id) && players.has(record.playerId) && clubs.has(record.teamId), label + ': 记录身份或球员/球队引用无效'); ids.add(record.id);
      assert(Array.isArray(record.sourceIds) && record.sourceIds.length > 0 && record.sourceIds.every(id => sources.has(id)), label + ': 缺少有效来源');
    }
    function period(row, label) {
      assert(validTime(row.validFrom) && nullableTime(row.validUntil) && (row.validUntil === null || time(row.validUntil, true) >= time(row.validFrom)), label + ': 有效期无效');
    }
    for (const row of data.observations) { link(row, '历史观察'); assert(text(row.period) && text(row.role) && nullableTime(row.observedAt), '历史观察须保留观察期、角色与未知日期'); }
    for (const row of data.memberships) {
      link(row, '注册记录'); validateTemporal(row, '注册记录'); period(row, '注册记录');
      assert(seasonValid(row.season) && row.status === 'registered' && row.sourceIds.every(id => ['registration', 'identity'].includes(sources.get(id).kind)), '注册记录不能从历史人员观察推定');
    }
    for (const row of data.eligibility) {
      link(row, '报名资格'); validateTemporal(row, '报名资格'); period(row, '报名资格');
      assert(text(row.competitionId) && seasonValid(row.season) && ['eligible', 'ineligible', 'unknown'].includes(row.status), '赛事报名资格无效');
      assert(row.sourceIds.every(id => sources.get(id).kind === 'eligibility'), '赛事报名资格须单独来源，不以联赛停赛推定');
    }
    for (const row of data.availability) {
      link(row, '可用性'); validateTemporal(row, '可用性'); period(row, '可用性');
      assert(['injury', 'suspension'].includes(row.kind) && ['available', 'unavailable', 'doubtful', 'unknown'].includes(row.status), '伤停记录类型无效');
      assert(text(row.competitionId) && (row.kind !== 'suspension' || row.competitionId !== '*'), '停赛必须明确赛事，跨赛事不得自动套用');
      assert(row.sourceIds.every(id => sources.get(id).kind === row.kind), '伤停记录与来源类型不符');
    }
    freeze(data);
    function known(row, asOf) { return validTime(asOf) && recordKnown(row, asOf) && row.sourceIds.every(id => recordKnown(sources.get(id), asOf)); }
    const active = (row, asOf) => time(row.validFrom) <= time(asOf, true) && (row.validUntil === null || time(row.validUntil, true) >= time(asOf));
    function roster(teamId, options = {}) {
      if (!validTime(options.asOf) || !seasonValid(options.season)) return [];
      const rows=data.memberships.filter(row => row.teamId === teamId && row.season === options.season && known(row, options.asOf) && active(row, options.asOf)).filter(row => !data.memberships.some(other => other.playerId === row.playerId && other.teamId !== teamId && other.season === row.season && known(other, options.asOf) && active(other, options.asOf)));
      const unique=new Map();for(const row of rows)unique.set(row.playerId,freeze({...players.get(row.playerId),membership:row}));
      return [...unique.values()];
    }
    function membershipStatus(playerId, teamId, options = {}) {
      if (!validTime(options.asOf) || !seasonValid(options.season)) return 'unknown';
      const rows = data.memberships.filter(row => row.playerId === playerId && row.season === options.season && known(row, options.asOf) && active(row, options.effectiveAt || options.asOf));
      const teams = new Set(rows.map(row => row.teamId));
      if (teams.size > 1) return 'conflict';
      return teams.has(teamId) ? 'verified' : teams.size ? 'different-team' : 'unknown';
    }
    function eligibilityStatus(playerId, teamId, options = {}) {
      const rows = data.eligibility.filter(row => row.playerId === playerId && row.teamId === teamId && row.competitionId === options.competitionId && row.season === options.season && known(row, options.asOf) && active(row, options.effectiveAt || options.asOf));
      const statuses = new Set(rows.map(row => row.status));
      return statuses.size > 1 ? 'conflict' : statuses.values().next().value || 'unknown';
    }
    function availabilityStatus(playerId, teamId, options = {}) {
      return data.availability.filter(row => row.playerId === playerId && row.teamId === teamId && (row.competitionId === options.competitionId || (row.kind === 'injury' && row.competitionId === '*')) && known(row, options.asOf) && active(row, options.effectiveAt || options.asOf));
    }
    function resolve(name, context = {}) {
      let candidates = data.players.filter(player => [player.displayName, ...player.aliases].some(alias => normalized(alias) === normalized(name)));
      if (context.teamId && validTime(context.asOf) && seasonValid(context.season)) {
        const registered = new Set(roster(context.teamId, context).map(player => player.id));
        const matches = candidates.filter(player => registered.has(player.id));
        if (matches.length) candidates = matches;
      }
      if (candidates.length === 1) return freeze({ status: 'resolved', player: candidates[0], candidates, reason: '名称唯一匹配研究身份，不代表已核查当前注册或报名资格。' });
      return freeze({ status: candidates.length ? 'ambiguous' : 'unresolved', player: null, candidates, reason: candidates.length ? '同名或别名冲突，须人工核对，不自动合并。' : '没有身份匹配，不自动新建或模糊合并。' });
    }
    return Object.freeze({ data, all: () => data.players, get: id => players.get(id) || null, source: id => sources.get(id) || null,
      clubs: () => data.clubs, resolve, roster, membershipStatus, eligibilityStatus, availabilityStatus,
      historicalObservations: teamId => data.observations.filter(row => row.teamId === teamId).map(row => freeze({ ...row, player: players.get(row.playerId) })),
      coverage: () => data.clubs.map(club => freeze({ ...club, historicalPlayers: new Set(data.observations.filter(row => row.teamId === club.id).map(row => row.playerId)).size,
        registrations: data.memberships.filter(row => row.teamId === club.id).length, eligibilityRecords: data.eligibility.filter(row => row.teamId === club.id).length,
        availabilityRecords: data.availability.filter(row => row.teamId === club.id).length })) });
  }
  function validateLineup(input, options = {}) {
    const errors = [], warnings = [], registry = options.registry;
    const fail = message => errors.push(message);
    if (!input || typeof input !== 'object' || Array.isArray(input)) return { valid: false, errors: ['阵容输入必须为对象'], warnings, snapshot: null };
    const asOf = options.asOf || input.asOf || options.now || new Date().toISOString();
    const createdAt = options.now || new Date().toISOString();
    if (!registry?.get || !registry?.source) fail('缺少已验证的球员身份数据库');
    if (!validTime(asOf) || !validTime(createdAt)) fail('预测截止时间或创建时间无效');
    if (validTime(asOf) && validTime(createdAt) && time(asOf, true) > time(createdAt, true)) fail('预测截止时间不能晚于创建时间');
    if (!text(input.matchId) || !text(input.teamId) || !text(input.competitionId) || !seasonValid(input.season)) fail('必须明确比赛、球队、赛事与赛季');
    if (!registry?.clubs?.().some(club => club.id === input.teamId)) fail('球队不在唯一身份目录');
    if (!validTime(input.kickoff) || /^\d{4}-\d{2}-\d{2}$/.test(input.kickoff || '')) fail('开球时间必须精确到秒并带时区');
    if (validTime(input.kickoff) && validTime(asOf) && time(asOf, true) >= time(input.kickoff)) fail('预测截止须早于开球，不能用赛后信息冒充赛前阵容');
    if (!['unknown', 'expected', 'confirmed'].includes(input.status)) fail('阵容状态必须为unknown、expected或confirmed');
    if (typeof input.partial !== 'boolean') fail('必须显式标记partial，不完整阵容不能伪装完整');
    const forbidden = new Set(['actualMinutes', 'minutesPlayed', 'actualSubstitutionMinute', 'actualStarting', 'actualLineup', 'result', 'score', 'minutes']);
    function rejectActual(value, prefix) {
      if (!value || typeof value !== 'object') return;
      for (const [key, child] of Object.entries(value)) { if (forbidden.has(key)) fail(prefix + key + '为赛后或含混字段，不允许作为赛前输入'); else rejectActual(child, prefix + key + '.'); }
    }
    rejectActual(input, '');
    if (!Array.isArray(input.sourceReferences)) fail('sourceReferences必须为数组');
    const sourceIds = new Set(); let evidenceKnown = true, actualLineupEvidence = false;
    for (const reference of Array.isArray(input.sourceReferences) ? input.sourceReferences : []) {
      if (!reference || typeof reference !== 'object') { fail('阵容来源格式无效'); continue; }
      const source = registry?.source(reference.sourceId);
      if (!source || sourceIds.has(reference.sourceId)) { fail('阵容来源未知或重复：' + reference.sourceId); continue; }
      sourceIds.add(reference.sourceId);
      try { validateTemporal(reference, '阵容来源'); } catch (error) { fail(error.message); evidenceKnown = false; continue; }
      if (!recordKnown(reference, asOf) || !recordKnown(source, asOf)) evidenceKnown = false;
      for (const key of ['publishedAt', 'observedAt', 'retrievedAt']) {
        if (source[key] !== null && reference[key] !== null && time(reference[key], true) < time(source[key])) fail('来源不得将' + key + '回拨到原来源之前');
        if (source[key] === null && reference[key] !== null) fail('原来源未知的' + key + '不能自行补成已知');
      }
      if (['publishedAt', 'observedAt', 'retrievedAt'].some(key => reference[key] !== null && validTime(reference[key]) && time(reference[key], true) > time(asOf, true))) fail('阵容含有预测截止之后才出现或取得的来源');
      if (source.kind === 'lineup') {
        if (source.matchId !== input.matchId || source.teamId !== input.teamId) fail('本场阵容来源的比赛或球队不匹配');
        else actualLineupEvidence = true;
      } else warnings.push('来源 ' + source.id + ' 不是本场阵容证据，不能确认首发。');
    }
    if (!sourceIds.size) { evidenceKnown = false; warnings.push('没有本场来源，仅保存手工情景，不可训练或验证预测。'); }
    if (!evidenceKnown) warnings.push('来源日期未知或预测时不可知，不可用于历史预测训练。');
    if (!actualLineupEvidence) warnings.push('尚无本场lineup类型来源，历史球员观察不能确认本场阵容。');
    if (!Array.isArray(input.players)) fail('players必须为数组');
    const selected = [], seen = new Set();
    for (const selection of Array.isArray(input.players) ? input.players : []) {
      if (!selection || typeof selection !== 'object') { fail('球员选择格式无效'); continue; }
      const player = registry?.get(selection.playerId);
      if (!player || seen.has(selection.playerId)) { fail('阵容球员未知或重复：' + selection.playerId); continue; }
      seen.add(selection.playerId);
      if (!ROLES.includes(selection.role) || typeof selection.starter !== 'boolean') fail(player.displayName + ' 缺少合法角色或首发/替补标识');
      if (selection.expectedMinutes !== null && !(typeof selection.expectedMinutes === 'number' && Number.isFinite(selection.expectedMinutes) && selection.expectedMinutes >= 0 && selection.expectedMinutes <= 90)) fail(player.displayName + ' 预计分钟须为null或0–90');
      const context = { asOf, effectiveAt: input.kickoff, season: input.season, competitionId: input.competitionId };
      const membershipStatus = registry?.membershipStatus(selection.playerId, input.teamId, context) || 'unknown';
      const eligibilityStatus = registry?.eligibilityStatus(selection.playerId, input.teamId, context) || 'unknown';
      const availability = registry?.availabilityStatus(selection.playerId, input.teamId, context) || [];
      if (membershipStatus !== 'verified') warnings.push(player.displayName + ' 注册状态：' + membershipStatus + '，不自动视为本队。');
      if (eligibilityStatus !== 'eligible') warnings.push(player.displayName + ' 本赛事报名资格：' + eligibilityStatus + '。');
      if (availability.some(row => row.status !== 'available')) warnings.push(player.displayName + ' 有伤停或可用性待核查记录。');
      selected.push({ ...clone(selection), player, membershipStatus, eligibilityStatus, availability });
    }
    const starters = selected.filter(row => row.starter), keepers = starters.filter(row => row.role === 'GK');
    if (starters.length > 11) fail('首发人数不能超过11人');
    if (keepers.length > 1) fail('首发门将不能超过1人');
    if (selected.reduce((sum, row) => sum + (Number.isFinite(row.expectedMinutes) ? row.expectedMinutes : 0), 0) > 990) fail('单个完整阵容情景的预计出场总分钟不能超过常规时间11×90');
    if (['expected', 'confirmed'].includes(input.status) && input.partial === false) {
      if (starters.length !== 11 || keepers.length !== 1) fail('完整预计/确认阵容须恰好11名首发且1名门将');
      if (starters.some(row => row.role === 'unknown')) fail('完整阵容不能保留未知首发角色');
    }
    if (input.partial === true) warnings.push('partial不完整阵容：仅作情景记录，不可训练。');
    if (input.status === 'confirmed' && (!actualLineupEvidence || !evidenceKnown)) warnings.push('确认仅为录入声明，缺少完整时序的本场证据，不构成已验证确认。');
    if (errors.length) return { valid: false, errors, warnings: [...new Set(warnings)], snapshot: null };
    const registrationVerified = selected.length > 0 && selected.every(row => row.membershipStatus === 'verified' && row.eligibilityStatus === 'eligible');
    const trainingEligible = input.status === 'confirmed' && input.partial === false && starters.length === 11 && actualLineupEvidence && evidenceKnown && registrationVerified && selected.every(row => row.player.identityStatus === 'verified' && row.availability.every(record => record.status === 'available'));
    const snapshot = freeze({ ...clone(input), id: input.id || 'lineup:' + input.matchId + ':' + input.teamId + ':' + asOf,
      schemaVersion: VERSION, asOf, createdAt, selected, sourceReferences: clone(input.sourceReferences), warnings: [...new Set(warnings)],
      evidenceStatus: actualLineupEvidence && evidenceKnown ? 'time-verified-source' : 'unverified', trainingEligible,
      probabilityAdjustmentEnabled: false, modelUse: 'evidence-storage-only' });
    return { valid: true, errors, warnings: snapshot.warnings, snapshot };
  }
  function buildLineupSnapshot(input, options) {
    const result = validateLineup(input, options);
    if (!result.valid) throw new Error(result.errors.join('；'));
    return result.snapshot;
  }
  return Object.freeze({ VERSION, ROLES, SOURCE_KINDS, validTime, createRegistry, validateLineup, buildLineupSnapshot });
});
