(function () {
  const host = document.querySelector('#predictorTactics');
  if (!host || !window.UclTacticalProfiles) return;
  document.head.insertAdjacentHTML('beforeend', '<link rel="stylesheet" href="css/tactical-profiles.css">');
  const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const params = new URLSearchParams(location.search);
  const state = { section: params.get('tacticsView') === 'workbench' ? 'workbench' : 'clubs', selected: params.get('club') || '', opponent: params.get('opponent') || '', query: '', dimension: 'all', style: 'all', context: null };
  let pending = null, catalog = null;
  const $ = selector => host.querySelector(selector);
  const badge = profile => profile.coverage === 'limited' ? '资料有限' : profile.coverage === 'season-observation' ? '本季资料 · 非实时' : '历史观察';
  const logo = profile => teamLogoMarkup(profile.name, 'card');
  function remember() {
    const url = new URL(location.href);
    url.searchParams.set('view', 'predictor'); url.searchParams.set('tab', 'tactics');
    if (state.selected) url.searchParams.set('club', state.selected);
    if (state.opponent) url.searchParams.set('opponent', state.opponent); else url.searchParams.delete('opponent');
    if (state.section === 'workbench') url.searchParams.set('tacticsView', 'workbench'); else url.searchParams.delete('tacticsView');
    history.replaceState(null, '', url);
  }
  async function load() {
    if (catalog) return catalog;
    if (!pending) pending = Promise.all(['framework', 'clubs-a', 'clubs-b', 'clubs-c'].map(async name => {
      const response = await fetch('js/data/tactics/' + name + '.json');
      if (!response.ok) throw new Error('球队档案尚未完整加载，请稍后重试');
      return response.json();
    })).then(([framework, ...shards]) => {
      catalog = window.UclTacticalProfiles.createCatalog(leagueTeamCatalog, shards, framework);
      state.selected = catalog.get(state.selected)?.id || catalog.all()[0].id;
      state.opponent = catalog.get(state.opponent)?.id || '';
      if (state.opponent === state.selected) state.opponent = '';
      return catalog;
    }).catch(error => { pending = null; throw error; });
    return pending;
  }
  function shell() {
    host.innerHTML = '<div class="tactics-intro"><div><p class="eyebrow">PLAYING STYLE · EDITORIAL DOSSIERS</p><h2>先理解比赛，<span>再判断结果。</span></h2><p>逐队观察有球、无球与攻守转换；将有来源的资料与条件式推演分开阅读。</p></div><div class="tactics-count"><b>' + catalog.all().length + '</b><span>份球队档案</span><small>不调整模型概率</small></div></div>' +
      '<div class="tactics-boundary"><strong>研究档案，不是实时情报</strong><p>' + escape(catalog.framework.notice) + '</p><small>人工资料核查：' + escape(catalog.framework.reviewedAt) + ' · 未接入实时首发、伤停及转会核对</small></div>' +
      '<div class="tactics-navigation" role="group" aria-label="球风资料分类"><button type="button" data-tactics-section="clubs">球队档案</button><button type="button" data-tactics-section="workbench">单场推演与复盘</button><button type="button" data-tactics-section="mechanisms">对位机制库</button><button type="button" data-tactics-section="dictionary">球风词典与边界</button></div><div id="tacticsBody"></div>';
    renderSection();
  }
  function renderSection() {
    host.querySelectorAll('[data-tactics-section]').forEach(button => {
      const active = button.dataset.tacticsSection === state.section;
      button.classList.toggle('active', active); button.setAttribute('aria-pressed', String(active));
    });
    if (state.section === 'clubs') {
      $('#tacticsBody').innerHTML = '<div class="tactics-workspace"><aside class="tactics-directory" aria-label="当前36队档案目录"><div class="tactics-directory-head"><h3>球队目录 <small id="tacticsListCount"></small></h3><label>搜索球队<input id="tacticsSearch" type="search" placeholder="中文或英文名称" value="' + escape(state.query) + '"></label><label>有资料覆盖的维度<select id="tacticsDimension"><option value="all">全部维度</option>' + catalog.framework.dimensions.map(row => '<option value="' + escape(row.id) + '"' + (state.dimension === row.id ? ' selected' : '') + '>' + escape(row.label) + '</option>').join('') + '</select></label></div><div class="tactics-list" id="tacticsList"></div></aside><article id="tacticsProfile" class="tactics-profile" aria-live="polite"></article></div>';
      renderList(); renderProfile();
    } else if (state.section === 'workbench') {
      if (window.UclTacticalWorkbench) window.UclTacticalWorkbench.mount($('#tacticsBody'), { catalog, homeId: state.selected, awayId: state.opponent, context: state.context });
      else $('#tacticsBody').innerHTML = '<p class="tactics-no-results">单场分析模块尚未加载，请刷新重试。原有预测不受影响。</p>';
    } else if (state.section === 'mechanisms') renderMechanisms();
    else renderDictionary();
  }
  function renderList() {
    const query = state.query.trim().toLowerCase();
    const profiles = catalog.all().filter(profile => (!query || [profile.zh, profile.name, profile.code].join(' ').toLowerCase().includes(query))
      && (state.dimension === 'all' || profile.traits.some(trait => trait.dimension === state.dimension)));
    $('#tacticsListCount').textContent = profiles.length + ' / 36';
    $('#tacticsList').innerHTML = profiles.length ? profiles.map(profile => '<button type="button" class="tactics-club' + (state.selected === profile.id ? ' selected' : '') + '" data-tactics-club="' + escape(profile.id) + '" aria-pressed="' + (state.selected === profile.id) + '">' + logo(profile) + '<span><strong>' + escape(profile.zh) + '</strong><small>' + escape(profile.name) + '</small><em class="tactics-evidence ' + escape(profile.coverage) + '">' + badge(profile) + '</em></span><i>第' + profile.pot + '档</i></button>').join('') : '<p class="tactics-no-results">没有符合条件的球队；可清除搜索或选择全部维度。</p>';
  }
  function renderProfile() {
    const profile = catalog.get(state.selected), opponent = catalog.get(state.opponent);
    const dimensions = catalog.framework.dimensions;
    const covered = new Set(profile.traits.map(row => row.dimension));
    const missing = dimensions.filter(row => !covered.has(row.id));
    const sourceLink = id => {
      const source = profile.sources.find(row => row.id === id);
      return '<a class="tactics-source-ref" href="' + escape(source.url) + '" target="_blank" rel="noopener noreferrer" title="' + escape(source.title) + '">来源 ' + escape(id) + ' ↗</a>';
    };
    $('#tacticsProfile').innerHTML = '<div class="tactics-profile-hero"><div class="tactics-profile-name">' + logo(profile) + '<div><p class="eyebrow">CLUB DOSSIER</p><h3>' + escape(profile.zh) + '</h3><p>' + escape(profile.name) + '</p></div></div><span class="tactics-evidence ' + escape(profile.coverage) + '">' + badge(profile) + '</span><p class="tactics-summary">' + escape(profile.summary) + '</p><div class="tactics-period"><span>资料观察期 <b>' + escape(profile.evidencePeriod) + '</b></span><span>有来源观察 <b>' + profile.traits.length + ' 项</b></span><span>逐队来源 <b>' + profile.sources.length + ' 个</b></span></div><p class="tactics-coach">' + escape(profile.coachContext) + '</p></div>' +
      '<section class="tactics-block"><div class="tactics-heading"><h4>有来源的球风观察</h4><span>不是永久标签</span></div><div class="tactics-traits">' + (profile.traits.length ? profile.traits.map(trait => '<article><small>' + escape(dimensions.find(row => row.id === trait.dimension).label) + '</small><h5>' + escape(trait.label) + '</h5><p>' + escape(trait.detail) + '</p><div>' + trait.sourceIds.map(sourceLink).join(' ') + '</div></article>').join('') : '<p>当前资料不足以形成可靠的战术观察，不根据比分或排名填充。</p>') + '</div><details class="tactics-missing"><summary>尚未覆盖的维度（' + missing.length + '）</summary><p>' + escape(missing.map(row => row.label).join('、') || '所有维度都有条目，但不代表当前赛季已验证。') + '</p></details></section>' +
      '<section class="tactics-block tactics-personnel"><h4>人员与执行条件</h4><p>' + escape(profile.personnel.status) + '。</p><div class="tactics-role-tags">' + profile.personnel.watchRoles.map(role => '<span>' + escape(role) + '</span>').join('') + '</div><small>这些是需要核对的角色条件，不是已确认缺阵名单，也不是完整球员名册。</small>' + ((profile.personnel.observedPlayers || []).length ? '<div class="tactics-player-observations"><h5>来源中的人员观察 · 非实时阵容</h5>' + profile.personnel.observedPlayers.map(player => '<article><strong>' + escape(player.name) + '</strong><small>' + escape(player.period) + '</small><p>' + escape(player.role) + '</p><div>' + player.sourceIds.map(sourceLink).join(' ') + '</div></article>').join('') + '</div>' : '') + '</section>' +
      '<section class="tactics-block"><div class="tactics-heading"><h4>对照球队与条件式推演</h4><span>未按球风调整胜率</span></div><label class="tactics-opponent-label">对照球队<select id="tacticsOpponent"><option value="">选择对手，查看资料对照</option>' + catalog.all().filter(row => row.id !== profile.id).map(row => '<option value="' + escape(row.id) + '"' + (state.opponent === row.id ? ' selected' : '') + '>' + escape(row.zh + ' · ' + row.name) + '</option>').join('') + '</select></label>' +
      (opponent ? '<div class="tactics-opponent"><div>' + logo(opponent) + '<span><b>' + escape(opponent.zh) + '</b><small>' + escape(opponent.evidencePeriod) + ' · ' + badge(opponent) + '</small></span><button type="button" data-tactics-swap="' + escape(opponent.id) + '">查看对手档案 →</button></div><p>' + escape(opponent.summary) + '</p><p class="tactics-opponent-context">双方资料属于各自观察期，未自动认定对手具有下列风格；只在对应条件成立时阅读分支。</p></div>' : '') +
      '<p class="tactics-explanation">以下为分析推演，不是来源直接报告的未来结论。每个分支仍保留胜、平、负；分支没有经过发生率校准。</p><div class="tactics-scenarios">' + profile.matchups.map(matchup => '<article class="tactics-scenario"><div class="tactics-scenario-title"><span>若对手采用 ' + escape(catalog.framework.styles.find(style => style.id === matchup.opponentStyle).label) + '</span><small>假设 · 无概率</small></div><h5>' + escape(matchup.mechanism) + '</h5>' + branchesMarkup(matchup.branches) + '</article>').join('') + '</div></section>' +
      '<section class="tactics-block tactics-uncertainty"><h4>适用边界与待核查事项</h4><ul>' + profile.uncertainties.map(line => '<li>' + escape(line) + '</li>').join('') + '</ul><p>档案用于解释可能的比赛过程；不能把事后获得的资料当作历史赛前信息回填回测。</p></section>' +
      '<section class="tactics-block tactics-sources"><h4>逐队资料来源</h4><ol>' + profile.sources.map(source => '<li><a href="' + escape(source.url) + '" target="_blank" rel="noopener noreferrer">' + escape(source.title) + ' ↗</a><small>' + escape(source.id) + ' · 发布：' + escape(source.publishedAt || '未明确标注') + ' · 核查：' + escape(source.accessedAt) + '</small></li>').join('') + '</ol></section>';
    decorateEvidence(profile);
  }
  function decorateEvidence(profile) {
    const kinds={observation:'比赛实际观察',intent:'教练理念 / 意图',background:'背景资料',hypothesis:'待验证假设'};
    const day=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
    $('#tacticsProfile').querySelectorAll('.tactics-traits article').forEach((article,index)=>{
      const claim=profile.traits[index], meta=claim?.evidence;
      if(!meta)return;
      article.insertAdjacentHTML('beforeend','<div class="tactics-claim-meta"><b>'+escape(kinds[meta.kind]||'未分类')+'</b><span>适用期：'+escape(meta.period)+'</span><span>观察日：'+escape(meta.observedAt||'未明确，不以发表日代替')+'</span><span>编辑复核期限：'+escape(meta.validUntil||'未知')+(meta.validUntil&&meta.validUntil<day?' · 已过期，需重新核查':'')+'</span><small>期限是编辑政策，不是当前打法已确认；条目 ID '+escape(claim.id)+'</small></div>');
    });
    const hero=$('#tacticsProfile .tactics-profile-hero');
    hero.insertAdjacentHTML('beforeend','<p class="tactics-coach">档案版本 '+escape(profile.revision||'旧版未标记')+' · 本次是证据分类与时效整理，不代表重新核实球队现状。</p>');
    $('#tacticsProfile .tactics-sources').insertAdjacentHTML('beforeend','<details class="tactics-change-log"><summary>档案修订与日期说明</summary><ul>'+(profile.changeLog||[]).map(row=>'<li>'+escape(row.date)+' · '+escape(row.revision)+' · '+escape(row.summary)+'</li>').join('')+'</ul><p>来源发布日期、比赛观察日、资料访问日和档案整理日含义不同。更换教练、转会或阵容变化后需要重新核查，更新赛果不会自动续期这些资料。</p></details>');
  }
  function branchesMarkup(branches) {
    return '<div class="tactics-branches">' + branches.map((branch, i) => '<div><b>分支 ' + (i + 1) + '</b><strong>条件：' + escape(branch.condition) + '</strong><p>' + escape(branch.form) + '</p></div>').join('') + '</div>';
  }
  function renderMechanisms() {
    const framework = catalog.framework;
    $('#tacticsBody').innerHTML = '<div class="tactics-section-intro"><h3>对位不是克制表，而是多分支机制</h3><p>分别检查A进攻对B防守、B进攻对A防守；比赛形态与结果相关，但不是同一变量。</p><label>筛选涉及的风格<select id="tacticsStyle"><option value="all">全部对位机制</option>' + framework.styles.map(row => '<option value="' + escape(row.id) + '"' + (state.style === row.id ? ' selected' : '') + '>' + escape(row.label) + '</option>').join('') + '</select></label></div><div id="tacticsMechanisms" class="tactics-mechanisms"></div>';
    const rules = framework.mechanisms.filter(row => state.style === 'all' || row.styles.includes(state.style));
    $('#tacticsMechanisms').innerHTML = rules.map(row => '<article class="tactics-scenario"><div class="tactics-scenario-title"><span>对位机制</span><small>条件式假设 · 未校准</small></div><h4>' + escape(row.title) + '</h4>' + branchesMarkup(row.branches) + '</article>').join('');
  }
  function renderDictionary() {
    const framework = catalog.framework;
    $('#tacticsBody').innerHTML = '<div class="tactics-section-intro"><h3>球风是多个维度的组合</h3><p>阵型不等于球风；战术意图、执行能力和实际表现分开记录。没有资料不代表中等或零分。</p></div><div class="tactics-dictionary">' + framework.dimensions.map((row, i) => '<article><small>' + String(i + 1).padStart(2, '0') + '</small><h4>' + escape(row.label) + '</h4><strong>' + escape(row.variants) + '</strong><p>' + escape(row.observe) + '</p></article>').join('') + '</div><section class="tactics-block"><h4>比赛形态的五个观察轴</h4><div class="tactics-form-axes">' + framework.formAxes.map(row => '<article><h5>' + escape(row.label) + '</h5><p>' + escape(row.description) + '</p></article>').join('') + '</div></section><section class="tactics-block tactics-uncertainty"><h4>必须遵守的分析边界</h4><ul>' + framework.safeguards.map(line => '<li>' + escape(line) + '</li>').join('') + '</ul></section><section class="tactics-block tactics-sources"><h4>分类框架参考</h4><p>本站工作分类，不宣称是官方唯一分类，也不宣称穷尽所有比赛。</p><ul>' + framework.sources.map(source => '<li><a href="' + escape(source.url) + '" target="_blank" rel="noopener noreferrer">' + escape(source.title) + ' ↗</a></li>').join('') + '</ul></section>';
  }
  async function show() {
    if (!window.uclSeason.current) {
      host.innerHTML = '<div class="predictor-empty">球风档案按当前36队研究，未将这些观察自动套用到历史赛季。</div>'; return;
    }
    if (catalog) { shell(); return; }
    host.innerHTML = '<div class="predictor-empty" role="status">正在加载逐队档案与战术词典…</div>';
    try { await load(); shell(); }
    catch (error) { host.innerHTML = '<div class="predictor-empty"><strong>球风档案暂时无法加载</strong><p>' + escape(error.message) + '</p><button type="button" data-tactics-retry>重新加载档案</button></div>'; }
  }
  host.addEventListener('click', event => {
    const target = event.target.closest('button'); if (!target) return;
    if (target.hasAttribute('data-tactics-retry')) { show(); return; }
    if (!catalog) return;
    if (target.dataset.tacticsSection) { state.section = target.dataset.tacticsSection; renderSection(); remember(); }
    if (target.dataset.tacticsClub) {
      state.selected = target.dataset.tacticsClub;
      if (state.selected === state.opponent) state.opponent = '';
      renderList(); renderProfile(); remember();
      $('#tacticsList').querySelector('[data-tactics-club="' + state.selected + '"]')?.focus({preventScroll:true});
    }
    if (target.dataset.tacticsSwap) {
      const previous = state.selected; state.selected = target.dataset.tacticsSwap; state.opponent = previous;
      renderList(); renderProfile(); remember();
    }
  });
  host.addEventListener('input', event => {
    if (event.target.id === 'tacticsSearch') { state.query = event.target.value; renderList(); }
  });
  host.addEventListener('change', event => {
    if (event.target.id === 'tacticsDimension') { state.dimension = event.target.value; renderList(); }
    if (event.target.id === 'tacticsOpponent') { state.opponent = event.target.value; renderProfile(); remember(); $('#tacticsOpponent').focus({preventScroll:true}); }
    if (event.target.id === 'tacticsStyle') { state.style = event.target.value; renderMechanisms(); }
  });
  window.addEventListener('ucl:predictor-view', event => { if (event.detail === 'tactics') show(); });
  window.addEventListener('ucl:open-tactics', async event => {
    if (!window.uclSeason.current) return;
    document.querySelector('#predictorBtn').click();
    window.UclPredictorPage.showView('tactics');
    try {
      await load();
      state.section = event.detail?.section === 'workbench' ? 'workbench' : 'clubs'; state.query = ''; state.dimension = 'all';
      state.context = event.detail?.fixture ? {fixture: event.detail.fixture, baseline: event.detail.baseline || null} : null;
      state.selected = catalog.get(canonicalTeamName(event.detail?.team))?.id || state.selected;
      state.opponent = catalog.get(canonicalTeamName(event.detail?.opponent))?.id || '';
      if (state.opponent === state.selected) state.opponent = '';
      shell(); remember();
    } catch { /* show() owns the visible retry state. */ }
  });
  window.UclTacticsPage = { show, getCatalog: () => catalog };
  if (!host.hidden && document.querySelector('#predictorPage')?.classList.contains('active')) show();
})();
