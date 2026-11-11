import { h, duration } from '../ui.js';
import { store, serverNow } from '../main.js';
import { get } from '../api.js';
import { RACES } from '/shared/data/races.js';
import { CLASSES } from '/shared/data/classes.js';

export const live = false;
let kind = 'arena';
let data = null;
let root = null;

async function load() {
  try { data = await get(`/leaderboard?kind=${kind}`); } catch { data = { rows: [] }; }
  if (root?.isConnected) root.replaceWith(render(store.state));
}

export function render() {
  if (!data) { load(); }
  const rows = data?.rows || [];
  root = h('div', {},
    h('div', { class: 'page-head' }, h('h1', {}, 'Rankings'),
      data?.season ? h('p', { class: 'muted' }, `Arena season ${data.season.id} ends in `, h('span', { dataset: { countdown: data.season.ends_at } }, duration(data.season.ends_at - serverNow())), '. Ratings partially reset each season.') : null),
    h('div', { class: 'tabs' }, [['arena', 'Arena rating'], ['level', 'Character level']].map(([k, l]) => h('button', { class: `tab ${kind === k ? 'active' : ''}`, onclick: () => { kind = k; data = null; load(); } }, l))),
    h('section', { class: 'panel' }, !data ? h('p', { class: 'muted' }, 'Loading…') : rows.length ? h('table', { class: 'market-table' },
      h('thead', {}, h('tr', {}, kind === 'arena' ? ['#', 'Name', 'Class', 'Level', 'Tier', 'Rating', 'W/L'].map((t) => h('th', {}, t)) : ['#', 'Name', 'Class', 'Level'].map((t) => h('th', {}, t)))),
      h('tbody', {}, rows.map((r, i) => h('tr', { class: r.name === store.state.character.name ? 'me' : '' },
        h('td', {}, i + 1),
        h('td', {}, `${RACES[r.race].icon} ${r.name}`, r.title ? h('span', { class: 'muted small' }, ` ${r.title}`) : null),
        h('td', {}, `${CLASSES[r.class].icon} ${CLASSES[r.class].name}`),
        h('td', {}, r.level),
        kind === 'arena' ? [h('td', {}, h('span', { class: 'tier-badge', style: { '--tc': r.tier.color } }, r.tier.name)), h('td', {}, h('b', {}, r.rating)), h('td', { class: 'small' }, `${r.wins}/${r.losses}`)] : null)))) : h('p', { class: 'muted' }, 'Nobody has fought in the Arena this season yet.')));
  return root;
}
