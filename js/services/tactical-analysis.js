/* Evidence-led editorial scenarios. This service never reads or modifies the score model. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.UclTacticalAnalysis = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const VERSION = 'tactical-analysis-1.1';
  const SIGNALS = ['high-press', 'low-block', 'direct-play', 'high-line', 'counter-attack', 'possession', 'wide-play', 'man-marking'];
  const KINDS = ['observation', 'intent', 'background', 'hypothesis'];
  // Only explicit style signals are used. A dimension, pot or legacy opponent-style example is not evidence.
  // Deliberately absent: low block != compact centre, wide play != aerial crossing,
  // high pressing != counterpressing, and direct play != a set-piece advantage.
  const RULES = [
    { id: 'possession-low', attack: ['possession'], defence: ['low-block'], title: '控球组织对低位防守', question: '组织方能否把外围控球转为禁区进入，而非仅增加低威胁射门？' },
    { id: 'build-press', attack: ['possession'], defence: ['high-press'], title: '控球出球对高位压迫', question: '接应、出球时间与压迫同步性，哪一项首先改变推进空间？' },
    { id: 'press-direct', attack: ['direct-play'], defence: ['high-press'], title: '直接出球对高位压迫', question: '长传接应和第二落点是否足以绕过首层压迫？' },
    { id: 'wide-narrow', attack: ['wide-play'], defence: ['low-block'], title: '边路进攻对低位防守', question: '低位防守是否及时横移、保护后点；不得仅凭低位标签推定防线收窄？' },
    { id: 'line-direct', attack: ['direct-play', 'counter-attack'], defence: ['high-line'], title: '纵向进攻对高位防线', question: '出球者是否有时间，跑动能否避开越位并越过门将保护？' },
    { id: 'marking-rotation', attack: ['possession'], defence: ['man-marking'], title: '控球接应对人盯人防守', question: '组织方是否实际采用换位，盯防方如何交接；控球信号本身不证明流动换位？' },
    { id: 'second-block', attack: ['direct-play'], defence: ['low-block'], title: '直接进攻对低位防守', question: '禁区外第二落点由谁保护，低位方是否实际保持紧凑？' }
  ];
  const txt = value => typeof value === 'string' ? value.trim() : '';
  const list = value => Array.isArray(value) ? value : [];
  const unique = values => [...new Set(values.filter(Boolean))];
  function day(value) {
    const string = txt(value);
    if (!/^\d{4}-\d{2}-\d{2}(?:$|T)/.test(string) || !Number.isFinite(Date.parse(string))) return null;
    const result = string.slice(0, 10);
    return new Date(result + 'T00:00:00Z').toISOString().slice(0, 10) === result ? result : null;
  }
  function safeUrl(value) {
    try { return new URL(value).protocol === 'https:' ? String(value) : ''; } catch { return ''; }
  }
  function seasonFor(asOf) {
    const year = Number(asOf.slice(0, 4)) - (asOf.slice(5, 7) < '07' ? 1 : 0);
    return year + '-' + String(year + 1).slice(-2);
  }
  function cutoff(value, asOf) {
    return txt(value).includes('T') && day(value) ? new Date(value).toISOString() : asOf + 'T23:59:59.999Z';
  }
  function afterCutoff(value, cutoffAt, asOf) {
    return day(value) && (txt(value).includes('T') ? Date.parse(value) > Date.parse(cutoffAt) : day(value) > asOf);
  }
  function teamRef(profile, fallback) {
    return { id: txt(profile?.id) || fallback, name: txt(profile?.name), zh: txt(profile?.zh) || txt(profile?.name) || '未选择球队',
      code: txt(profile?.code), logo: txt(profile?.logo), revision: txt(profile?.revision) || 'legacy-unversioned' };
  }
  function inspect(profile, ref, asOf, season, cutoffAt) {
    const available = [], rejected = [], missing = [];
    const sources = new Map(list(profile?.sources).map(source => [source.id, source]));
    for (const [index, trait] of list(profile?.traits).entries()) {
      const id = txt(trait?.id) || ref.id + ':legacy:' + (index + 1);
      const meta = trait?.evidence;
      if (!meta || !KINDS.includes(meta.kind) || !Array.isArray(meta.signals)) {
        missing.push(id); continue;
      }
      const signals = unique(meta.signals.filter(signal => SIGNALS.includes(signal)));
      if (!signals.length) { missing.push(id); continue; }
      const observedAt = day(meta.observedAt), reviewedAt = day(meta.reviewedAt), validUntil = day(meta.validUntil);
      if (afterCutoff(meta.observedAt, cutoffAt, asOf) || afterCutoff(meta.reviewedAt, cutoffAt, asOf)) {
        rejected.push({ id, reason: '观察或档案核查晚于分析截点' }); continue;
      }
      const sourceIds = unique(list(trait.sourceIds).map(txt));
      const refs = sourceIds.map(sourceId => sources.get(sourceId));
      if (!sourceIds.length || refs.some(source => !source || !safeUrl(source.url)
        || afterCutoff(source.publishedAt, cutoffAt, asOf) || afterCutoff(source.accessedAt, cutoffAt, asOf))) {
        rejected.push({ id, reason: '来源缺失、不安全或在分析截点之后才可获得' }); continue;
      }
      const limitations = [];
      if (meta.kind !== 'observation') limitations.push(meta.kind === 'intent' ? '教练意图不是球队实际执行的确认' : meta.kind === 'background' ? '背景资料不能确认当前战术执行' : '假设尚未经比赛观察验证');
      if (!observedAt) limitations.push('缺少精确观察日期，未用发布日期代替');
      if (!reviewedAt) limitations.push('缺少档案核查日期');
      if (meta.season !== season) limitations.push('资料适用赛季与本次分析不同或未明确');
      if (!validUntil) limitations.push('未设置编辑复核期限');
      else if (validUntil < asOf) limitations.push('已超过编辑复核期限，需重新核查');
      if (['historical', 'conditional', 'needs-review'].includes(meta.applicability)) limitations.push('编辑适用标记：' + meta.applicability);
      if (refs.some(source => !day(source.publishedAt))) limitations.push('部分来源缺少精确发布日期');
      if (refs.some(source => [source.publishedAt, source.accessedAt].some(value => day(value) === asOf && !txt(value).includes('T')))) {
        limitations.push('同日来源仅有日期，无法确认在具体开赛或分析时刻之前已经可得');
      }
      const current = limitations.length === 0;
      available.push({ teamId: ref.id, traitId: id, label: txt(trait.label) || '未命名观察', kind: meta.kind,
        period: txt(meta.period) || txt(profile?.evidencePeriod) || '观察期未明确', observedAt, reviewedAt, validUntil,
        season: txt(meta.season) || null, signals, current, limitations,
        sourceRefs: refs.map(source => ({ id: txt(source.id), title: txt(source.title), url: safeUrl(source.url) })) });
    }
    return { claims: available, coverage: { total: list(profile?.traits).length, usable: available.length,
      current: available.filter(claim => claim.current).length, conditional: available.filter(claim => !claim.current).length,
      excluded: rejected.length, missingMetadata: missing.length, signals: unique(available.flatMap(claim => claim.signals)),
      notice: '可用条目只是可追溯资料，不是样本量、强度评分或概率置信度。', excludedReasons: rejected } };
  }
  function normalizeLineup(value, asOf, cutoffAt) {
    const input = value || {}, supplied = ['unknown', 'expected', 'confirmed'].includes(input.status) ? input.status : 'unknown';
    const checkedAt = day(input.checkedAt) ? txt(input.checkedAt) : null, future = afterCutoff(input.checkedAt, cutoffAt, asOf);
    const source = typeof input.source === 'string' ? txt(input.source) : txt(input.source?.title) || txt(input.source?.url);
    const strings = rows => list(rows).map(row => typeof row === 'string' ? txt(row) : txt(row?.name) || txt(row?.role)).filter(Boolean);
    const status = future ? 'unknown' : supplied;
    const limitations = ['用户手动核查记录，不代表官方自动验证；不改变数值预测概率。'];
    if (status === 'unknown') limitations.push('首发与关键角色可用性尚未核实，不能虚构缺阵影响。');
    if (status === 'expected') limitations.push('预计首发可能改变，需与正式名单分开保存。');
    if (status === 'confirmed') limitations.push('“已确认”是手动记录状态，须自行核对来源、发布时间及开赛前可得性。');
    if (!checkedAt || !source) limitations.push('缺少完整核查日期或来源，不作为已证实的阵容事实。');
    if (future) limitations.push('核查时间晚于分析截点，记录已降为未知且未用于推演。');
    return { status, formation: future ? '' : txt(input.formation), players: future ? [] : strings(input.players),
      roles: future ? [] : strings(input.roles), source: future ? '' : source, checkedAt: future ? null : checkedAt,
      officiallyVerified: false, probabilityAdjustmentEnabled: false, limitations };
  }
  function evidenceFor(claim) {
    return { teamId: claim.teamId, traitId: claim.traitId, label: claim.label, kind: claim.kind, period: claim.period,
      observedAt: claim.observedAt, sourceRefs: claim.sourceRefs.map(ref => ({ ...ref })), limitations: [...claim.limitations] };
  }
  function direction(attack, defence, attackClaims, defenceClaims, framework) {
    const id = attack.id + '->' + defence.id;
    const definitions = new Map(list(framework?.mechanisms).map(mechanism => [mechanism.id, mechanism]));
    const mechanisms = [];
    for (const rule of RULES) {
      const definition = definitions.get(rule.id);
      if (!definition || list(definition.branches).length < 2) continue;
      const attackers = attackClaims.filter(claim => rule.attack.some(signal => claim.signals.includes(signal)));
      const defenders = defenceClaims.filter(claim => rule.defence.some(signal => claim.signals.includes(signal)));
      if (!attackers.length || !defenders.length) continue;
      // Select the best dated support, not the most favourable team or highest pot.
      const best = claims => [...claims].sort((a, b) => Number(b.current) - Number(a.current)
        || (b.observedAt || '').localeCompare(a.observedAt || '') || a.traitId.localeCompare(b.traitId))[0];
      const pair = [best(attackers), best(defenders)], current = pair.every(claim => claim.current);
      mechanisms.push({ id: id + ':' + rule.id, frameworkId: rule.id, title: attack.zh + '进攻 × ' + defence.zh + '防守：' + rule.title,
        status: current ? 'candidate' : 'conditional', evidence: pair.map(evidenceFor),
        conditions: ['双方资料中的球风仍适用于本场，且场上实际执行与资料一致。', rule.question,
          '需核查首发、关键角色、比赛阶段与后方保护；资料支持不等于执行优势。'],
        branches: definition.branches.map(branch => ({ condition: txt(branch.condition), form: txt(branch.form) })),
        counterEvidence: [], unknowns: ['缺少系统化的反证收录，未列出反证不代表不存在反例。',
          '尚未量化双方执行效率、机会质量及该机制发生频率。', ...(!current ? ['至少一方仅有历史、意图、背景或待复核资料；这里只是条件候选。'] : [])] });
    }
    return { id, attackTeamId: attack.id, defenceTeamId: defence.id, title: attack.zh + '进攻 → ' + defence.zh + '防守', mechanisms,
      unknowns: ['需分别观察出球接应、防守交接和关键角色，不按档位或实力推定战术。',
        ...(!mechanisms.length ? ['双方明确球风信号不足以共同支持有向机制；不自动生成主剧本。'] : [])] };
  }
  function scriptsFor(mechanisms) {
    const common = { main: ['main', '主要候选剧本（不表示最高概率）'], alternative: ['alternative', '替代剧本'], scoreChange: ['score-change', '比分变化后的条件剧本'] };
    if (!mechanisms.length) return Object.fromEntries(Object.entries(common).map(([key, [id, title]]) => [key,
      { id, title, status: 'insufficient', condition: '尚无双方证据共同支持的机制。', form: '先补充有日期的比赛观察与阵容核查，不凭空指定比赛走势。', mechanismIds: [] }]));
    const lead = mechanisms[0], status = mechanisms.every(mechanism => mechanism.status === 'candidate') ? 'candidate' : 'conditional';
    const branch = lead.branches[0], alternate = lead.branches[1];
    return {
      main: { id: 'main', title: common.main[1], status, condition: '仅在双方资料仍适用且' + branch.condition + '时成立。',
        form: branch.form + ' 这是需赛中验证的候选，不代表胜负或发生率判断。', mechanismIds: [lead.id] },
      alternative: { id: 'alternative', title: common.alternative[1], status, condition: '若首个机制的条件不成立，而' + alternate.condition + '。',
        form: alternate.form + ' 应重新核对场面，不把替代分支视为低概率事件。', mechanismIds: [lead.id] },
      scoreChange: { id: 'score-change', title: common.scoreChange[1], status: 'conditional',
        condition: '仅在一方实际取得领先或比分扳平后；不预先指定哪队进球。',
        form: '观察领先方是否收缩、落后方是否增加投入，以及原有推进与防守条件是否仍成立。若角色没有改变，不自动判定比赛更开放；红牌、换人、体能变化只作为实际发生后的另行条件。',
        mechanismIds: mechanisms.map(mechanism => mechanism.id) }
    };
  }
  function shapeFor(mechanisms, home, away) {
    const status = mechanisms.length ? 'conditional' : 'insufficient';
    const names = new Map([[home.id, home.zh], [away.id, away.zh]]);
    const sides = row => row.id.split(':')[0].split('->').map(id => names.get(id) || id);
    const previews = mechanisms.map(row => {
      const [attack, defence] = sides(row);
      const texts = {
        'possession-low': ['若'+attack+'维持组织、'+defence+'实际回到低位，可能形成阵地攻防；外围控球不证明控制危险区域。', '若转移与禁区接应有效，可能出现较好机会；若推进受阻，控球可能只增加外围尝试。'],
        'build-press': ['若'+defence+'确实前压、'+attack+'坚持后场组织，出球区会成为主要争夺位置。', '若压迫同步，夺回点可能靠近球门；若'+attack+'越过首层，局部推进空间可能突然增加。'],
        'press-direct': ['若'+attack+'采用直接出球，'+defence+'的前压可能被绕过，主动权取决于长传接应和第二落点。', '若接应与二点保护成功，直接进攻可持续；若落点失控，球权可能反复回到'+defence+'一侧。'],
        'wide-narrow': ['若'+attack+'从边路推进、'+defence+'处于低位，需观察横移、后点及弱侧保护，不能先假设防线收窄。', '若转移快于横移，边路或后点可能产生空间；传中多不证明机会质量高。'],
        'line-direct': ['若'+defence+'保持高位防线，'+attack+'的纵向出球时间与跑动路线决定身后空间能否利用。', '若出球时间和跑动配合成功，可能形成纵深推进；越位控制、回追和门将保护仍可限制威胁。'],
        'marking-rotation': ['若'+defence+'人盯人防守'+attack+'的接应，需核对盯防交接；组织方是否换位仍是待验证条件。', '换位或个人摆脱若能牵动盯防，可能释放局部空当；控球本身不证明有此效果。'],
        'second-block': ['若'+attack+'直接推进而'+defence+'回到低位，重点观察落点控制与禁区外接应，而非仅看球权比例。', '若'+attack+'持续控制第二落点，零散进攻可能转为连续施压；低位方是否紧凑仍需核查。']
      };
      return texts[row.frameworkId];
    }).filter(Boolean);
    return {
      control:{label:'场面控制',status,text:previews.length?previews.slice(0,2).map(row=>row[0]).join(' '):'缺少双方支持的对位机制，暂不判断谁主导球权或场地位置。'},
      transition:{label:'转换节奏',status,text:previews.length?previews.slice(0,2).map(row=>row[1]).join(' ')+' 这些是条件分支，不是快节奏或慢节奏的确定预测。':'转换频率、向前速度及接应条件待观察，不以球队档位代替节奏证据。'},
      chances:{label:'机会结构',status,text:'分别核查'+home.zh+'与'+away.zh+'的机会数量、质量和分配；上方机制只说明可能形成机会的路径，没有测得执行效率，不将射门数等同于高威胁。'},
      goals:{label:'进球机制',status,text:'不因上述对位直接判为大球、小球或双方进球；条件成立仍可能出现不同终结结果。数值模型保持独立，胜平负与总进球概率不变。'}
    };
  }
  function analyze(options) {
    const input = options || {}, framework = input.framework || {};
    const asOf = day(input.asOf) || day(framework.reviewedAt) || new Date().toISOString().slice(0, 10);
    const cutoffAt = cutoff(input.asOf, asOf);
    const season = /^\d{4}-\d{2}$/.test(txt(input.fixture?.season)) ? input.fixture.season : seasonFor(asOf);
    const home = teamRef(input.home, 'home-unknown'), away = teamRef(input.away, 'away-unknown');
    if (home.id === away.id) throw new Error('双向对位需要两支不同球队');
    const homeData = inspect(input.home, home, asOf, season, cutoffAt), awayData = inspect(input.away, away, asOf, season, cutoffAt);
    const directions = [direction(home, away, homeData.claims, awayData.claims, framework), direction(away, home, awayData.claims, homeData.claims, framework)];
    // Round-robin limits the complete report to four mechanisms without erasing a supported reverse direction.
    const selected = [], cursors = [0, 0];
    while (selected.length < 4) {
      let added = false;
      for (let i = 0; i < 2 && selected.length < 4; i++) {
        if (cursors[i] < directions[i].mechanisms.length) { selected.push(directions[i].mechanisms[cursors[i]++]); added = true; }
      }
      if (!added) break;
    }
    for (const item of directions) item.mechanisms = item.mechanisms.filter(mechanism => selected.includes(mechanism));
    const shape = shapeFor(selected, home, away);
    const lineups = { home: normalizeLineup(input.lineups?.home, asOf, cutoffAt), away: normalizeLineup(input.lineups?.away, asOf, cutoffAt),
      notice: '预计与确认首发独立保存；人工记录不自动成为官方验证事实，阵容情景不参与概率计算。' };
    const unknowns = unique([...list(input.home?.uncertainties), ...list(input.away?.uncertainties),
      '战术意图、执行能力与实际表现尚未建立量化对应关系。', '未取得可比的全场事件或机会质量数据，不能声明战术相克必然导致某一胜负。',
      ...(!input.home || !input.away ? ['至少一支球队档案缺失。'] : []),
      ...(homeData.coverage.missingMetadata || awayData.coverage.missingMetadata ? ['部分条目缺少明确球风信号或证据元数据，未用于匹配。'] : []),
      ...(homeData.coverage.excluded || awayData.coverage.excluded ? ['已排除截点后才可获得或来源不完整的资料；不能用于伪造历史赛前快照。'] : []),
      ...(lineups.home.status === 'unknown' || lineups.away.status === 'unknown' ? ['至少一方首发和关键角色尚未核实。'] : [])].map(txt));
    return { version: VERSION, asOf, cutoffAt, season, fixture: { id: txt(input.fixture?.id), date: txt(input.fixture?.date), season,
      homeId: home.id, awayId: away.id }, teamRefs: { home, away }, probabilityAdjustmentEnabled: false, directions, shape,
      scripts: scriptsFor(selected), coverage: { home: homeData.coverage, away: awayData.coverage,
        notice: '机制要求双方明确、可追溯信号共同支持；历史与意图资料只能生成条件候选。所有脚本均不是胜负判断。' }, lineups, unknowns };
  }
  return { VERSION, analyze, rules: RULES.map(rule => ({ id: rule.id, attack: [...rule.attack], defence: [...rule.defence] })) };
});
