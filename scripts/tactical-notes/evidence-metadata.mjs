/*
 * Editorial migration of the existing 85 claims; no new football facts are added.
 * Every row is manually matched to its original label. Signals describe only the
 * cited claim, never a permanent club identity or a measured execution strength.
 */
export const REVISION = '1.1';
export const CURRENT_SEASON = '2026-27';
export const SOURCE_POLICY = Object.freeze({
  version: REVISION,
  currentSeason: CURRENT_SEASON,
  currentApplicability: 'conservative',
  reviewedAtMeaning: '元数据分类与编辑边界核查日；本次迁移未重新访问来源或重新验证球队事实。',
  publicationIsNotObservation: true,
  observedAtMeaning: '仅填写初版笔记或来源标题中已明确的比赛或观察日期；不以文章发表日期代替比赛日期。',
  expiryIsEditorialPolicy: true,
  expiryMeaning: 'validUntil仅为编辑复核期限，不证明球队打法在此之前持续有效；不因迁移或阅读行为续期。',
  validityDays: { observation: 120, intent: 60, background: 180, hypothesis: 30 },
  currentSeasonVerifiedMeaning: '旧字段仅表示档案包含部分本季资料，不代表每条战术观察或比赛当天阵容已经验证。'
});

// [original label, evidence kind, season, explicit observation date, approved signals, optional period]
export const CLAIM_METADATA = {
  'Paris Saint-Germain': [
    ['前场协同压迫', 'observation', '2024-25', null, ['high-press']],
    ['跑动与位置流动', 'observation', '2024-25', null, []],
    ['丢球后继续施压', 'observation', '2024-25', null, []]
  ],
  'Bayern Munich': [
    ['进攻时保留后方结构', 'observation', '2025-26', null, []],
    ['流动进攻', 'observation', '2025-26', null, []],
    ['有结构地控制推进', 'observation', '2025-26', null, []]
  ],
  'Real Madrid': [
    ['紧凑中位保护', 'observation', '2024-25', null, []],
    ['选择压迫时机', 'observation', '2024-25', null, []],
    ['接脚下与跑身后结合', 'observation', '2024-25', null, []]
  ],
  'Liverpool': [
    ['多人协同高压', 'observation', '2025-26', null, ['high-press']],
    ['争夺丢球后的球权', 'observation', '2025-26', null, []],
    ['可回到较低防守位置', 'observation', '2025-26', null, ['low-block']]
  ],
  'Internazionale': [
    ['先找前场双支点', 'observation', '2025-26', null, ['direct-play']],
    ['一人回接、一人威胁身后', 'observation', '2025-26', null, []]
  ],
  'Manchester City': [
    ['围绕低位防线循环控球', 'observation', '2023-24', null, ['possession']],
    ['边路传中进入禁区', 'observation', '2023-24', null, ['wide-play']]
  ],
  'Arsenal': [
    ['高压与不同防守阶段切换', 'observation', '2025-26', null, ['high-press', 'low-block']],
    ['中卫面对双前锋逐人防守', 'observation', '2025-26', null, ['man-marking']],
    ['换人增加后方保护', 'observation', '2025-26', null, []]
  ],
  'Barcelona': [
    ['以较长控球阶段缓解强度', 'intent', '2025-26', null, ['possession']],
    ['组织面对前场压迫', 'observation', '2025-26', null, []]
  ],
  'Atlético Madrid': [
    ['中低位控制宽度', 'observation', '2024-25', null, ['low-block']],
    ['邻近球员协同保护', 'observation', '2024-25', null, []],
    ['夺回后寻找出压', 'observation', '2024-25', null, []]
  ],
  'Borussia Dortmund': [
    ['后场制造多一人', 'observation', '2025-26', null, []],
    ['纵向传球与长球', 'observation', '2025-26', null, ['direct-play']],
    ['一人靠近、一人远离', 'observation', '2025-26', null, []]
  ],
  'AS Roma': [
    ['主动向前缩短距离', 'intent', null, null, []],
    ['不能简单等同全场追人', 'intent', null, null, []]
  ],
  'Sporting CP': [
    ['希望主动压迫', 'intent', '2025-26', null, []],
    ['技术配合应对身体压迫', 'intent', '2025-26', null, []],
    ['根据对手选择锋线解法', 'intent', '2025-26', null, []]
  ],
  'Aston Villa': [
    ['中场盒形接应', 'observation', '2025-26', null, []],
    ['中路与两侧共同展开', 'observation', '2025-26', null, ['wide-play']],
    ['可越过中场找身后', 'observation', '2025-26', null, ['direct-play']]
  ],
  'FC Porto': [
    ['允许直接越过压迫', 'intent', '2024-25', null, ['direct-play']],
    ['三人配合牵动盯防', 'observation', '2024-25', null, []],
    ['后卫向前寻找线间接应', 'observation', '2024-25', null, []]
  ],
  'Manchester United': [
    ['长斜传寻找纵深跑动', 'observation', '2024-25', null, ['direct-play']],
    ['回接与向前跑动配合', 'observation', '2024-25', null, []],
    ['保持较均衡的防守块', 'observation', '2024-25', null, []]
  ],
  'Club Brugge': [
    ['多人高位施压', 'observation', '2025-26', null, ['high-press']],
    ['全场逐人参照', 'observation', '2025-26', null, ['man-marking']],
    ['主动提高比赛强度', 'observation', '2025-26', null, []]
  ],
  'Real Betis': [
    ['利用转换攻击空间', 'observation', '2024-25', null, ['counter-attack'], '2024/25 · 对佛罗伦萨案例'],
    ['前锋与中场共同施压', 'observation', '2025-26', null, ['high-press'], '2025/26 · 2026年1月对费耶诺德案例'],
    ['线间接球后连接前场', 'observation', '2025-26', null, [], '2025/26 · 2026年1月对费耶诺德案例']
  ],
  'PSV Eindhoven': [
    ['中卫也跟随接应者', 'observation', '2025-26', null, ['man-marking']],
    ['高位逐人压迫', 'observation', '2025-26', null, ['high-press', 'man-marking']],
    ['高强度转换', 'observation', '2025-26', null, []]
  ],
  'Feyenoord': [
    ['希望掌握球权', 'intent', '2026-27', null, ['possession']],
    ['高位夺回球权', 'background', '2026-27', null, ['high-press']],
    ['边路与直接跑空间并用', 'background', '2026-27', null, ['wide-play']]
  ],
  'Lille': [
    ['4-4-2防守参照', 'observation', '2025-26', null, []],
    ['低位阶段保护中路', 'observation', '2025-26', null, ['low-block']]
  ],
  'Bodo/Glimt': [
    ['后腰靠近中卫接应', 'observation', '2024-25', null, []],
    ['耐心改变推进路线', 'observation', '2024-25', null, ['possession']],
    ['靠近球的反抢与跟跑', 'observation', '2024-25', null, []],
    ['进攻背后的保护结构', 'observation', '2024-25', null, []]
  ],
  'Napoli': [
    ['从较深位置向前进入空间', 'observation', '2025-26', null, []],
    ['拉开边路制造一对一', 'observation', '2025-26', null, ['wide-play']],
    ['边路身后有人保护', 'observation', '2025-26', null, []]
  ],
  'RB Leipzig': [
    ['主动向对手施压', 'intent', '2025-26', null, []],
    ['清晰结构创造空间', 'intent', '2025-26', null, []],
    ['丢球后迅速行动', 'intent', '2025-26', null, []]
  ],
  'Villarreal': [['承认打法需要承担部分风险', 'intent', '2025-26', null, []]],
  'Fenerbahce': [],
  'Shakhtar Donetsk': [
    ['主动提高压迫位置', 'observation', '2024-25', null, ['high-press']],
    ['丢球后的快速反应', 'observation', '2024-25', null, []],
    ['由过度集中中路转向拉宽', 'observation', '2024-25', null, ['wide-play']]
  ],
  'Galatasaray': [['中锋施压制造前场机会', 'observation', '2025-26', '2025-10-22', [], '2025/26 · 2025年10月22日对博德闪耀单场中锋压迫案例']],
  'Slavia Prague': [['历史比赛中的高压', 'observation', '2021-22', null, ['high-press'], '2021/22 · 对LASK历史案例（不含现任教练网页背景）']],
  'Slovan Bratislava': [],
  'VfB Stuttgart': [
    ['中场盒形创造自由接球人', 'observation', '2025-26', null, []],
    ['在对手后卫线形成局部人数优势', 'observation', '2025-26', null, ['wide-play']],
    ['转换时继续向前投入', 'observation', '2025-26', null, []]
  ],
  'AEK Athens': [],
  'LASK': [
    ['动态而非无效的持球', 'intent', '2025-26', null, ['possession']],
    ['希望主动高位施压', 'intent', '2025-26', null, ['high-press']],
    ['条件允许时纵向推进', 'intent', '2025-26', null, []]
  ],
  'Como': [
    ['主动争取控球', 'intent', '2024-25', null, ['possession']],
    ['希望高位压迫', 'intent', '2024-25', null, ['high-press']],
    ['重视转换管理', 'intent', '2024-25', null, []]
  ],
  'Lens': [
    ['尽快争回球权', 'intent', '2025-26', null, []],
    ['组织需适应对手限制', 'intent', '2025-26', null, []],
    ['通过协同制造失衡', 'intent', '2025-26', null, []]
  ],
  'Viking': [['敢于投入较多进攻人数', 'intent', '2026-27', null, []]],
  'Sabah': [['进攻取向的教练背景', 'background', '2026-27', null, []]]
};

const plusDays = (day, days) => new Date(Date.parse(day + 'T00:00:00Z') + days * 86400000).toISOString().slice(0, 10);
export function claimEvidence(note, trait, index, sources, reviewedAt) {
  const metadata = CLAIM_METADATA[note.name];
  if (!metadata || metadata.length !== note.traits.length || metadata[index]?.[0] !== trait[1]) {
    throw new Error(note.name + ' 逐条证据映射缺失或原始标签发生变化：' + trait[1]);
  }
  const [, kind, season, observedAt, signals, period = note.period] = metadata[index];
  const publications = sources.map(source => source.publishedAt).filter(Boolean).sort();
  const anchor = observedAt || publications.at(-1) || null;
  const validUntil = anchor ? plusDays(anchor, SOURCE_POLICY.validityDays[kind]) : null;
  const applicability = season && season !== CURRENT_SEASON ? 'historical'
    : kind !== 'observation' ? 'conditional'
      : !observedAt || !validUntil || validUntil < reviewedAt ? 'needs-review' : 'current-window';
  return { kind, observedAt, period, reviewedAt, validUntil, season, signals: [...signals], applicability,
    expiryBasis: observedAt ? 'observation-date' : anchor ? 'source-publication' : 'unknown' };
}
