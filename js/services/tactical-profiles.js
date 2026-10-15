/* Editorial research only: deliberately separate from the numerical score model. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.UclTacticalProfiles = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const VERSION = 'tactical-dossiers-1.0';
  const EVIDENCE_REVISION = '1.1';
  const EVIDENCE_KINDS = Object.freeze(['observation', 'intent', 'background', 'hypothesis']);
  const SIGNALS = Object.freeze(['possession', 'high-press', 'low-block', 'direct-play', 'high-line', 'counter-attack', 'wide-play', 'man-marking']);
  const validDay = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
    && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
  const text = value => typeof value === 'string' && value.trim().length > 0;
  const assert = (condition, message) => { if (!condition) throw new Error(message); };
  const https = value => { try { return new URL(value).protocol === 'https:'; } catch { return false; } };
  function deepFreeze(value) {
    if (value && typeof value === 'object' && !Object.isFrozen(value)) {
      Object.values(value).forEach(deepFreeze); Object.freeze(value);
    }
    return value;
  }
  function normalizeLegacy(entry, team, reviewedAt) {
    if (entry.revision !== undefined) return entry;
    // Old files remain readable, but absence of reviewed metadata never yields
    // an inferred style signal or a newly current observation.
    return { ...entry, revision: EVIDENCE_REVISION,
      sourcePolicy: { version: EVIDENCE_REVISION, currentSeason: '2026-27', currentApplicability: 'conservative',
        publicationIsNotObservation: true, expiryIsEditorialPolicy: true,
        reviewedAtMeaning: '旧格式兼容转换日；未重新核查足球事实。',
        observedAtMeaning: '旧档案没有逐条观察日期，不使用发表日代替。',
        expiryMeaning: '缺少已审核时效元数据，保留未知并要求复核。',
        currentSeasonVerifiedMeaning: '仅保留旧档案背景标记，不代表逐条验证。',
        validityDays: { observation: 120, intent: 60, background: 180, hypothesis: 30 } },
      changeLog: [{ revision: EVIDENCE_REVISION, date: reviewedAt, type: 'legacy-normalization', summary: '兼容旧档案；所有未分类条目仅作背景，不自动推断球风信号。' }],
      traits: (entry.traits || []).map((trait, index) => ({ ...trait, id: team.id + ':claim:' + (index + 1),
        evidence: { kind: 'background', observedAt: null, period: entry.evidencePeriod, reviewedAt,
          validUntil: null, season: null, signals: [], applicability: 'needs-review', expiryBasis: 'unknown' } })) };
  }
  function createCatalog(roster, shards, framework) {
    assert(Array.isArray(roster) && roster.length === 36, '球队目录必须恰好包含36队');
    assert(framework?.version === VERSION && framework.probabilityAdjustmentEnabled === false, '战术资料版本或模型隔离设置不正确');
    assert(validDay(framework.reviewedAt), '档案核查日期无效');
    assert(Array.isArray(shards) && shards.every(Array.isArray), '球队资料分片格式错误');
    const dimensions = new Set(framework.dimensions.map(row => row.id));
    const styles = new Set(framework.styles.map(row => row.id));
    const names = new Map(roster.map(row => [row.name, row]));
    assert(names.size === 36 && new Set(roster.map(row => row.id)).size === 36, '球队唯一身份重复');
    const entries = shards.flat();
    assert(entries.length === 36 && new Set(entries.map(row => row.name)).size === 36, '球风档案必须一队一份，不能重复或遗漏');
    const byName = new Map(), byId = new Map(), claimIds = new Set();
    for (const original of entries) {
      const team = names.get(original.name);
      assert(team, '档案球队不在当前目录：' + original.name);
      const entry = normalizeLegacy(original, team, framework.reviewedAt);
      assert(entry.revision === EVIDENCE_REVISION, entry.name + ' 证据修订版本无效');
      const policy = entry.sourcePolicy;
      assert(policy?.version === EVIDENCE_REVISION && policy.publicationIsNotObservation === true && policy.expiryIsEditorialPolicy === true
        && policy.currentApplicability === 'conservative' && /^\d{4}-\d{2}$/.test(policy.currentSeason)
        && ['reviewedAtMeaning', 'observedAtMeaning', 'expiryMeaning', 'currentSeasonVerifiedMeaning'].every(key => text(policy[key]))
        && EVIDENCE_KINDS.every(kind => Number.isInteger(policy.validityDays?.[kind]) && policy.validityDays[kind] > 0 && policy.validityDays[kind] <= 365), entry.name + ' 缺少证据日期与编辑复核政策');
      assert(Array.isArray(entry.changeLog) && entry.changeLog.length > 0 && entry.changeLog.every(row => text(row.revision) && validDay(row.date)
        && row.date <= framework.reviewedAt && text(row.type) && text(row.summary)), entry.name + ' 版本变更记录无效');
      for (const field of ['evidencePeriod', 'coachContext', 'summary']) assert(text(entry[field]), entry.name + ' 缺少 ' + field);
      assert(typeof entry.currentSeasonVerified === 'boolean', entry.name + ' 缺少资料适用期标记');
      assert(Array.isArray(entry.sources) && entry.sources.length > 0, entry.name + ' 缺少逐队来源');
      const sourceIds = new Set();
      for (const source of entry.sources) {
        assert(text(source.id) && !sourceIds.has(source.id) && text(source.title) && https(source.url), entry.name + ' 来源不完整或地址不安全');
        assert(validDay(source.accessedAt) && source.accessedAt <= framework.reviewedAt, entry.name + ' 来源访问日期无效');
        assert(source.publishedAt === null || (validDay(source.publishedAt) && source.publishedAt <= framework.reviewedAt), entry.name + ' 来源发布日期无效');
        sourceIds.add(source.id);
      }
      assert(Array.isArray(entry.traits), entry.name + ' 观察条目格式错误');
      for (const trait of entry.traits) {
        assert(dimensions.has(trait.dimension) && text(trait.label) && text(trait.detail), entry.name + ' 球风观察格式错误');
        assert(Array.isArray(trait.sourceIds) && trait.sourceIds.length > 0 && trait.sourceIds.every(id => sourceIds.has(id)), entry.name + ' 观察未关联有效来源');
        assert(text(trait.id) && trait.id.startsWith(team.id + ':claim:') && !claimIds.has(trait.id), entry.name + ' 证据条目标识重复或无效');
        claimIds.add(trait.id);
        const evidence = trait.evidence;
        assert(evidence && EVIDENCE_KINDS.includes(evidence.kind) && text(evidence.period), entry.name + ' 证据类型或观察期无效');
        assert(validDay(evidence.reviewedAt) && evidence.reviewedAt <= framework.reviewedAt
          && (evidence.observedAt === null || (validDay(evidence.observedAt) && evidence.observedAt <= evidence.reviewedAt)), entry.name + ' 证据观察或核查日期无效');
        assert(evidence.validUntil === null || validDay(evidence.validUntil), entry.name + ' 编辑复核期限无效');
        assert(evidence.season === null || (typeof evidence.season === 'string' && /^\d{4}-\d{2}$/.test(evidence.season)
          && String((Number(evidence.season.slice(0, 4)) + 1) % 100).padStart(2, '0') === evidence.season.slice(5)), entry.name + ' 证据赛季无效');
        assert(Array.isArray(evidence.signals) && new Set(evidence.signals).size === evidence.signals.length
          && evidence.signals.every(signal => SIGNALS.includes(signal) && styles.has(signal)), entry.name + ' 证据球风信号无效');
        assert(['historical', 'conditional', 'needs-review', 'current-window'].includes(evidence.applicability), entry.name + ' 证据适用性无效');
        assert(['observation-date', 'source-publication', 'unknown'].includes(evidence.expiryBasis), entry.name + ' 证据期限依据无效');
        const linkedSources = entry.sources.filter(source => trait.sourceIds.includes(source.id));
        assert(linkedSources.every(source => source.accessedAt <= evidence.reviewedAt
          && (source.publishedAt === null || source.publishedAt <= evidence.reviewedAt)), entry.name + ' 证据核查日期早于关联来源日期');
        const anchor = evidence.expiryBasis === 'observation-date' ? evidence.observedAt
          : evidence.expiryBasis === 'source-publication' ? linkedSources.map(source => source.publishedAt).filter(Boolean).sort().at(-1) : null;
        if (evidence.expiryBasis === 'unknown') assert(evidence.validUntil === null, entry.name + ' 未知依据不能生成复核期限');
        else {
          assert(validDay(anchor), entry.name + ' 证据期限依据缺少明确日期');
          const expectedExpiry = new Date(Date.parse(anchor + 'T00:00:00Z') + policy.validityDays[evidence.kind] * 86400000).toISOString().slice(0, 10);
          assert(evidence.validUntil === expectedExpiry, entry.name + ' 编辑复核期限与政策不一致');
        }
        if (evidence.applicability === 'current-window') assert(evidence.kind === 'observation' && evidence.season === policy.currentSeason
          && evidence.observedAt !== null && evidence.validUntil !== null && evidence.validUntil >= evidence.reviewedAt, entry.name + ' 旧资料或未知观察不能标为本季有效窗口');
        if (evidence.season && evidence.season !== policy.currentSeason) assert(evidence.applicability === 'historical', entry.name + ' 历史赛季不能冒充当前证据');
      }
      assert(text(entry.personnel?.status) && Array.isArray(entry.personnel.watchRoles), entry.name + ' 缺少人员核对边界');
      assert(entry.personnel.watchRoles.every(text), entry.name + ' 人员核对角色无效');
      assert(entry.personnel.observedPlayers === undefined || Array.isArray(entry.personnel.observedPlayers), entry.name + ' 人员观察格式无效');
      for (const player of entry.personnel.observedPlayers || []) {
        assert(text(player.name) && text(player.role) && text(player.period), entry.name + ' 人员观察缺少时间或作用');
        assert(Array.isArray(player.sourceIds) && player.sourceIds.length > 0 && player.sourceIds.every(id => sourceIds.has(id)), entry.name + ' 人员观察未关联来源');
      }
      assert(Array.isArray(entry.uncertainties) && entry.uncertainties.length >= 2, entry.name + ' 缺少不确定性说明');
      assert(Array.isArray(entry.matchups) && entry.matchups.length >= 2, entry.name + ' 缺少多分支对位推演');
      for (const matchup of entry.matchups) {
        assert(styles.has(matchup.opponentStyle) && text(matchup.mechanism), entry.name + ' 对位类型无效');
        assert(Array.isArray(matchup.branches) && matchup.branches.length >= 2 && matchup.branches.every(branch => text(branch.condition) && text(branch.form)), entry.name + ' 对位必须保留条件与多条比赛形态分支');
      }
      const profile = deepFreeze({ ...entry, id: team.id, zh: team.zh, code: team.code, logo: team.logo, pot: team.pot,
        coverage: entry.traits.length < 3 ? 'limited' : entry.currentSeasonVerified ? 'season-observation' : 'historical',
        reviewedAt: framework.reviewedAt, probabilityAdjustmentEnabled: false });
      byName.set(entry.name, profile); byId.set(team.id, profile);
    }
    return Object.freeze({ version: VERSION, evidenceRevision: EVIDENCE_REVISION, framework: deepFreeze(framework), probabilityAdjustmentEnabled: false,
      all: () => roster.map(team => byName.get(team.name)), get: value => byName.get(value) || byId.get(value) || null });
  }
  return { VERSION, EVIDENCE_REVISION, EVIDENCE_KINDS, SIGNALS, createCatalog, validDay };
});
