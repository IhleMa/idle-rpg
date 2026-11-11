// Auction House: browse/search/filter, price history, selling with fees, own listings and history.
import { h, fmt, duration, itemSlotEl, itemDetails, rarityColor, modal, toast, confirmDialog, timeAgo } from '../ui.js';
import { act, store, serverNow } from '../main.js';
import { get, requestId } from '../api.js';
import { RARITIES, RARITY_INFO, SLOT_LABELS, ALL_SLOTS } from '/shared/data/items.js';
import { STATS } from '/shared/data/stats.js';

export const live = false;
const CATEGORIES = ['weapon', 'armor', 'offhand', 'jewelry', 'tool', 'wood', 'ore', 'gem', 'material', 'herb', 'hide', 'fish', 'relic', 'essence', 'consumable'];
const ui = { tab: 'browse', f: { search: '', category: '', itemType: '', minRarity: '', minLevel: '', maxLevel: '', stat: '', sort: 'price_asc', page: 0 }, sell: null };
let results = null;
let mine = null;
let root = null;

const redraw = () => { if (root?.isConnected) root.replaceWith(build(store.state)); };

async function search() {
  const qs = new URLSearchParams(Object.entries(ui.f).filter(([, v]) => v !== '' && v !== null)).toString();
  try { results = await get(`/market?${qs}`); } catch (e) { toast(e.message, 'error'); }
  redraw();
}
async function loadMine() {
  try { mine = await get('/market/mine'); } catch (e) { toast(e.message, 'error'); }
  redraw();
}

function sparkline(trend) {
  if (!trend.length) return h('span', { class: 'muted small' }, 'No sales in the last 14 days');
  const w = 260; const hgt = 60;
  const max = Math.max(...trend.map((t) => t.avg));
  const min = Math.min(...trend.map((t) => t.avg));
  const pts = trend.map((t) => `${((13 - t.daysAgo) / 13) * w},${hgt - 6 - ((t.avg - min) / (max - min || 1)) * (hgt - 12)}`).join(' ');
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', `0 0 ${w} ${hgt}`); svg.setAttribute('class', 'spark');
  svg.innerHTML = `<polyline points="${pts}" fill="none" stroke="currentColor" stroke-width="2"/>`;
  return h('div', {}, svg, h('div', { class: 'small muted' }, `14-day range ${fmt(min)}–${fmt(max)} gold`));
}

async function priceInfo(marketKey, name) {
  try {
    const s = await get(`/market/stats/${encodeURIComponent(marketKey)}`);
    return h('div', { class: 'price-info' },
      h('div', { class: 'rates' },
        h('div', {}, h('span', { class: 'muted' }, 'Lowest now'), h('b', {}, s.lowestPrice ? fmt(s.lowestPrice) : '—')),
        h('div', {}, h('span', { class: 'muted' }, '7-day average'), h('b', {}, s.avgPrice7d ? fmt(s.avgPrice7d) : '—')),
        h('div', {}, h('span', { class: 'muted' }, 'Active listings'), h('b', {}, `${s.activeListings} (${fmt(s.activeQuantity)})`)),
        h('div', {}, h('span', { class: 'muted' }, 'Sold (7d)'), h('b', {}, fmt(s.volume7d)))),
      sparkline(s.trend),
      s.recentSales.length ? h('div', { class: 'small' }, h('b', {}, 'Recent sales'), s.recentSales.map((r) => h('div', { class: 'muted' }, `${r.quantity}x ${r.item_name} @ ${fmt(r.unit_price)} · ${timeAgo(r.created_at)}`))) : null);
  } catch { return h('div', { class: 'muted' }, `No price data for ${name}.`); }
}

async function buy(l) {
  const c = store.state.character;
  let qty = 1;
  const qtyIn = l.quantity > 1 ? h('input', { type: 'number', min: 1, max: l.quantity, value: 1, class: 'qty-input' }) : null;
  const totalEl = h('b', {}, fmt(l.unitPrice));
  if (qtyIn) qtyIn.oninput = () => { qty = Math.max(1, Math.min(l.quantity, Number(qtyIn.value) || 1)); totalEl.textContent = fmt(qty * l.unitPrice); };
  const m = modal(`Buy ${l.name}`, h('div', {},
    itemDetails(l.item, { classId: c.class, charLevel: c.level }),
    h('p', {}, `Seller: ${l.seller} · ${fmt(l.unitPrice)} gold${l.quantity > 1 ? ' each' : ''}`),
    qtyIn ? h('div', { class: 'row gap center-v' }, 'Quantity', qtyIn, h('span', { class: 'muted' }, `of ${l.quantity}`)) : null,
    h('p', {}, 'Total: ', totalEl, ` gold (you have ${fmt(c.gold)})`),
    h('div', { class: 'row end gap' },
      h('button', { class: 'btn ghost', onclick: () => m.close() }, 'Cancel'),
      h('button', { class: 'btn primary', onclick: async () => {
        m.close();
        const r = await act('/market/buy', { listingId: l.id, quantity: qty, requestId: requestId() }, { success: (x) => `Bought for ${fmt(x.total)} gold`, rerender: false });
        void r;
        search();
      } }, 'Buy now'))));
}

