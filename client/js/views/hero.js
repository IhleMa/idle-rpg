// Hero: paper-doll equipment, tool slots, stats, attributes, abilities and the drag-and-drop inventory.
import { h, fmt, pct, spct, itemSlotEl, itemDetails, modal, toast, hideTooltip } from '../ui.js';
import { act, store, go } from '../main.js';
import { BASE_TYPES, TOOL_SLOTS, SLOT_LABELS, RARITIES, CONSUMABLES } from '/shared/data/items.js';
import { CLASSES } from '/shared/data/classes.js';
import { RACES } from '/shared/data/races.js';
import { formatStat } from '/shared/data/stats.js';
import { ATTRIBUTES, STATS } from '/shared/data/stats.js';

export const live = true;

const ui = { filter: 'all', sort: 'position', search: '' };
let dragged = null; // { type: 'inv'|'slot', item, slot }

const SLOT_ICONS = { helmet: '⛑️', chest: '🦺', gloves: '🧤', pants: '👖', boots: '🥾', weapon: '🗡️', offhand: '🛡️', necklace: '📿', ring1: '💍', ring2: '💍', accessory: '🧿', tool_axe: '🪓', tool_pickaxe: '⛏️', tool_sickle: '🌙', tool_bow: '🏹', tool_rod: '🎣' };

function accepts(slot, item) {
  if (!item || item.kind !== 'equipment') return false;
  const s = BASE_TYPES[item.base].slot;
  return s === 'ring' ? slot === 'ring1' || slot === 'ring2' : s === slot;
}

function equippedFor(item, equipped) {
  const s = BASE_TYPES[item.base]?.slot;
  if (!s) return undefined;
  if (s === 'ring') return equipped.find((e) => e.slot === 'ring1') || equipped.find((e) => e.slot === 'ring2') || null;
  return equipped.find((e) => e.slot === s) || null;
}

function slotEl(slot, state) {
  const c = state.character;
  const item = state.equipped.find((i) => i.slot === slot);
  const el = h('div', { class: `equip-slot ${item ? 'filled' : ''}`, dataset: { slot } },
    item ? itemSlotEl(item, { draggable: true, tooltip: { classId: c.class, charLevel: c.level } }) : h('div', { class: 'slot-empty' }, h('span', {}, SLOT_ICONS[slot])),
    h('div', { class: 'slot-label' }, SLOT_LABELS[slot]));
  if (item) {
    const cell = el.firstChild;
    cell.addEventListener('dragstart', (e) => { dragged = { type: 'slot', item, slot }; store.dragging = true; e.dataTransfer.setData('text/plain', `slot:${slot}`); e.dataTransfer.effectAllowed = 'move'; markTargets(); });
    cell.addEventListener('dragend', clearDrag);
    cell.addEventListener('click', () => itemMenu(item, state));
  }
  el.addEventListener('dragover', (e) => {
    if (!dragged || dragged.type !== 'inv') return;
    e.preventDefault();
    el.classList.toggle('drop-ok', accepts(slot, dragged.item) && dragged.item.req_level <= c.level);
    el.classList.toggle('drop-bad', !(accepts(slot, dragged.item) && dragged.item.req_level <= c.level));
  });
  el.addEventListener('dragleave', () => el.classList.remove('drop-ok', 'drop-bad'));
  el.addEventListener('drop', (e) => {
    e.preventDefault();
    el.classList.remove('drop-ok', 'drop-bad');
    if (!dragged || dragged.type !== 'inv') return;
    const it = dragged.item;
    clearDrag();
    if (!accepts(slot, it)) return toast(it.kind !== 'equipment' ? `${it.name} cannot be equipped.` : `${it.name} goes in the ${SLOT_LABELS[BASE_TYPES[it.base].slot] || 'Ring'} slot.`, 'error');
    if (it.req_level > c.level) return toast(`${it.name} requires level ${it.req_level}.`, 'error');
    act('/equip', { itemId: it.id, slot });
  });
  return el;
}

