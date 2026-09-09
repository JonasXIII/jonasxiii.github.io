// Pack Expected Value — loads packs/data/packs.json (built by
// scripts/build_pack_data.py from taw/magic-sealed-data), then for the
// selected pack: fetches live prices from Scryfall client-side and computes
// exact EV by linearity of expectation (no simulation needed).
"use strict";

const SCRY = 'https://api.scryfall.com/cards/collection';
const LAST_PACK_KEY = 'packs-ev-last-code';

let PACKS = [];
let MODEL = null;
let expDraws = {};
let PRICES = {};
let CUR = 'usd';
let notFound = 0;
let generation = 0; // guards against a slow fetch from a previous pack overwriting the current one

const idKey = (set, num) => set + '/' + num;
const num = x => (x == null || x === '') ? null : parseFloat(x);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const esc = s => (s || '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const fmt = x => (Math.abs(x - Math.round(x)) < 1e-9) ? String(Math.round(x)) : x.toFixed(3).replace(/0+$/, '').replace(/\.$/, '');

function priceOf(key, foil) {
  const p = PRICES[key]; if (!p) return null;
  if (CUR === 'usd') return foil ? p.usd_foil : p.usd;
  return foil ? p.eur_foil : p.eur;
}
const sym = () => CUR === 'usd' ? '$' : '€';
const money = v => v == null ? '—' : sym() + v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const money3 = v => v == null ? '—' : sym() + v.toLocaleString(undefined, { minimumFractionDigits: 3, maximumFractionDigits: 3 });

// ---- generic sheet label / color (packs span many sets with different sheet names) ----
const LOWER_WORDS = new Set(['of', 'the', 'with', 'and', 'in']);
function prettyLabel(name) {
  return name.split('_').map((w, i) => {
    if (i > 0 && LOWER_WORDS.has(w)) return w;
    return w.charAt(0).toUpperCase() + w.slice(1);
  }).join(' ');
}
const RARITY_HINT = [
  [/mythic/i, '#e8823a'], [/rare/i, '#d9a441'], [/uncommon/i, '#5b8fc7'],
  [/common/i, '#9a9aa8'], [/land/i, '#5f9e6e'], [/wildcard/i, '#e8823a'],
  [/list/i, '#9b6bd6'], [/special.?guest/i, '#9b6bd6'],
  [/showcase|borderless|extended|surge|boosterfun|serialized/i, '#3fa596'],
];
const FALLBACK_PALETTE = ['#667eea', '#d6738f', '#3fa596', '#9b6bd6', '#c2994f', '#5b8fc7'];
function colorFor(name) {
  for (const [re, color] of RARITY_HINT) if (re.test(name)) return color;
  let h = 0; for (const c of name) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return FALLBACK_PALETTE[h % FALLBACK_PALETTE.length];
}

// ---- expected draws per sheet per pack (linearity of expectation) ----
function computeExpDraws(model) {
  const totW = model.variants.reduce((a, v) => a + v.weight, 0);
  const draws = {};
  for (const v of model.variants) {
    const p = v.weight / totW;
    for (const [sh, c] of Object.entries(v.slots)) draws[sh] = (draws[sh] || 0) + p * c;
  }
  return draws;
}

function gatherIdentifiers(model) {
  const idset = new Map();
  for (const s of Object.values(model.sheets))
    for (const [set, numc] of s.cards) {
      const k = idKey(set, numc);
      if (!idset.has(k)) idset.set(k, { set, collector_number: numc });
    }
  return [...idset.values()];
}

async function fetchPrices(identifiers, myGen) {
  const map = {}; let missing = 0;
  for (let i = 0; i < identifiers.length; i += 75) {
    const chunk = identifiers.slice(i, i + 75);
    const res = await fetch(SCRY, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ identifiers: chunk }) });
    if (!res.ok) throw new Error('Scryfall returned ' + res.status);
    const data = await res.json();
    if (myGen !== generation) return null; // superseded by a newer pack selection
    missing += (data.not_found || []).length;
    for (const c of data.data) {
      const uris = c.image_uris || (c.card_faces && c.card_faces[0] && c.card_faces[0].image_uris) || {};
      map[idKey(c.set, c.collector_number)] = {
        name: c.name, rarity: c.rarity,
        usd: num(c.prices.usd), usd_foil: num(c.prices.usd_foil),
        eur: num(c.prices.eur), eur_foil: num(c.prices.eur_foil),
        img: uris.small || uris.normal || null, scry: c.scryfall_uri,
      };
    }
    if (i + 75 < identifiers.length) await sleep(90);
  }
  return { map, missing };
}