function browseTab(state) {
  const f = ui.f;
  const input = (key, attrs) => {
    const el = h('input', { value: f[key], ...attrs });
    el.addEventListener('change', () => { f[key] = el.value; f.page = 0; search(); });
    return el;
  };
  const select = (key, options, label) => h('select', { onchange: (e) => { f[key] = e.target.value; f.page = 0; search(); } },
    h('option', { value: '' }, label), options.map(([v, l]) => h('option', { value: v, selected: f[key] === v }, l)));
  const filters = h('div', { class: 'market-filters panel' },
    input('search', { placeholder: 'Search items…' }),
    select('category', CATEGORIES.map((c) => [c, c[0].toUpperCase() + c.slice(1)]), 'Any category'),
    select('itemType', ALL_SLOTS.filter((s) => s !== 'ring2').map((s) => [s === 'ring1' ? 'ring' : s, SLOT_LABELS[s]]), 'Any slot'),
    select('minRarity', RARITIES.map((r) => [r, `${RARITY_INFO[r].name}+`]), 'Any rarity'),
    h('div', { class: 'row gap' }, input('minLevel', { placeholder: 'Min lvl', type: 'number', class: 'num' }), input('maxLevel', { placeholder: 'Max lvl', type: 'number', class: 'num' })),
    select('stat', Object.keys(STATS).map((k) => [k, `Has ${STATS[k].label}${STATS[k].pct ? ' %' : ''}`]), 'Any stat / affix'),
    select('sort', [['price_asc', 'Lowest price'], ['price_desc', 'Highest price'], ['ilvl_desc', 'Highest item level'], ['ilvl_asc', 'Lowest item level'], ['rarity_desc', 'Rarity'], ['newest', 'Newest'], ['ending', 'Ending soon']], 'Sort'),
    h('button', { class: 'btn ghost small', onclick: () => { Object.assign(f, { search: '', category: '', itemType: '', minRarity: '', minLevel: '', maxLevel: '', stat: '', sort: 'price_asc', page: 0 }); search(); } }, 'Reset'));
  if (!results) { search(); return h('div', {}, filters, h('p', { class: 'muted' }, 'Loading…')); }
  const c = state.character;
  const rows = results.listings.map((l) => h('tr', {},
    h('td', {}, itemSlotEl(l.item, { cls: 'mini', tooltip: { classId: c.class, charLevel: c.level } })),
    h('td', {}, h('a', { href: '#', style: { color: rarityColor(l.rarity) }, onclick: async (e) => { e.preventDefault(); modal(`Price history: ${l.name}`, await priceInfo(l.marketKey, l.name)); } }, l.name),
      l.item.kind === 'equipment' ? h('div', { class: 'small muted' }, `ilvl ${l.ilvl} · req ${l.req_level} · ${l.item.affixes.map((a) => a.name).filter((n) => n !== 'Unique').join(', ') || 'no affixes'}`) : null),
    h('td', { class: 'num' }, fmt(l.quantity)),
    h('td', { class: 'num' }, h('b', {}, fmt(l.unitPrice)), l.quantity > 1 ? h('div', { class: 'small muted' }, 'each') : null),
    h('td', { class: 'small' }, l.seller),
    h('td', { class: 'small muted' }, h('span', { dataset: { countdown: l.expiresAt } }, duration(l.expiresAt - serverNow()))),
    h('td', {}, l.sellerId === c.id ? h('span', { class: 'muted small' }, 'yours') : h('button', { class: 'btn small primary', onclick: () => buy(l) }, 'Buy'))));
  return h('div', {}, filters,
    h('section', { class: 'panel' }, results.listings.length ? h('table', { class: 'market-table' },
      h('thead', {}, h('tr', {}, h('th', {}, ''), h('th', {}, 'Item'), h('th', {}, 'Qty'), h('th', {}, 'Price'), h('th', {}, 'Seller'), h('th', {}, 'Time left'), h('th', {}, ''))),
      h('tbody', {}, rows)) : h('p', { class: 'muted' }, 'No listings match your filters. Prices are set entirely by players — list something!'),
    h('div', { class: 'row gap end mt' },
      f.page > 0 ? h('button', { class: 'btn small ghost', onclick: () => { f.page--; search(); } }, '← Prev') : null,
      results.hasMore ? h('button', { class: 'btn small ghost', onclick: () => { f.page++; search(); } }, 'Next →') : null)));
}

