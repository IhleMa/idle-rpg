// DOM helpers, formatting, tooltips, toasts and modals. No game rules live here.
import { BASE_TYPES, CONSUMABLES, RARITY_INFO, SLOT_LABELS, SETS, UNIQUES } from '/shared/data/items.js';
import { RESOURCES } from '/shared/data/resources.js';
import { STATS, formatStat } from '/shared/data/stats.js';
import { itemStats } from '/shared/rules.js';

export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === undefined || v === null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'dataset') Object.assign(el.dataset, v);
    else if (v === true) el.setAttribute(k, '');
    else el.setAttribute(k, v);
  }
  for (const c of children.flat(Infinity)) {
    if (c === null || c === undefined || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

export const fmt = (n) => (n === null || n === undefined ? '—' : Math.round(n).toLocaleString());
export const spct = (n, d = 1) => `${n >= 0 ? '+' : ''}${pct(n, d)}`;
export const pct = (n, d = 1) => `${(Math.round(n * 1000 * 10 ** (d - 1)) / (10 ** (d - 1) * 10)).toFixed(d)}%`;

export function duration(ms) {
  if (ms <= 0) return '0s';
  const s = Math.ceil(ms / 1000);
  const d = Math.floor(s / 86400);
  const hh = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (d) return `${d}d ${hh}h`;
  if (hh) return `${hh}h ${m}m`;
  if (m) return `${m}m ${sec}s`;
  return `${sec}s`;
}

export function timeAgo(t) {
  const s = Math.floor((Date.now() - t) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export function rarityColor(r) { return RARITY_INFO[r]?.color || '#ccc'; }

export function itemIcon(item) {
  if (item.kind === 'equipment') return BASE_TYPES[item.base]?.icon || '❔';
  if (item.kind === 'consumable') return CONSUMABLES[item.base]?.icon || '🧪';
  return RESOURCES[item.base]?.icon || '📦';
}

export function itemTypeLabel(item) {
  if (item.kind === 'resource') return `Material · ${RESOURCES[item.base]?.category || ''}`;
  if (item.kind === 'consumable') return 'Consumable';
  const b = BASE_TYPES[item.base];
  return `${b.name} · ${SLOT_LABELS[b.slot] || 'Ring'}`;
}

export function progressBar(value, max, { cls = '', label = '' } = {}) {
  const p = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  return h('div', { class: `bar ${cls}` }, h('div', { class: 'bar-fill', style: { width: `${p}%` } }), label ? h('span', { class: 'bar-label' }, label) : null);
}

// ----- Toasts -----
export function toast(msg, type = 'info') {
  const t = h('div', { class: `toast toast-${type}` }, msg);
  document.getElementById('toasts').append(t);
  setTimeout(() => t.classList.add('show'), 10);
  setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 300); }, type === 'error' ? 4500 : 3200);
}

// ----- Modal -----
export function modal(title, body, { wide = false, onClose } = {}) {
  const root = document.getElementById('modal-root');
  const close = () => { wrap.remove(); onClose?.(); };
  const wrap = h('div', { class: 'modal-wrap', onclick: (e) => { if (e.target === wrap) close(); } },
    h('div', { class: `modal panel ${wide ? 'wide' : ''}` },
      h('div', { class: 'modal-head' }, h('h2', {}, title), h('button', { class: 'btn ghost', onclick: close, 'aria-label': 'Close' }, '✕')),
      h('div', { class: 'modal-body' }, body)));
  root.append(wrap);
  return { close, el: wrap };
}

export function confirmDialog(title, text, okLabel = 'Confirm') {
  return new Promise((resolve) => {
    let done = false;
    const m = modal(title, h('div', {},
      h('p', {}, text),
      h('div', { class: 'row end gap' },
        h('button', { class: 'btn ghost', onclick: () => { done = true; m.close(); resolve(false); } }, 'Cancel'),
        h('button', { class: 'btn primary', onclick: () => { done = true; m.close(); resolve(true); } }, okLabel))),
    { onClose: () => { if (!done) resolve(false); } });
  });
}

// ----- Item tooltips -----
const tip = () => document.getElementById('tooltip');

export function statLines(stats) {
  return Object.entries(stats).filter(([, v]) => v).map(([k, v]) => h('div', { class: 'stat-line' }, formatStat(k, v)));
}

export function itemDetails(item, { compareTo = null, classId = null, charLevel = null } = {}) {
  const color = rarityColor(item.rarity);
  const parts = [
    h('div', { class: 'tt-name', style: { color } }, item.name, item.quantity > 1 ? h('span', { class: 'muted' }, ` x${fmt(item.quantity)}`) : null),
    h('div', { class: 'tt-sub' }, `${RARITY_INFO[item.rarity]?.name || ''} ${itemTypeLabel(item)}`),
  ];
  if (item.kind === 'equipment') {
    const b = BASE_TYPES[item.base];
    parts.push(h('div', { class: 'tt-sub' }, `Item level ${item.ilvl} · `,
      h('span', { class: charLevel !== null && item.req_level > charLevel ? 'bad' : '' }, `Requires level ${item.req_level}`)));
    parts.push(h('div', { class: 'tt-section' }, statLines(item.stats)));
    if (b.classes?.length) parts.push(h('div', { class: `tt-syn ${classId && b.classes.includes(classId) ? 'good' : 'muted'}` }, `Class synergy (+10% base stats): ${b.classes.join(', ')}`));
    if (item.affixes?.length) {
      parts.push(h('div', { class: 'tt-section' }, item.affixes.map((a) => h('div', { class: `affix ${a.kind}` },
        h('span', { class: 'affix-name' }, a.kind === 'special' ? '★' : a.name), ' ', formatStat(a.stat, a.value), a.perfect ? h('span', { class: 'perfect' }, ' ✦ perfect') : null))));
    }
    if (item.set_id && SETS[item.set_id]) {
      const set = SETS[item.set_id];
      parts.push(h('div', { class: 'tt-set' }, h('b', {}, set.name), set.bonuses.map((bn) => h('div', {}, `(${bn.pieces}) `, Object.entries(bn.stats).map(([k, v]) => formatStat(k, v)).join(', ')))));
    }
    if (item.unique_id && UNIQUES[item.unique_id]?.bound || item.bound) parts.push(h('div', { class: 'muted' }, 'Bound — cannot be traded'));
    if (item.crafted_by) parts.push(h('div', { class: 'muted' }, `Crafted by ${item.crafted_by}`));
    if (compareTo !== undefined && compareTo !== null && compareTo.id !== item.id) {
      const a = itemStats(item, classId);
      const c = itemStats(compareTo, classId);
      const keys = [...new Set([...Object.keys(a), ...Object.keys(c)])];
      const diffs = keys.map((k) => [k, (a[k] || 0) - (c[k] || 0)]).filter(([, d]) => Math.abs(d) > 1e-6);
      parts.push(h('div', { class: 'tt-compare' }, h('div', { class: 'muted' }, `Compared to equipped ${compareTo.name}:`),
        diffs.length ? diffs.map(([k, d]) => h('div', { class: d > 0 ? 'good' : 'bad' }, formatStat(k, d))) : h('div', { class: 'muted' }, 'No difference')));
    } else if (compareTo === null && item.location !== 'equipped' && b) {
      parts.push(h('div', { class: 'tt-compare muted' }, 'Slot is empty — pure upgrade.'));
    }
  } else if (item.kind === 'consumable') {
    parts.push(h('div', { class: 'tt-section' }, CONSUMABLES[item.base]?.description));
  } else if (RESOURCES[item.base]?.rare) {
    parts.push(h('div', { class: 'tt-section rare-note' }, 'Rare material'));
  }
  return h('div', { class: 'item-details' }, parts);
}

export function attachTooltip(el, getContent) {
  el.addEventListener('mouseenter', (e) => {
    const t = tip();
    t.replaceChildren(getContent());
    t.classList.remove('hidden');
    position(e);
  });
  el.addEventListener('mousemove', position);
  el.addEventListener('mouseleave', () => tip().classList.add('hidden'));
  el.addEventListener('dragstart', () => tip().classList.add('hidden'));
}

function position(e) {
  const t = tip();
  const pad = 16;
  let x = e.clientX + pad;
  let y = e.clientY + pad;
  const r = t.getBoundingClientRect();
  if (x + r.width > window.innerWidth - 8) x = e.clientX - r.width - pad;
  if (y + r.height > window.innerHeight - 8) y = Math.max(8, window.innerHeight - r.height - 8);
  t.style.left = `${Math.max(8, x)}px`;
  t.style.top = `${y}px`;
}

export function hideTooltip() { tip().classList.add('hidden'); }

export function itemSlotEl(item, opts = {}) {
  const el = h('div', {
    class: `item-cell rarity-${item.rarity} ${opts.cls || ''}`,
    style: { '--rc': rarityColor(item.rarity) },
    draggable: opts.draggable ? 'true' : undefined,
  },
  h('span', { class: 'item-icon' }, itemIcon(item)),
  item.quantity > 1 ? h('span', { class: 'qty' }, item.quantity >= 10000 ? `${Math.floor(item.quantity / 1000)}k` : item.quantity) : null,
  item.kind === 'equipment' ? h('span', { class: 'ilvl' }, item.ilvl) : null);
  attachTooltip(el, () => itemDetails(item, opts.tooltip || {}));
  return el;
}

export function statLabel(k) { return STATS[k]?.label || k; }