// ---- per-sheet expected value of one draw ----
function sheetDrawEV(name) {
  const s = MODEL.sheets[name]; let ev = 0;
  for (const [set, numc, w] of s.cards) {
    const pr = priceOf(idKey(set, numc), s.foil);
    if (pr == null) continue;
    ev += (w / s.total) * pr;
  }
  return ev;
}

// ---- per-card expected copies per pack (aggregated across sheets, by finish) ----
function chaseCards() {
  const agg = {};
  for (const [name, s] of Object.entries(MODEL.sheets)) {
    const ed = expDraws[name] || 0; if (!ed) continue;
    for (const [set, numc, w] of s.cards) {
      const k = idKey(set, numc) + '|' + (s.foil ? 'f' : 'n');
      const copies = ed * (w / s.total);
      if (!agg[k]) agg[k] = { key: idKey(set, numc), foil: s.foil, copies: 0 };
      agg[k].copies += copies;
    }
  }
  const rows = [];
  for (const a of Object.values(agg)) {
    const pr = priceOf(a.key, a.foil); if (pr == null || pr === 0) continue;
    const p = PRICES[a.key] || {};
    rows.push({ name: p.name || a.key, rarity: p.rarity, foil: a.foil, price: pr, copies: a.copies, contrib: a.copies * pr, img: p.img, scry: p.scry });
  }
  rows.sort((x, y) => y.contrib - x.contrib);
  return rows;
}

function sumDraws() { return Object.values(expDraws).reduce((a, b) => a + b, 0); }

function rTag(r) {
  if (!r) return '';
  const col = { common: '#9a9aa8', uncommon: '#5b8fc7', rare: '#d9a441', mythic: '#e8823a', special: '#9b6bd6', bonus: '#9b6bd6' }[r] || '#aaa';
  return '<span class="packs-tag" style="color:' + col + '">' + r[0].toUpperCase() + '</span>';
}

function formulaText() {
  return Object.entries(expDraws)
    .sort((a, b) => b[1] - a[1])
    .map(([n, d]) => fmt(d) + ' × EV[' + prettyLabel(n) + ']')
    .join('  +  ');
}

function updateMargin(packEV) {
  const c = parseFloat(document.getElementById('cost').value);
  const m = document.getElementById('margin');
  if (isNaN(c) || c <= 0) { m.innerHTML = ''; return; }
  const diff = packEV - c;
  const pct = (packEV / c * 100);
  const cls = diff >= 0 ? 'packs-good' : 'packs-bad';
  m.innerHTML = 'At ' + money(c) + '/pack: <b class="' + cls + '">'
    + (diff >= 0 ? '+' : '') + money(diff) + '</b> expected ' + (diff >= 0 ? 'profit' : 'loss')
    + ' <span style="color:#999">(' + pct.toFixed(0) + '% of cost returned)</span>';
}

function countMissing() {
  let n = 0;
  for (const s of Object.values(MODEL.sheets))
    for (const [set, numc] of s.cards) if (priceOf(idKey(set, numc), s.foil) == null) n++;
  return n;
}