function markTargets() {
  hideTooltip();
  if (dragged?.type !== 'inv') return;
  for (const s of document.querySelectorAll('.equip-slot')) {
    const ok = accepts(s.dataset.slot, dragged.item);
    s.classList.toggle('highlight', ok && dragged.item.req_level <= store.state.character.level);
    s.classList.toggle('dim', !ok);
  }
}

function clearDrag() {
  dragged = null;
  store.dragging = false;
  for (const s of document.querySelectorAll('.equip-slot, .inv-cell')) s.classList.remove('highlight', 'dim', 'drop-ok', 'drop-bad');
}

function itemMenu(item, state) {
  const c = state.character;
  const equipped = item.location === 'equipped';
  const buttons = [];
  let m;
  const run = (fn) => async () => { m.close(); await fn(); };
  if (item.kind === 'equipment') {
    if (equipped) buttons.push(h('button', { class: 'btn', onclick: run(() => act('/unequip', { slot: item.slot })) }, 'Unequip'));
    else buttons.push(h('button', { class: 'btn primary', disabled: item.req_level > c.level ? true : undefined, onclick: run(() => act('/equip', { itemId: item.id })) }, item.req_level > c.level ? `Requires level ${item.req_level}` : 'Equip'));
  }
  if (item.kind === 'consumable' && CONSUMABLES[item.base].effect.type !== 'combat_heal') {
    buttons.push(h('button', { class: 'btn primary', onclick: run(() => act('/use', { itemId: item.id }, { success: (n) => `Used ${n}` })) }, 'Use'));
  }
  if (!equipped) {
    const qtyIn = item.quantity > 1 ? h('input', { type: 'number', min: 1, max: item.quantity, value: item.quantity, class: 'qty-input' }) : null;
    buttons.push(h('div', { class: 'row gap' }, qtyIn,
      h('button', { class: 'btn', onclick: run(() => act('/sell', { itemId: item.id, qty: qtyIn ? Number(qtyIn.value) : 1 }, { success: (g) => `Sold to the merchant for ${g} gold` })) }, 'Sell to merchant')));
    if (!item.bound) buttons.push(h('button', { class: 'btn', onclick: () => { m.close(); store.sellItemId = item.id; go('market'); } }, 'List on Auction House'));
  }
  m = modal(item.name, h('div', {}, itemDetails(item, { compareTo: equipped ? undefined : equippedFor(item, state.equipped), classId: c.class, charLevel: c.level }), h('div', { class: 'col gap mt' }, buttons)));
}

