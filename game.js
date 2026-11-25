'use strict';
/* Downtown Gardener - plants are read from /sh and /mh (see plants.json + each info.txt). */
const $ = (s, r = document) => r.querySelector(s);
const SAVE_KEY = 'downtown-gardener-save-v1';
const CANS = [
  { name: 'Tin Watering Can', wet: 90, cost: 0 },
  { name: 'Copper Watering Can', wet: 240, cost: 150 },
  { name: 'Golden Watering Can', wet: 600, cost: 600 },
];
const RESTOCK_SEC = 120, MAXSIZE = 8, OFFLINE_CAP = 8 * 3600;

let P = {}, ORDER = [], S = null, tool = 'hand', view = 'garden', gridSize = 0, lastT = Date.now(), started = false;

/* ---------- helpers ---------- */
const fmt = n => Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/\.?0+$/, '');
const kochu = n => `<span class="k-amt"><img class="k" src="img/kochu.svg" alt="">${fmt(n)}</span>`;
const md = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
  .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/\*(.+?)\*/g, '<i>$1</i>').replace(/`(.+?)`/g, '<code>$1</code>').replace(/\n/g, '<br>');
const seedIcon = n => P[n].base + 'ssprite1.svg';
const cropIcon = n => P[n].base + `psprite${P[n].np}.svg`;
const total = pl => pl.sgrowth + pl.pgrowth;
let toastT;
function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 1800);
}

/* ---------- data ---------- */
function parseInfo(txt) {
  const o = {}; let k = null;
  for (const line of txt.split(/\r?\n/)) {
    const m = line.match(/^(\w+)\s*=\s*(.*)$/);
    if (m) { k = m[1]; o[k] = m[2]; } else if (k === 'description') o[k] += '\n' + line;
  }
  return o;
}
async function loadPlants() {
  const man = await (await fetch('plants.json')).json();
  for (const type of ['sh', 'mh']) {
    for (const e of man[type] || []) {
      const base = `${type}/${e.name}/`;
      const info = parseInfo(await (await fetch(base + 'info.txt')).text());
      const pl = { name: e.name, type, base, ns: e.ss, np: e.ps, seedName: e.name + 'Seed', description: info.description || '' };
      for (const k of ['seedprice', 'stock', 'avgstock', 'price', 'mweight', 'maweight', 'sgrowth', 'pgrowth']) pl[k] = Number(info[k]) || 0;
      P[e.name] = pl; ORDER.push(e.name);
    }
  }
}

/* ---------- state ---------- */
const mkTiles = n => Array.from({ length: n * n }, () => ({ p: null, prog: 0, wet: 0, fert: 0 }));
function fresh() {
  const s = { kochu: 50, seeds: { Carrot: 3, Radish: 3 }, produce: {}, can: 0, compost: 3, basket: false, size: 4, tiles: mkTiles(4), shop: { stock: {}, next: 0 }, last: Date.now() };
  return s;
}
const save = () => { if (!S) return; S.last = Date.now(); try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch (e) {} };
function loadSave() { try { const s = JSON.parse(localStorage.getItem(SAVE_KEY)); return s && s.tiles ? s : null; } catch (e) { return null; } }

function restock(first) {
  const st = {};
  for (const n of ORDER) {
    const pl = P[n]; let q = 0;
    if (Math.random() * 100 < pl.stock || (first && pl.seedprice <= 4))
      q = Math.max(1, Math.round(pl.avgstock * (0.7 + Math.random() * 0.6)));
    st[n] = q;
  }
  S.shop.stock = st; S.shop.next = Date.now() + RESTOCK_SEC * 1000;
}

function tick(dt) {
  for (const t of S.tiles) {
    if (!t.p) continue;
    const pl = P[t.p], tot = total(pl);
    if (t.prog < tot) t.prog = Math.min(tot, t.prog + Math.min(dt, t.wet) * (t.fert > 0 ? 2 : 1));
    t.wet = Math.max(0, t.wet - dt); t.fert = Math.max(0, t.fert - dt);
  }
  if (Date.now() >= S.shop.next) { restock(false); if (view === 'seeds') renderPage(); }
}