function sellTab(state) {
  const c = state.character;
  const sellable = state.inventory.filter((i) => !i.bound);
  if (store.sellItemId) { ui.sell = { itemId: store.sellItemId }; store.sellItemId = null; }
  const selected = ui.sell && sellable.find((i) => i.id === ui.sell.itemId);
  const grid = h('div', { class: 'inv-grid compact' }, sellable.map((it) => {
    const el = itemSlotEl(it, { tooltip: { classId: c.class, charLevel: c.level } });
    if (selected?.id === it.id) el.classList.add('selected');
    el.onclick = () => { ui.sell = { itemId: it.id }; redraw(); };
    return h('div', { class: 'inv-cell' }, el);
  }));
  let form = h('p', { class: 'muted' }, 'Select an item from your inventory. Equipped and bound items cannot be sold.');
  if (selected) {
    const cfg = mine?.config || { feeRatePerDay: 0.02, taxRate: 0.05, durations: [12, 24, 48] };
    const qty = h('input', { type: 'number', min: 1, max: selected.quantity, value: selected.quantity, class: 'qty-input' });
    const price = h('input', { type: 'number', min: 1, value: ui.sell.price || '', placeholder: 'Price', class: 'num' });
    const dur = h('select', {}, cfg.durations.map((d) => h('option', { value: d, selected: d === 24 }, `${d} hours`)));
    const fee = h('div', { class: 'small' });
    const upd = () => {
      const total = (Number(price.value) || 0) * (selected.kind === 'equipment' ? 1 : Number(qty.value) || 0);
      const f = Math.max(1, Math.round(total * cfg.feeRatePerDay * (Number(dur.value) / 24)));
      const tax = Math.max(1, Math.round(total * cfg.taxRate));
      fee.replaceChildren(`Listing fee (paid now): ${fmt(f)} gold · Sales tax ${Math.round(cfg.taxRate * 100)}%: ${fmt(tax)} gold · You receive: `, h('b', {}, fmt(Math.max(0, total - tax))), ' gold');
    };
    for (const el of [qty, price, dur]) el.addEventListener('input', upd);
    upd();
    const info = h('div', {}, h('p', { class: 'muted small' }, 'Loading prices…'));
    priceInfo(selected.base, selected.name).then((el) => info.replaceChildren(h('h3', {}, 'Market prices'), el));
    form = h('div', { class: 'sell-form' },
      itemDetails(selected, { classId: c.class, charLevel: c.level }),
      info,
      h('div', { class: 'row gap wrap center-v mt' },
        selected.kind !== 'equipment' ? h('label', {}, 'Quantity ', qty) : null,
        h('label', {}, `Price ${selected.kind !== 'equipment' ? 'per unit' : ''} `, price),
        h('label', {}, 'Duration ', dur)),
      fee,
      h('button', { class: 'btn primary mt', onclick: async () => {
        const unitPrice = Number(price.value);
        if (!unitPrice) return toast('Set a price.', 'error');
        const n = selected.kind === 'equipment' ? 1 : Number(qty.value);
        if (!(await confirmDialog('Confirm listing', `List ${n}x ${selected.name} for ${fmt(unitPrice)} gold${n > 1 ? ' each' : ''} for ${dur.value} hours?`, 'List item'))) return;
        const r = await act('/market/list', { itemId: selected.id, quantity: n, unitPrice, hours: Number(dur.value), requestId: requestId() }, { success: 'Item listed!', rerender: false });
        if (r) { ui.sell = null; mine = null; results = null; redraw(); }
      } }, 'List on Auction House'));
  }
  if (!mine) loadMine();
  return h('div', { class: 'sell-layout' },
    h('section', { class: 'panel' }, h('h2', {}, 'Your items'), grid),
    h('section', { class: 'panel' }, h('h2', {}, 'Create listing'), form, mine ? h('p', { class: 'small muted' }, `Active listings: ${mine.listings.length}/${mine.maxListings} (limit grows with level)`) : null));
}