// ================= RENDER =================
function render() {
  const rows = Object.keys(expDraws).map(name => {
    const ev = sheetDrawEV(name);
    return { name, draws: expDraws[name], each: ev, contrib: expDraws[name] * ev };
  });
  const packEV = rows.reduce((a, r) => a + r.contrib, 0);
  const maxC = Math.max(...rows.map(r => r.contrib), 0);
  rows.sort((a, b) => b.contrib - a.contrib);

  document.getElementById('ev').textContent = money(packEV);
  document.getElementById('evsub').textContent = 'across ' + fmt(sumDraws()) + ' cards';
  updateMargin(packEV);

  const tb = document.getElementById('ledger'); tb.innerHTML = '';
  for (const r of rows) {
    const share = maxC > 0 ? (r.contrib / maxC * 100) : 0;
    const color = colorFor(r.name);
    const foilNote = MODEL.sheets[r.name].foil ? ' <span class="packs-tag">foil</span>' : '';
    const tr = document.createElement('tr');
    tr.innerHTML =
      '<td><span class="packs-slot"><span class="packs-swatch" style="background:' + color + '"></span>'
      + prettyLabel(r.name) + foilNote + '</span></td>'
      + '<td class="packs-mono">' + fmt(r.draws) + '</td>'
      + '<td class="packs-mono">' + money3(r.each) + '</td>'
      + '<td class="packs-mono">' + money(r.contrib) + '</td>'
      + '<td class="packs-barcell"><div class="packs-bar"><span style="width:' + share.toFixed(1) + '%;background:' + color + '"></span></div></td>';
    tb.appendChild(tr);
  }
  const tot = document.createElement('tr'); tot.className = 'packs-totrow';
  tot.innerHTML = '<td>Pack total</td><td class="packs-mono">' + fmt(sumDraws()) + '</td><td></td>'
    + '<td class="packs-mono packs-evnum-sm">' + money(packEV) + '</td><td></td>';
  tb.appendChild(tot);

  const chase = chaseCards().slice(0, 24);
  const cc = document.getElementById('chase'); cc.innerHTML = '';
  for (const c of chase) {
    const per = c.copies > 0 ? Math.round(1 / c.copies) : 0;
    const el = document.createElement('a');
    el.className = 'packs-card'; el.href = c.scry || '#'; el.target = '_blank'; el.rel = 'noopener';
    el.innerHTML =
      '<div class="packs-thumb" style="background-image:url(' + (c.img || '') + ')"></div>'
      + '<div><div class="packs-nm">' + esc(c.name) + ' ' + rTag(c.rarity) + (c.foil ? ' <span class="packs-tag">foil</span>' : '') + '</div>'
      + '<div class="packs-meta">' + money(c.price) + ' · ~1 in ' + per.toLocaleString() + ' packs</div></div>'
      + '<div class="packs-val"><div class="packs-v">' + money(c.contrib) + '</div><div class="packs-p">/pack</div></div>';
    cc.appendChild(el);
  }

  const totW = MODEL.variants.reduce((a, v) => a + v.weight, 0);
  const vt = document.getElementById('variants'); vt.innerHTML = '';
  document.getElementById('variant-count').textContent = MODEL.variants.length;
  for (const v of MODEL.variants) {
    const slots = Object.entries(v.slots).map(([s, c]) => c + '× ' + prettyLabel(s)).join(', ');
    const tr = document.createElement('tr');
    tr.innerHTML = '<td class="packs-mono">' + (100 * v.weight / totW).toFixed(1) + '%</td><td>' + slots + '</td>';
    vt.appendChild(tr);
  }

  buildSheets();
  document.getElementById('formula').innerHTML = 'EV(pack) = ' + formulaText();
  document.getElementById('ts').textContent = 'as of ' + new Date().toLocaleString();
}

let sheetsBuilt = false;
function buildSheets() {
  const host = document.getElementById('sheets');
  if (sheetsBuilt) {
    host.querySelectorAll('details[data-sheet]').forEach(d => { if (d.open) fillSheet(d); });
    return;
  }
  host.innerHTML = ''; sheetsBuilt = true;
  const order = Object.keys(MODEL.sheets).sort((a, b) => (expDraws[b] || 0) - (expDraws[a] || 0));
  for (const name of order) {
    const s = MODEL.sheets[name];
    const d = document.createElement('details'); d.className = 'packs-details'; d.dataset.sheet = name;
    const drawEV = sheetDrawEV(name);
    d.innerHTML = '<summary><span class="packs-swatch" style="background:' + colorFor(name) + '"></span>'
      + prettyLabel(name) + ' <span class="packs-tag">'
      + s.cards.length + ' cards · one worth avg <span class="ev-each"></span></span></summary>'
      + '<div class="packs-dbody"><table class="packs-oddstable"><tbody></tbody></table></div>';
    d.querySelector('.ev-each').textContent = money3(drawEV);
    d.addEventListener('toggle', () => { if (d.open) fillSheet(d); });
    host.appendChild(d);
  }
}