/* ---------- garden ---------- */
function spriteFor(pl, prog) {
  if (prog < pl.sgrowth) return pl.base + `ssprite${Math.min(pl.ns, Math.floor(prog / pl.sgrowth * pl.ns) + 1)}.svg`;
  const q = (prog - pl.sgrowth) / pl.pgrowth;
  if (q >= 1) return pl.base + `psprite${pl.np}.svg`;
  return pl.base + `psprite${Math.min(pl.np - 1, Math.floor(q * (pl.np - 1)) + 1)}.svg`;
}
function buildGrid() {
  gridSize = S.size;
  const g = $('#grid'); g.style.setProperty('--n', S.size);
  g.innerHTML = S.tiles.map((_, i) => `<div class="tile" data-i="${i}"><img class="spr" alt=""><i class="gb"><b></b></i><i class="wb"><b></b></i></div>`).join('');
}
function paint() {
  if (gridSize !== S.size) buildGrid();
  const els = $('#grid').children;
  S.tiles.forEach((t, i) => {
    const el = els[i]; if (!el) return;
    const pl = t.p && P[t.p];
    el.classList.toggle('wet', t.wet > 0);
    el.classList.toggle('fert', t.fert > 0);
    el.classList.toggle('ready', !!pl && t.prog >= total(pl));
    const img = el.firstChild;
    if (pl) {
      const s = spriteFor(pl, t.prog);
      if (img.dataset.s !== s) { img.dataset.s = s; img.src = s; }
      el.children[1].firstChild.style.width = (t.prog / total(pl) * 100) + '%';
    } else if (img.dataset.s) { img.dataset.s = ''; img.removeAttribute('src'); el.children[1].firstChild.style.width = '0'; }
    el.children[2].firstChild.style.width = Math.min(100, t.wet / CANS[S.can].wet * 100) + '%';
  });
  $('#harvestAll').hidden = !S.basket || !S.tiles.some(t => t.p && t.prog >= total(P[t.p]));
}
function renderBar() {
  const items = [
    ['hand', '\u{1F9E4}', 'Hand - harvest'], ['can', '\u{1F4A7}', CANS[S.can].name], ['shovel', '\u{1F944}', 'Trowel - dig up'],
  ];
  let h = items.map(([id, ic, tt]) => `<button class="slot ${tool === id ? 'on' : ''}" data-tool="${id}" title="${tt}">${ic}</button>`).join('');
  h += `<button class="slot ${tool === 'compost' ? 'on' : ''}" data-tool="compost" title="Compost - 2x growth">\u{1F342}<small>${S.compost}</small></button>`;
  for (const n of ORDER) if (S.seeds[n] > 0)
    h += `<button class="slot ${tool === 'seed:' + n ? 'on' : ''}" data-tool="seed:${n}" title="${P[n].seedName}"><img src="${seedIcon(n)}" alt=""><small>${S.seeds[n]}</small></button>`;
  $('#bar').innerHTML = h;
  const hints = { hand: 'Tap a glowing plant to harvest it.', can: 'Water the soil. Plants only grow while the soil is wet.', shovel: 'Dig up a plant (it is lost).', compost: 'Tap a growing plant to make it grow 2x faster for a while.' };
  $('#hint').textContent = tool.startsWith('seed:') ? `Tap empty soil to sow ${P[tool.slice(5)].seedName}.` : hints[tool];
}
function harvest(i) {
  const t = S.tiles[i], pl = P[t.p];
  const kg = +(pl.mweight + Math.random() * (pl.maweight - pl.mweight)).toFixed(2);
  const e = S.produce[pl.name] || (S.produce[pl.name] = { count: 0, kg: 0 });
  e.count++; e.kg = +(e.kg + kg).toFixed(2);
  if (pl.type === 'sh') { t.p = null; t.prog = 0; } else t.prog = pl.sgrowth;
  return kg;
}
function useTile(i, drag) {
  const t = S.tiles[i], pl = t.p && P[t.p];
  const ready = pl && t.prog >= total(pl);
  if (ready && (tool === 'hand' || tool.startsWith('seed:'))) { const kg = harvest(i); toast(`Harvested ${fmt(kg)} kg of ${pl.name}!`); return; }
  if (tool === 'hand') { if (!drag) toast(pl ? `${pl.name}: ${Math.floor(t.prog / total(pl) * 100)}% grown` : 'Pick a seed below, then tap soil to sow.'); }
  else if (tool === 'can') { t.wet = CANS[S.can].wet; }
  else if (tool === 'shovel') { if (pl && !drag) { t.p = null; t.prog = 0; toast('Dug up.'); } }
  else if (tool === 'compost') {
    if (pl && !ready) { if (S.compost > 0) { S.compost--; t.fert = 90; renderBar(); } else toast('Out of compost - visit the Tool Shop.'); }
  } else if (tool.startsWith('seed:')) {
    const n = tool.slice(5);
    if (!pl && S.seeds[n] > 0) {
      t.p = n; t.prog = 0; S.seeds[n]--;
      if (S.seeds[n] <= 0) { delete S.seeds[n]; tool = 'can'; toast('Out of seeds - now water it!'); }
      renderBar();
    } else if (pl && !drag) toast('Something is already growing here.');
  }
  paint(); save();
}