function mineTab(state) {
  if (!mine) { loadMine(); return h('p', { class: 'muted' }, 'Loading…'); }
  const c = state.character;
  return h('div', {},
    h('section', { class: 'panel' }, h('div', { class: 'panel-head' }, h('h2', {}, 'Proceeds'),
      state.pendingPayout ? h('button', { class: 'btn primary', onclick: async () => { if (await act('/market/collect', {}, { success: (g) => `Collected ${fmt(g)} gold`, rerender: false })) loadMine(); } }, `Collect ${fmt(state.pendingPayout)} gold`) : h('span', { class: 'muted' }, 'Nothing to collect'))),
    h('section', { class: 'panel' }, h('h2', {}, `Active listings (${mine.listings.length}/${mine.maxListings})`),
      mine.listings.length ? h('table', { class: 'market-table' }, h('tbody', {}, mine.listings.map((l) => h('tr', {},
        h('td', {}, itemSlotEl(l.item, { cls: 'mini', tooltip: { classId: c.class } })),
        h('td', { style: { color: rarityColor(l.rarity) } }, l.name),
        h('td', { class: 'num' }, `${fmt(l.quantity)}/${fmt(l.originalQty)}`),
        h('td', { class: 'num' }, fmt(l.unitPrice)),
        h('td', { class: 'small muted' }, h('span', { dataset: { countdown: l.expiresAt } }, duration(l.expiresAt - serverNow()))),
        h('td', {}, h('button', { class: 'btn small ghost', onclick: async () => {
          if (!(await confirmDialog('Cancel listing', `Cancel ${l.name}? The item returns to your inventory; the listing fee is not refunded.`, 'Cancel listing'))) return;
          if (await act('/market/cancel', { listingId: l.id }, { success: 'Listing cancelled', rerender: false })) loadMine();
        } }, 'Cancel')))))) : h('p', { class: 'muted' }, 'You have no active listings.')));
}

function historyTab() {
  if (!mine) { loadMine(); return h('p', { class: 'muted' }, 'Loading…'); }
  return h('section', { class: 'panel' }, h('h2', {}, 'Transaction history'),
    mine.history.length ? h('table', { class: 'market-table' }, h('thead', {}, h('tr', {}, ['', 'Item', 'Qty', 'Unit', 'Total', 'Tax', 'With', 'When'].map((t) => h('th', {}, t)))),
      h('tbody', {}, mine.history.map((t) => h('tr', {},
        h('td', { class: t.side === 'sold' ? 'good' : 'bad' }, t.side === 'sold' ? 'Sold' : 'Bought'),
        h('td', { style: { color: rarityColor(t.rarity) } }, t.itemName), h('td', { class: 'num' }, t.quantity), h('td', { class: 'num' }, fmt(t.unitPrice)),
        h('td', { class: 'num' }, fmt(t.total)), h('td', { class: 'num muted' }, t.side === 'sold' ? fmt(t.tax) : '—'), h('td', {}, t.counterparty), h('td', { class: 'small muted' }, timeAgo(t.createdAt)))))) : h('p', { class: 'muted' }, 'No transactions yet.'));
}

function build(state) {
  const tabs = [['browse', 'Browse'], ['sell', 'Sell'], ['mine', 'My listings'], ['history', 'History']];
  const body = ui.tab === 'browse' ? browseTab(state) : ui.tab === 'sell' ? sellTab(state) : ui.tab === 'mine' ? mineTab(state) : historyTab();
  root = h('div', {},
    h('div', { class: 'page-head' }, h('h1', {}, 'Auction House'), h('p', { class: 'muted' }, 'A shared, player-driven market. Every purchase is processed atomically on the server. Sellers pay a small listing fee; a 5% sales tax is taken from proceeds.')),
    h('div', { class: 'tabs' }, tabs.map(([id, label]) => h('button', { class: `tab ${ui.tab === id ? 'active' : ''}`, onclick: () => { ui.tab = id; if (id !== 'browse') mine = null; redraw(); } }, label)),
      state.pendingPayout ? h('button', { class: 'tab gold-glow', onclick: () => { ui.tab = 'mine'; mine = null; redraw(); } }, `💰 ${fmt(state.pendingPayout)}`) : null),
    body);
  return root;
}

export function render(state) {
  if (store.sellItemId) ui.tab = 'sell';
  if (state.character.level < 3) return h('section', { class: 'panel' }, h('h1', {}, 'Auction House'), h('p', {}, 'The Auction House opens at level 3.'));
  return build(state);
}
