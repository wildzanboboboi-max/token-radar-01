// Token Radar dashboard. Reads window.RADAR (written beside dashboard/ by
// main.ts) and renders the board, the live-token view, the method, and a
// detail view per protocol. No network: every byte shown is in data.js.
(function () {
  'use strict';
  var DATA = window.RADAR;
  if (!DATA) return;

  var state = { q: '', category: 'all', chain: 'all', minTvl: 0, watchlistOnly: false, growingOnly: false, tab: 'board', sort: 'implied', dir: -1, selected: null };
  var sandbox = { scale: 1, growthW: DATA.model.growth_weight, matW: DATA.model.maturity_range, active: false };

  var usd0 = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
  function fmtUsd(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    if (Math.abs(n) >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (Math.abs(n) >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
    if (Math.abs(n) >= 1e3) return '$' + Math.round(n / 1e3) + 'K';
    return usd0.format(n);
  }
  function fmtPct(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    return (n > 0 ? '+' : '') + n.toFixed(2) + '%';
  }
  function fmtAge(days) {
    if (days === null || days === undefined) return 'unknown';
    if (days >= 365) return (days / 365).toFixed(1) + 'y';
    return Math.max(0, Math.round(days)) + 'd';
  }
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

  // The published implied value, or the sandbox's re-ranked one. Same
  // arithmetic main.ts runs; the sandbox only varies three weights.
  function impliedOf(r) {
    if (!sandbox.active) return r.implied_value_usd;
    var m = DATA.model;
    var growth = Math.min(m.growth_cap, Math.max(m.growth_floor, r.change_7d === null ? 0 : r.change_7d));
    var age = r.age_days === null ? m.unknown_age_days : r.age_days;
    var maturity = 0.65 + (Math.min(Math.max(age, 0), m.maturity_days) / m.maturity_days) * sandbox.matW;
    return Math.max(1, Math.round(r.tvl_usd * r.comparable_multiple * sandbox.scale * (1 + (growth / 100) * sandbox.growthW) * maturity * r.breadth_multiplier));
  }

  function readParams() {
    var params = new URLSearchParams(window.location.search);
    var hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    function get(k) { return params.get(k) || hash.get(k); }
    if (get('q')) state.q = get('q');
    if (get('category')) state.category = get('category');
    if (get('chain')) state.chain = get('chain');
    if (get('minTvl')) state.minTvl = parseInt(get('minTvl'), 10) || 0;
    if (get('watchlist') === '1') state.watchlistOnly = true;
    if (get('growing') === '1') state.growingOnly = true;
    if (get('tab') === 'live' || get('tab') === 'method') state.tab = get('tab');
    if (get('p')) state.selected = get('p');
  }
  function writeHash() {
    var p = new URLSearchParams();
    if (state.q) p.set('q', state.q);
    if (state.category !== 'all') p.set('category', state.category);
    if (state.chain !== 'all') p.set('chain', state.chain);
    if (state.minTvl) p.set('minTvl', String(state.minTvl));
    if (state.watchlistOnly) p.set('watchlist', '1');
    if (state.growingOnly) p.set('growing', '1');
    if (state.tab !== 'board') p.set('tab', state.tab);
    if (state.selected) p.set('p', state.selected);
    var next = p.toString();
    try { window.history.replaceState(null, '', next ? '#' + next : window.location.pathname + window.location.search); } catch (e) { /* file URLs may refuse; state still renders */ }
  }

  function filteredRows() {
    var q = state.q.trim().toLowerCase();
    return DATA.rows.filter(function (r) {
      if (state.category !== 'all' && (r.category || 'Other') !== state.category) return false;
      if (state.chain !== 'all' && r.chains.indexOf(state.chain) < 0) return false;
      if (r.tvl_usd < state.minTvl) return false;
      if (state.watchlistOnly && !r.watchlist) return false;
      if (state.growingOnly && !(r.change_7d !== null && r.change_7d > 0)) return false;
      if (!q) return true;
      var hay = [r.name, r.slug, r.category, r.chains.join(' ')].join(' ').toLowerCase();
      return hay.indexOf(q) >= 0;
    });
  }
  function sortedRows(list) {
    var key = state.sort, dir = state.dir;
    return list.slice().sort(function (a, b) {
      var av, bv;
      if (key === 'name') { av = a.name.toLowerCase(); bv = b.name.toLowerCase(); }
      else if (key === 'tvl') { av = a.tvl_usd; bv = b.tvl_usd; }
      else if (key === 'growth') { av = a.change_7d === null ? -Infinity : a.change_7d; bv = b.change_7d === null ? -Infinity : b.change_7d; }
      else if (key === 'age') { av = a.age_days === null ? Infinity : a.age_days; bv = b.age_days === null ? Infinity : b.age_days; }
      else { av = impliedOf(a); bv = impliedOf(b); }
      if (av < bv) return -dir;
      if (av > bv) return dir;
      return a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0;
    });
  }

  var $ = function (id) { return document.getElementById(id); };

  function renderFacts() {
    $('snap-date').textContent = 'Snapshot ' + DATA.as_of;
    $('model-tag').textContent = DATA.model_version + ' model';
    $('headline').textContent = DATA.watchlist_size + ' watchlist protocols, ranked by implied value';
    $('lede-p').textContent = 'The watchlist is the floor: every protocol with at least $' + Math.round(DATA.floor_usd / 1e6) + 'M of TVL and no token on record. The early radar adds ' + DATA.early_size + ' pre-token protocols below that floor. Implied value is a model, not a promise — and “records no token” is the snapshot’s record, never proof a token does not exist.';
    var facts = [
      ['Watchlist covered', DATA.watchlist_size + ' / ' + DATA.watchlist_size],
      ['Pre-token rows scored', String(DATA.board_size)],
      ['Early rows below the floor', String(DATA.early_size)],
      ['Live-token protocols set aside', String(DATA.live_size)]
    ];
    $('facts').innerHTML = facts.map(function (f) { return '<div class="fact"><span>' + esc(f[0]) + '</span><b>' + esc(f[1]) + '</b></div>'; }).join('');
    var m = DATA.model;
    $('formula').textContent = 'implied = round( tvl_usd x comparable(category) x (1 + clamp(change_7d, ' + m.growth_floor + ', ' + m.growth_cap + ') / 100 x ' + m.growth_weight + ') x (0.65 + min(age_days, ' + m.maturity_days + ') / ' + m.maturity_days + ' x ' + m.maturity_range + ') x (1 + 0.015 x min(chains - 1, 8)) )'
      + '   — overall comparable ' + DATA.overall_comparable + ', per-category medians from live-token protocols.';
  }

  function renderControls() {
    var cats = Array.from(new Set(DATA.rows.map(function (r) { return r.category || 'Other'; }))).sort();
    $('category').innerHTML = '<option value="all">All categories</option>' + cats.map(function (c) { return '<option value="' + esc(c) + '"' + (c === state.category ? ' selected' : '') + '>' + esc(c) + '</option>'; }).join('');
    var chains = Array.from(new Set(DATA.rows.reduce(function (acc, r) { return acc.concat(r.chains); }, []))).sort();
    $('chain').innerHTML = '<option value="all">All chains</option>' + chains.map(function (c) { return '<option value="' + esc(c) + '"' + (c === state.chain ? ' selected' : '') + '>' + esc(c) + '</option>'; }).join('');
    $('q').value = state.q;
    $('min-tvl').value = String(state.minTvl);
    $('watchlist-only').checked = state.watchlistOnly;
    $('growing-only').checked = state.growingOnly;
    $('tab-board').setAttribute('aria-selected', state.tab === 'board' ? 'true' : 'false');
    $('tab-live').setAttribute('aria-selected', state.tab === 'live' ? 'true' : 'false');
    $('tab-method').setAttribute('aria-selected', state.tab === 'method' ? 'true' : 'false');
    $('board-panel').hidden = state.tab !== 'board';
    $('sandbox').hidden = state.tab !== 'board';
    $('live-panel').hidden = state.tab !== 'live';
    $('method-panel').hidden = state.tab !== 'method';
  }

  function renderBoard() {
    var list = sortedRows(filteredRows());
    var max = list.length ? Math.max.apply(null, list.map(impliedOf)) : 1;
    var html = list.map(function (r) {
      var v = impliedOf(r);
      var growth = r.change_7d === null ? 'n/a' : fmtPct(r.change_7d);
      var gc = r.change_7d === null ? '' : r.change_7d >= 0 ? 'pos' : 'neg';
      var chains = r.chains.length ? r.chains.slice(0, 2).join(', ') : 'an unnamed chain';
      return '<tr data-slug="' + esc(r.slug) + '" data-selected="' + (state.selected === r.slug) + '" tabindex="0">'
        + '<td class="num">' + r.rank + '</td>'
        + '<td><div class="name"><b>' + esc(r.name) + (r.watchlist ? '<span class="badge">WATCHLIST</span>' : '') + '</b><span class="sub">' + esc(r.category || 'Other') + ' on ' + esc(chains) + '</span></div></td>'
        + '<td class="num">' + fmtUsd(r.tvl_usd) + '</td>'
        + '<td class="num ' + gc + '">' + growth + '</td>'
        + '<td class="num">' + fmtAge(r.age_days) + '</td>'
        + '<td><div class="bar" aria-hidden="true"><i style="width:' + Math.max(3, Math.round((v / max) * 100)) + '%"></i></div><span class="num">' + fmtUsd(v) + '</span></td>'
        + '<td><span class="status">no token</span></td></tr>';
    }).join('');
    $('rows').innerHTML = html;
    $('empty').hidden = list.length > 0;
    var shown = list.length;
    $('count').textContent = shown + ' of ' + DATA.board_size + ' rows shown' + (sandbox.active ? ' · sandbox re-ranking on' : '');
    Array.prototype.forEach.call(document.querySelectorAll('#rows tr'), function (tr) {
      tr.addEventListener('click', function () { openDetail(tr.getAttribute('data-slug')); });
      tr.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openDetail(tr.getAttribute('data-slug')); } });
    });
  }

  function renderLive() {
    $('live-rows').innerHTML = DATA.live.map(function (r) {
      return '<tr><td><div class="name"><b>' + esc(r.name) + '</b><span class="sub">' + esc(r.category || 'Other') + ' on ' + esc(r.chains.length ? r.chains.slice(0, 2).join(', ') : 'an unnamed chain') + '</span></div></td>'
        + '<td class="num">' + fmtUsd(r.tvl_usd) + '</td>'
        + '<td class="num ' + (r.change_7d !== null && r.change_7d >= 0 ? 'pos' : 'neg') + '">' + fmtPct(r.change_7d) + '</td>'
        + '<td class="num">' + fmtUsd(r.mcap_usd) + '</td>'
        + '<td class="num">' + (r.mcap_tvl === null ? 'n/a' : r.mcap_tvl.toFixed(2) + '×') + '</td>'
        + '<td><span class="status">already trades</span></td></tr>';
    }).join('');
  }

  function openDetail(slug) {
    var row = null;
    for (var i = 0; i < DATA.rows.length; i++) if (DATA.rows[i].slug === slug) { row = DATA.rows[i]; break; }
    if (!row) return;
    state.selected = slug;
    writeHash();
    renderBoard();
    $('detail-rank').textContent = 'Rank ' + row.rank + ' of ' + DATA.board_size + (row.watchlist ? ' · Watchlist' : ' · Early radar');
    $('detail-title').textContent = row.name;
    $('detail-sub').textContent = (row.category || 'Other') + ' on ' + (row.chains.length ? row.chains.join(', ') : 'an unnamed chain');
    var m = DATA.model;
    var eq = [
      ['TVL', fmtUsd(row.tvl_usd)],
      ['Seven-day growth', fmtPct(row.change_7d)],
      ['Age with no token', fmtAge(row.age_days)],
      ['Comparable (mcap / TVL)', row.comparable_multiple.toFixed(2) + '×'],
      ['Growth multiplier', String(row.growth_multiplier)],
      ['Maturity multiplier', String(row.maturity_multiplier)],
      ['Breadth multiplier', String(row.breadth_multiplier)],
      ['Implied value', fmtUsd(row.implied_value_usd)]
    ];
    var steps = row.farm_steps.map(function (s) {
      var at = s.indexOf(' Cost: ');
      var action = at >= 0 ? s.slice(0, at) : s;
      var tail = at >= 0 ? s.slice(at + 1) : '';
      return '<li><b>' + esc(action) + '</b><span class="cost">' + esc(tail) + '</span></li>';
    }).join('');
    var risks = row.risks.length
      ? '<h3>Risk heuristics — snapshot only, not on-chain checks</h3><ul class="risks">' + row.risks.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>'
      : '<h3>Risk heuristics — snapshot only, not on-chain checks</h3><p class="sub">No snapshot-only risk flag fires for this protocol.</p>';
    $('detail-body').innerHTML =
      '<h3>Implied value</h3><div class="equation">' + eq.map(function (e) { return '<div><span>' + esc(e[0]) + '</span><b class="num">' + esc(e[1]) + '</b></div>'; }).join('') + '</div>'
      + '<p class="sub">Model ' + esc(DATA.model_version) + ': the same function scores every protocol. Growth is clamped to ' + m.growth_floor + '%…+' + m.growth_cap + '%, unknown age uses ' + m.unknown_age_days + ' days. This is an estimate, not a price — and it does not predict a launch.</p>'
      + '<h3>Farm plan</h3><ol class="steps">' + steps + '</ol>'
      + risks;
    $('detail').hidden = false;
  }
  function closeDetail() {
    state.selected = null;
    writeHash();
    $('detail').hidden = true;
    renderBoard();
  }

  function render() { renderFacts(); renderControls(); renderBoard(); renderLive(); }

  function bind() {
    $('q').addEventListener('input', function (e) { state.q = e.target.value; writeHash(); renderBoard(); });
    $('category').addEventListener('change', function (e) { state.category = e.target.value; writeHash(); renderBoard(); });
    $('chain').addEventListener('change', function (e) { state.chain = e.target.value; writeHash(); renderBoard(); });
    $('min-tvl').addEventListener('change', function (e) { state.minTvl = parseInt(e.target.value, 10) || 0; writeHash(); renderBoard(); });
    $('watchlist-only').addEventListener('change', function (e) { state.watchlistOnly = e.target.checked; writeHash(); renderBoard(); });
    $('growing-only').addEventListener('change', function (e) { state.growingOnly = e.target.checked; writeHash(); renderBoard(); });
    $('tab-board').addEventListener('click', function () { state.tab = 'board'; writeHash(); render(); });
    $('tab-live').addEventListener('click', function () { state.tab = 'live'; writeHash(); render(); });
    $('tab-method').addEventListener('click', function () { state.tab = 'method'; writeHash(); render(); });
    Array.prototype.forEach.call(document.querySelectorAll('th button[data-sort]'), function (b) {
      b.addEventListener('click', function () {
        var key = b.getAttribute('data-sort');
        if (state.sort === key) state.dir = -state.dir; else { state.sort = key; state.dir = -1; }
        renderBoard();
      });
    });
    $('detail-close').addEventListener('click', closeDetail);
    $('detail').addEventListener('click', function (e) { if (e.target === $('detail')) closeDetail(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !$('detail').hidden) closeDetail(); });
    // A hash-only navigation (same document, no reload) still applies: a
    // shared detail or filtered link opens its view when followed in-page.
    window.addEventListener('hashchange', function () {
      readParams();
      render();
      if (state.selected) openDetail(state.selected);
      else if (!$('detail').hidden) closeDetail();
    });
    // Sandbox sliders: any move away from the published weights turns re-ranking on.
    function syncSandbox() {
      sandbox.scale = parseFloat($('scale').value);
      sandbox.growthW = parseFloat($('growth-w').value);
      sandbox.matW = parseFloat($('mat-w').value);
      $('out-scale').textContent = sandbox.scale.toFixed(2) + '×';
      $('out-growth').textContent = sandbox.growthW.toFixed(2);
      $('out-mat').textContent = sandbox.matW.toFixed(2);
      sandbox.active = sandbox.scale !== 1 || sandbox.growthW !== DATA.model.growth_weight || sandbox.matW !== DATA.model.maturity_range;
      $('sandbox-note').textContent = sandbox.active ? 'Sandbox on — table re-ranked with your weights. board.json keeps the published ranking.' : 'Sandbox off — showing the published ranking.';
      renderBoard();
    }
    ['scale', 'growth-w', 'mat-w'].forEach(function (id) { $(id).addEventListener('input', syncSandbox); });
  }

  readParams();
  render();
  bind();
  if (state.selected) openDetail(state.selected);
})();