/* ---------- pages ---------- */
function renderPage() {
  const gardenOn = view === 'garden';
  $('#garden').hidden = !gardenOn; $('#page').hidden = gardenOn;
  document.querySelectorAll('#tabs button').forEach(b => b.classList.toggle('on', b.dataset.view === view));
  if (gardenOn) { renderBar(); paint(); return; }
  const pg = $('#page');
  if (view === 'inv') {
    const seeds = ORDER.filter(n => S.seeds[n] > 0), prod = ORDER.filter(n => S.produce[n] && S.produce[n].count > 0);
    const totalV = prod.reduce((a, n) => a + Math.round(S.produce[n].kg * P[n].price), 0);
    pg.innerHTML = `<h2>Inventory</h2><h3>Seeds</h3>` +
      (seeds.length ? seeds.map(n => `<div class="card"><img class="ico" src="${seedIcon(n)}"><div class="cb"><h3>${P[n].seedName}</h3></div><b>x${S.seeds[n]}</b></div>`).join('') : '<div class="empty">No seeds. Visit the Seed Shop!</div>') +
      `<h2>Harvest <button class="sell-all" data-sellall ${prod.length ? '' : 'disabled'}>Sell all ${kochu(totalV)}</button></h2>` +
      (prod.length ? prod.map(n => { const e = S.produce[n], v = Math.round(e.kg * P[n].price);
        return `<div class="card"><img class="ico" src="${cropIcon(n)}"><div class="cb"><h3>${n}</h3><div class="meta"><span>${e.count} harvested</span><span>${fmt(e.kg)} kg</span><span>${kochu(P[n].price)}/kg</span></div></div><button data-sell="${n}">Sell ${kochu(v)}</button></div>`; }).join('') : '<div class="empty">Nothing harvested yet.</div>') +
      `<h2>Tools</h2><div class="card"><div class="ico" style="font-size:2rem;text-align:center">\u{1F4A7}</div><div class="cb"><h3>${CANS[S.can].name}</h3><div class="meta">Keeps soil wet for ${CANS[S.can].wet}s</div></div></div>` +
      `<div class="card"><div class="ico" style="font-size:2rem;text-align:center">\u{1F342}</div><div class="cb"><h3>Compost</h3><div class="meta">2x growth for 90s per use</div></div><b>x${S.compost}</b></div>` +
      (S.basket ? `<div class="card"><div class="ico" style="font-size:2rem;text-align:center">\u{1F9FA}</div><div class="cb"><h3>Harvest Basket</h3><div class="meta">Harvest every ready plant at once</div></div></div>` : '');
  } else if (view === 'seeds') {
    pg.innerHTML = `<h2>Seed Shop <small>Restocks in <span id="rt"></span>s</small></h2>` + ORDER.map(n => {
      const pl = P[n], q = S.shop.stock[n] || 0;
      return `<div class="card"><img class="ico" src="${seedIcon(n)}"><div class="cb"><h3>${pl.seedName} <span class="tag ${pl.type}">${pl.type === 'sh' ? 'single harvest' : 'multi harvest'}</span></h3><div class="desc">${md(pl.description)}</div>
      <div class="meta"><span>Sells ${kochu(pl.price)}/kg</span><span>${fmt(pl.mweight)}-${fmt(pl.maweight)} kg</span><span>Grows in ${pl.sgrowth + pl.pgrowth}s</span>${pl.type === 'mh' ? `<span>Again every ${pl.pgrowth}s</span>` : ''}</div></div>
      <div class="buy">${kochu(pl.seedprice)}<span>${q ? 'In stock: ' + q : 'Sold out'}</span><button data-buy="${n}" data-q="1" ${q && S.kochu >= pl.seedprice ? '' : 'disabled'}>Buy 1</button><button data-buy="${n}" data-q="5" ${q >= 5 && S.kochu >= pl.seedprice * 5 ? '' : 'disabled'}>Buy 5</button></div></div>`; }).join('');
  } else if (view === 'tools') {
    const next = CANS[S.can + 1], expCost = 50 * (S.size - 3) ** 2 + 30;
    const row = (ic, name, desc, price, attr, can) => `<div class="card"><div class="ico" style="font-size:2rem;text-align:center">${ic}</div><div class="cb"><h3>${name}</h3><div class="desc">${desc}</div></div><div class="buy">${kochu(price)}<button ${attr} ${can ? '' : 'disabled'}>Buy</button></div></div>`;
    pg.innerHTML = `<h2>Tool Shop</h2>` +
      (next ? row('\u{1F4A7}', next.name, `Soil stays wet for ${next.wet}s per watering.`, next.cost, 'data-tbuy="can"', S.kochu >= next.cost) : '') +
      row('\u{1F342}', 'Compost x1', 'Tap a growing plant for 2x growth speed (90s).', 12, 'data-tbuy="compost1"', S.kochu >= 12) +
      row('\u{1F342}', 'Compost x5', 'A bag of five. Cheaper per scoop.', 50, 'data-tbuy="compost5"', S.kochu >= 50) +
      (S.size < MAXSIZE ? row('\u{1F33F}', `Bigger Garden (${S.size + 1}x${S.size + 1})`, 'Adds a row and a column of fresh soil.', expCost, 'data-tbuy="plot"', S.kochu >= expCost) : '') +
      (!S.basket ? row('\u{1F9FA}', 'Harvest Basket', 'Adds a button that harvests every ready plant at once.', 300, 'data-tbuy="basket"', S.kochu >= 300) : '');
  }
}

