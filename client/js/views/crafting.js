// Crafting: recipes per profession with material checks, batch crafting and live progress.
import { h, fmt, duration } from '../ui.js';
import { act, activityBar } from '../main.js';
import { RECIPES } from '/shared/data/recipes.js';
import { RESOURCES } from '/shared/data/resources.js';
import { PROFESSIONS } from '/shared/data/professions.js';
import { BASE_TYPES, CONSUMABLES, UNIQUES, TIERS, SLOT_LABELS } from '/shared/data/items.js';
import { formatStat } from '/shared/data/stats.js';

export const live = true;
const ui = { prof: 'blacksmithing', category: 'all', craftable: false, showLocked: false };

const matName = (id) => RESOURCES[id]?.name || CONSUMABLES[id]?.name || id;
const matIcon = (id) => RESOURCES[id]?.icon || CONSUMABLES[id]?.icon || '📦';

function outputLabel(r) {
  const o = r.output;
  if (o.resource) return `${o.qty}x ${RESOURCES[o.resource].name}`;
  if (o.consumable) return `${o.qty}x ${CONSUMABLES[o.consumable].name}`;
  if (o.unique) return `${UNIQUES[o.unique].name} (Legendary)`;
  const b = BASE_TYPES[o.base];
  return `${b.name} · ${SLOT_LABELS[b.slot] || 'Ring'} · item level ${TIERS[o.tier].level}+`;
}

function outputHint(r) {
  const o = r.output;
  if (o.consumable) return CONSUMABLES[o.consumable].description;
  if (o.unique) return UNIQUES[o.unique].special.map((s) => formatStat(s.stat, s.value)).join(', ');
  if (o.base) return `${Object.entries(BASE_TYPES[o.base].implicit).map(([k, [v, per]]) => formatStat(k, v + per * TIERS[o.tier].level)).join(', ')} + random affixes by rarity`;
  return null;
}

export function render(state) {
  const c = state.character;
  const have = {};
  for (const i of state.inventory) if (i.kind !== 'equipment') have[i.base] = (have[i.base] || 0) + i.quantity;
  const plvl = c.professions[ui.prof].level;
  const all = Object.values(RECIPES).filter((r) => r.profession === ui.prof);
  const cats = ['all', ...new Set(all.map((r) => r.category))];
  const maxCraft = (r) => Math.min(...Object.entries(r.inputs).map(([m, n]) => Math.floor((have[m] || 0) / n)));
  let list = all.filter((r) => ui.category === 'all' || r.category === ui.category);
  if (!ui.showLocked) list = list.filter((r) => r.level <= plvl + 10);
  if (ui.craftable) list = list.filter((r) => r.level <= plvl && maxCraft(r) > 0);
  const rank = (r) => ['smelting', 'processing', 'potion'].includes(r.category) ? 0 : r.category === 'legendary' ? 2 : 1;
  list.sort((a, b) => a.level - b.level || rank(a) - rank(b) || a.name.localeCompare(b.name));
  const busy = ['quest', 'travel'].includes(c.activity.type) || c.activity.type === 'craft';
  const effMult = 1 + state.stats.craftEff;

  const rows = list.map((r) => {
    const locked = r.level > plvl;
    const max = maxCraft(r);
    const count = h('input', { type: 'number', min: 1, max: Math.max(1, Math.min(100, max)), value: 1, class: 'qty-input' });
    return h('div', { class: `recipe ${locked ? 'locked' : ''} ${max > 0 && !locked ? 'ready' : ''} ${r.category === 'legendary' ? 'legendary' : ''}` },
      h('div', { class: 'recipe-main' },
        h('div', { class: 'recipe-name' }, h('b', {}, r.name), h('span', { class: 'muted small' }, ` · Lv ${r.level} · ${duration((r.seconds * 1000) / effMult)} each`)),
        h('div', { class: 'small' }, '→ ', outputLabel(r)),
        outputHint(r) ? h('div', { class: 'small muted' }, outputHint(r)) : null,
        h('div', { class: 'inputs' }, Object.entries(r.inputs).map(([m, n]) => h('span', { class: `tag ${(have[m] || 0) >= n ? 'good' : 'bad'}` }, `${matIcon(m)} ${matName(m)} ${fmt(have[m] || 0)}/${n}`)))),
      h('div', { class: 'recipe-actions' },
        locked ? h('span', { class: 'tag bad' }, `Requires level ${r.level}`)
          : h('div', { class: 'row gap center-v' }, count,
            h('button', { class: 'btn tiny ghost', onclick: () => { count.value = Math.max(1, Math.min(100, max)); } }, 'Max'),
            h('button', { class: 'btn primary', disabled: max < 1 || busy || undefined,
              onclick: () => act('/craft', { recipeId: r.id, count: Number(count.value) }, { success: `Crafting ${r.name}…` }) }, 'Craft'))));
  });

  const a = c.activity;
  return h('div', {},
    h('div', { class: 'page-head' }, h('h1', {}, 'Crafting'), h('p', { class: 'muted' }, 'Materials are reserved when you start. Crafting continues offline; cancelling returns unused materials. Higher profession level and Crafting Quality improve item rarity.')),
    a.type === 'craft' ? h('section', { class: 'panel' }, h('b', {}, `Crafting ${RECIPES[a.recipeId].name}`), activityBar(a), a.made.length ? h('div', { class: 'small muted' }, `Made: ${a.made.slice(-5).join(', ')}`) : null,
      h('button', { class: 'btn small mt', onclick: () => act('/stop', {}, { success: 'Crafting cancelled; materials returned.' }) }, 'Cancel')) : null,
    h('div', { class: 'tabs' }, Object.entries(PROFESSIONS).filter(([, p]) => p.kind === 'crafting').map(([id, p]) =>
      h('button', { class: `tab ${ui.prof === id ? 'active' : ''}`, onclick: () => { ui.prof = id; ui.category = 'all'; rerender(state); } }, `${p.icon} ${p.name} (${c.professions[id].level})`))),
    h('div', { class: 'row gap wrap toolbar' },
      h('select', { onchange: (e) => { ui.category = e.target.value; rerender(state); } }, cats.map((ct) => h('option', { value: ct, selected: ui.category === ct }, ct === 'all' ? 'All categories' : (SLOT_LABELS[ct] || ct[0].toUpperCase() + ct.slice(1))))),
      h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: ui.craftable || undefined, onchange: (e) => { ui.craftable = e.target.checked; rerender(state); } }), ' Craftable now'),
      h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: ui.showLocked || undefined, onchange: (e) => { ui.showLocked = e.target.checked; rerender(state); } }), ' Show far-off recipes')),
    busy && a.type !== 'craft' ? h('p', { class: 'bad small' }, 'You cannot craft while traveling or on a quest.') : null,
    h('section', { class: 'panel recipe-list' }, rows.length ? rows : h('p', { class: 'muted' }, 'No recipes match.')));
}

function rerender(state) {
  document.querySelector('.content').replaceChildren(render(state));
}