function inventoryPanel(state) {
  const c = state.character;
  const items = state.inventory;
  const filtered = ui.filter !== 'all' || ui.sort !== 'position' || ui.search;
  let list = items.filter((i) => {
    if (ui.search && !i.name.toLowerCase().includes(ui.search.toLowerCase())) return false;
    if (ui.filter === 'equipment') return i.kind === 'equipment' && !BASE_TYPES[i.base].slot.startsWith('tool_');
    if (ui.filter === 'tools') return i.kind === 'equipment' && BASE_TYPES[i.base].slot.startsWith('tool_');
    if (ui.filter === 'materials') return i.kind === 'resource';
    if (ui.filter === 'consumables') return i.kind === 'consumable';
    return true;
  });
  const rIdx = (r) => RARITIES.indexOf(r);
  if (ui.sort === 'rarity') list = [...list].sort((a, b) => rIdx(b.rarity) - rIdx(a.rarity) || b.ilvl - a.ilvl);
  if (ui.sort === 'level') list = [...list].sort((a, b) => b.ilvl - a.ilvl);
  if (ui.sort === 'name') list = [...list].sort((a, b) => a.name.localeCompare(b.name));
  if (ui.sort === 'type') list = [...list].sort((a, b) => a.kind.localeCompare(b.kind) || a.base.localeCompare(b.base));

  const grid = h('div', { class: 'inv-grid' });
  const byPos = new Map(items.map((i) => [i.position, i]));
  const cells = filtered ? list.map((it) => ({ pos: it.position, it })) : Array.from({ length: c.invSize }, (_, pos) => ({ pos, it: byPos.get(pos) }));
  for (const { pos, it } of cells) {
    const cell = h('div', { class: 'inv-cell', dataset: { pos } });
    if (it) {
      const el = itemSlotEl(it, { draggable: true, tooltip: { compareTo: it.kind === 'equipment' ? equippedFor(it, state.equipped) : undefined, classId: c.class, charLevel: c.level } });
      if (it.kind === 'equipment' && it.req_level > c.level) el.classList.add('too-high');
      el.addEventListener('dragstart', (e) => { dragged = { type: 'inv', item: it }; store.dragging = true; e.dataTransfer.setData('text/plain', `item:${it.id}`); e.dataTransfer.effectAllowed = 'move'; markTargets(); });
      el.addEventListener('dragend', clearDrag);
      el.addEventListener('click', () => itemMenu(it, state));
      el.addEventListener('dblclick', () => { if (it.kind === 'equipment') act('/equip', { itemId: it.id }); });
      cell.append(el);
    }
    cell.addEventListener('dragover', (e) => { if (dragged) { e.preventDefault(); cell.classList.add('drop-ok'); } });
    cell.addEventListener('dragleave', () => cell.classList.remove('drop-ok'));
    cell.addEventListener('drop', (e) => {
      e.preventDefault();
      cell.classList.remove('drop-ok');
      if (!dragged) return;
      const d = dragged;
      clearDrag();
      if (d.type === 'slot') act('/unequip', { slot: d.slot, position: filtered ? undefined : pos });
      else if (d.type === 'inv' && !filtered && d.item.position !== pos) act('/move', { itemId: d.item.id, position: pos });
    });
    grid.append(cell);
  }
  const used = items.length;
  const search = h('input', { placeholder: 'Search…', value: ui.search, class: 'small-input' });
  search.addEventListener('input', () => { ui.search = search.value; const g = inventoryPanel(store.state); document.querySelector('.inventory-panel').replaceWith(g); g.querySelector('input').focus(); });
  return h('section', { class: 'panel inventory-panel' },
    h('div', { class: 'panel-head' }, h('h2', {}, 'Inventory'), h('span', { class: `muted ${used >= c.invSize ? 'bad' : ''}` }, `${used}/${c.invSize}`)),
    h('div', { class: 'row gap wrap toolbar' },
      h('select', { onchange: (e) => { ui.filter = e.target.value; go('hero'); } }, ['all', 'equipment', 'tools', 'materials', 'consumables'].map((f) => h('option', { value: f, selected: ui.filter === f }, f[0].toUpperCase() + f.slice(1)))),
      h('select', { onchange: (e) => { ui.sort = e.target.value; go('hero'); } }, [['position', 'My order'], ['rarity', 'Rarity'], ['level', 'Item level'], ['type', 'Type'], ['name', 'Name']].map(([v, l]) => h('option', { value: v, selected: ui.sort === v }, `Sort: ${l}`))),
      search),
    filtered ? h('p', { class: 'muted small' }, 'Sorted/filtered view — clear filters to rearrange by dragging.') : h('p', { class: 'muted small' }, 'Drag items onto equipment slots to equip, or between cells to rearrange. Click an item for actions.'),
    grid,
    c.invUpgradeCost ? h('button', { class: 'btn ghost small mt', onclick: () => act('/inventory/upgrade', {}, { success: 'Bags expanded!' }) }, `Expand bags (+10 slots) — ${fmt(c.invUpgradeCost)} gold`) : null);
}