/* ---------- events ---------- */
function resize(n) {
  const old = S.size, nt = mkTiles(n);
  for (let r = 0; r < old; r++) for (let c = 0; c < old; c++) nt[r * n + c] = S.tiles[r * old + c];
  S.tiles = nt; S.size = n;
}
function spend(c) { if (S.kochu < c) { toast('Not enough Kochu.'); return false; } S.kochu -= c; return true; }
function sell(n) { const e = S.produce[n]; if (!e) return 0; const v = Math.round(e.kg * P[n].price); delete S.produce[n]; S.kochu += v; return v; }

document.addEventListener('click', ev => {
  const b = ev.target.closest('button'); if (!b || !S) return;
  const d = b.dataset;
  if (d.view) { view = d.view; renderPage(); }
  else if (d.tool) { tool = d.tool; renderBar(); }
  else if (b.id === 'harvestAll') {
    let n = 0; S.tiles.forEach((t, i) => { if (t.p && t.prog >= total(P[t.p])) { harvest(i); n++; } });
    toast(`Harvested ${n} plant${n === 1 ? '' : 's'}!`); paint();
  } else if (d.buy) {
    const pl = P[d.buy], q = Math.min(+d.q, S.shop.stock[d.buy] || 0);
    if (q > 0 && spend(q * pl.seedprice)) { S.shop.stock[d.buy] -= q; S.seeds[d.buy] = (S.seeds[d.buy] || 0) + q; toast(`Bought ${q} ${pl.seedName}`); renderPage(); }
  } else if (d.sell) { toast(`Sold for ${sell(d.sell)} Kochu`); renderPage(); }
  else if ('sellall' in d) { let v = 0; for (const n of Object.keys(S.produce)) v += sell(n); toast(`Sold everything for ${v} Kochu`); renderPage(); }
  else if (d.tbuy) {
    const k = d.tbuy;
    if (k === 'can') { if (spend(CANS[S.can + 1].cost)) { S.can++; toast(`You got the ${CANS[S.can].name}!`); } }
    else if (k === 'compost1') { if (spend(12)) S.compost += 1; }
    else if (k === 'compost5') { if (spend(50)) S.compost += 5; }
    else if (k === 'plot') { if (spend(50 * (S.size - 3) ** 2 + 30)) { resize(S.size + 1); toast('Your garden grew!'); } }
    else if (k === 'basket') { if (spend(300)) { S.basket = true; toast('Harvest Basket unlocked!'); } }
    renderPage();
  }
  save();
});