function fillSheet(d) {
  const name = d.dataset.sheet; const s = MODEL.sheets[name];
  d.querySelector('.ev-each').textContent = money3(sheetDrawEV(name));
  const tbody = d.querySelector('tbody');
  const cards = s.cards.map(([set, numc, w]) => {
    const key = idKey(set, numc); const p = PRICES[key] || {};
    return { numc, w, name: p.name || key, price: priceOf(key, s.foil), rate: w / s.total, scry: p.scry, rarity: p.rarity };
  }).sort((a, b) => b.rate - a.rate || (b.price || 0) - (a.price || 0));
  tbody.innerHTML = cards.map(c => {
    const oneIn = Math.round(s.total / c.w);
    return '<tr><td>' + esc(c.name) + ' ' + rTag(c.rarity) + '</td>'
      + '<td>' + (c.price == null ? '<span class="packs-miss">n/a</span>' : money(c.price)) + '</td>'
      + '<td>1 in ' + oneIn.toLocaleString() + '</td></tr>';
  }).join('');
}

// ---- lifecycle ----
const dot = () => document.getElementById('dot');
const st = () => document.getElementById('statustext');
const rf = () => document.getElementById('refresh');

async function load() {
  const myGen = generation;
  dot().className = 'packs-dot'; st().textContent = 'Fetching live prices from Scryfall…'; rf().disabled = true;
  document.getElementById('ev').textContent = '—';
  sheetsBuilt = false;
  try {
    const identifiers = gatherIdentifiers(MODEL);
    const result = await fetchPrices(identifiers, myGen);
    if (myGen !== generation) return; // a newer pack was selected while this was in flight
    PRICES = result.map; notFound = result.missing;
    dot().className = 'packs-dot live';
    st().textContent = identifiers.length + ' prints priced' + (notFound ? (' · ' + notFound + ' not found') : '');
    render();
    const missing = countMissing();
    if (missing) st().textContent += ' · ' + missing + ' missing a ' + CUR.toUpperCase() + ' price (counted as 0)';
  } catch (e) {
    if (myGen !== generation) return;
    dot().className = 'packs-dot err';
    st().textContent = 'Couldn’t load prices: ' + e.message + '. Check your connection and retry.';
    document.getElementById('ev').textContent = '—';
    document.getElementById('evsub').textContent = '';
  } finally {
    if (myGen === generation) rf().disabled = false;
  }
}

function updateBadge(pack) {
  const badge = document.getElementById('pack-badge');
  if (pack.released_at && pack.released_at > new Date().toISOString().slice(0, 10)) {
    badge.hidden = false;
    badge.textContent = 'Releases ' + new Date(pack.released_at + 'T00:00:00').toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) + ' — prices likely unavailable';
  } else {
    badge.hidden = true;
  }
}

function selectPack(code) {
  const pack = PACKS.find(p => p.code === code);
  if (!pack) return;
  generation++;
  MODEL = pack;
  expDraws = computeExpDraws(MODEL);
  updateBadge(pack);
  document.getElementById('cost').value = '';
  document.getElementById('margin').innerHTML = '';
  try { localStorage.setItem(LAST_PACK_KEY, code); } catch (e) { /* private browsing, etc. */ }
  load();
}

async function init() {
  const res = await fetch('data/packs.json');
  PACKS = await res.json();

  const select = document.getElementById('pack-select');
  select.innerHTML = PACKS.map(p => '<option value="' + p.code + '">' + esc(p.set_name) + ' — ' + esc(p.name.replace(p.set_name, '').trim() || 'Play Booster') + '</option>').join('');
  select.addEventListener('change', () => selectPack(select.value));

  document.getElementById('cur').addEventListener('click', e => {
    const b = e.target.closest('button[data-cur]'); if (!b) return;
    CUR = b.dataset.cur;
    [...e.currentTarget.children].forEach(x => x.classList.toggle('on', x === b));
    if (Object.keys(PRICES).length) {
      render();
      const missing = countMissing();
      st().textContent = gatherIdentifiers(MODEL).length + ' prints priced' + (missing ? (' · ' + missing + ' missing a ' + CUR.toUpperCase() + ' price (counted as 0)') : '');
    }
  });
  document.getElementById('cost').addEventListener('input', () => {
    const evText = document.getElementById('ev').textContent.replace(/[^0-9.]/g, '');
    updateMargin(parseFloat(evText) || 0);
  });
  document.getElementById('refresh').addEventListener('click', load);

  let startCode = PACKS[0].code;
  try {
    const saved = localStorage.getItem(LAST_PACK_KEY);
    if (saved && PACKS.some(p => p.code === saved)) startCode = saved;
  } catch (e) { /* ignore */ }
  select.value = startCode;
  selectPack(startCode);
}

init();