function statsPanel(state) {
  const c = state.character;
  const s = state.stats;
  const row = (label, value) => h('div', { class: 'stat-row' }, h('span', {}, label), h('b', {}, value));
  const attrRows = ATTRIBUTES.map((a) => h('div', { class: 'stat-row attr' },
    h('span', {}, STATS[a].label), h('b', {}, fmt(s[a])),
    c.attrPoints ? h('button', { class: 'btn tiny', title: `Spend a point on ${STATS[a].label}`, onclick: () => act('/attributes', { attr: a, amount: 1 }) }, '+') : null));
  const cls = CLASSES[c.class];
  return h('section', { class: 'panel stats-panel' },
    h('div', { class: 'panel-head' }, h('h2', {}, 'Attributes'), c.attrPoints ? h('span', { class: 'gold-text' }, `${c.attrPoints} points to spend`) : null),
    attrRows,
    h('p', { class: 'muted small' }, 'STR: physical damage & mining · DEX: attack & gathering speed · INT: magic & crafting · CON: health · LCK: crits & rare finds'),
    h('h3', {}, 'Combat'),
    row('Health', fmt(s.health)),
    row(s.damageType === 'magic' ? 'Magic Damage' : 'Physical Damage', fmt(s.damage)),
    row('Armor', fmt(s.armor)),
    row('Critical Chance', pct(s.critChance)),
    row('Critical Damage', `+${pct(s.critDmg, 0)}`),
    row('Attack Speed', `${s.attackSpeed.toFixed(2)}x`),
    row('Dodge', pct(s.dodge)),
    s.lifeSteal ? row('Life Steal', pct(s.lifeSteal)) : null,
    row('Power', fmt(s.power)),
    h('h3', {}, 'Adventuring'),
    row('Gathering Speed', spct(s.gatherSpeed)),
    row('Resource Yield', spct(s.gatherYield)),
    row('Rare Discovery', spct(s.rareFind)),
    row('Travel Speed', spct(s.travelSpeed)),
    row('Crafting Efficiency', spct(s.craftEff)),
    row('Crafting Quality', spct(s.craftQuality)),
    row('Loot Discovery', spct(s.lootFind)),
    row('Experience Gain', spct(s.xpGain)),
    h('h3', {}, `${cls.name} abilities`),
    h('div', { class: 'abilities' }, cls.abilities.map((a) => h('div', { class: `ability ${a.level <= c.level ? '' : 'locked'}` },
      h('b', {}, a.name), h('span', { class: 'muted small' }, a.level <= c.level ? ' unlocked' : ` · level ${a.level}`), h('div', { class: 'small' }, a.description)))),
    state.sets.length ? h('div', {}, h('h3', {}, 'Set bonuses'), state.sets.map((st) => h('div', { class: 'small' }, h('b', {}, `${st.name} (${st.count})`),
      st.bonuses.map((b) => h('div', { class: st.count >= b.pieces ? 'good' : 'muted' }, `(${b.pieces}) `, Object.entries(b.stats).map(([k, v]) => formatStat(k, v)).join(', ')))))) : null,
    c.buffs.length ? h('div', {}, h('h3', {}, 'Active elixirs'), c.buffs.map((b) => h('div', { class: 'small' }, h('b', {}, b.name), ' — ', h('span', { dataset: { countdown: b.until } }, ''), ' left'))) : null,
    c.titles.length ? h('div', {}, h('h3', {}, 'Title'), h('select', { onchange: (e) => act('/title', { title: e.target.value || null }) },
      h('option', { value: '' }, '(none)'), c.titles.map((t) => h('option', { value: t, selected: c.title === t }, t)))) : null);
}

export function render(state) {
  const c = state.character;
  const race = RACES[c.race];
  const doll = h('section', { class: 'panel doll-panel' },
    h('div', { class: 'panel-head' }, h('h2', {}, c.name), h('span', { class: 'muted' }, `${race.name} ${CLASSES[c.class].name}`)),
    h('div', { class: 'doll' },
      h('div', { class: 'doll-col' }, ['helmet', 'chest', 'gloves', 'pants', 'boots'].map((s) => slotEl(s, state))),
      h('div', { class: 'doll-center' }, h('div', { class: 'portrait' }, race.icon, h('div', { class: 'portrait-class' }, CLASSES[c.class].icon)),
        h('div', { class: 'row gap' }, slotEl('weapon', state), slotEl('offhand', state))),
      h('div', { class: 'doll-col' }, ['necklace', 'ring1', 'ring2', 'accessory'].map((s) => slotEl(s, state)))),
    h('h3', {}, 'Gathering tools'),
    h('div', { class: 'tool-row' }, TOOL_SLOTS.map((s) => slotEl(s, state))),
    h('p', { class: 'muted small' }, `Race: ${race.description}`));
  return h('div', { class: 'hero-layout' }, doll, statsPanel(state), inventoryPanel(state));
}