let dragging = false;
const tileAt = e => { const el = document.elementFromPoint(e.clientX, e.clientY); const t = el && el.closest('.tile'); return t ? +t.dataset.i : -1; };
document.addEventListener('pointerdown', e => { const i = e.target.closest('#grid') ? tileAt(e) : -1; if (i >= 0) { dragging = true; useTile(i, false); } });
document.addEventListener('pointermove', e => { if (dragging && tool === 'can') { const i = tileAt(e); if (i >= 0) useTile(i, true); } });
document.addEventListener('pointerup', () => dragging = false);
document.addEventListener('pointercancel', () => dragging = false);

/* ---------- launch / loop ---------- */
function startGame(s) {
  S = s;
  for (const t of S.tiles) if (t.p && !P[t.p]) { t.p = null; t.prog = 0; }
  for (const k of Object.keys(S.seeds)) if (!P[k]) delete S.seeds[k];
  if (!S.shop.next) restock(true);
  tick(Math.min((Date.now() - S.last) / 1000, OFFLINE_CAP));
  lastT = Date.now(); gridSize = 0; view = 'garden'; tool = 'hand';
  $('#launch').hidden = true; $('#game').hidden = false;
  renderPage();
  if (!started) {
    started = true;
    setInterval(() => {
      const now = Date.now(), dt = (now - lastT) / 1000; lastT = now;
      tick(dt);
      if (view === 'garden') paint();
      $('#kochu').textContent = Math.round(S.kochu);
      const rt = $('#rt'); if (rt) rt.textContent = Math.max(0, Math.ceil((S.shop.next - now) / 1000));
    }, 250);
    setInterval(save, 5000);
    window.addEventListener('beforeunload', save);
    document.addEventListener('visibilitychange', () => { if (document.hidden) save(); });
  }
  $('#kochu').textContent = Math.round(S.kochu);
}

(async function init() {
  await loadPlants();
  $('#parade').innerHTML = ORDER.map(n => `<img src="${cropIcon(n)}" alt="${n}" style="animation-delay:${(Math.random() * 2).toFixed(2)}s">`).join('');
  const has = !!loadSave();
  $('#play').textContent = has ? 'Continue Gardening' : 'Start Gardening';
  $('#newgame').hidden = !has;
  $('#play').onclick = () => startGame(loadSave() || fresh());
  $('#newgame').onclick = () => { if (confirm('Start a brand new garden? Your old one will be lost.')) startGame(fresh()); };
})();
