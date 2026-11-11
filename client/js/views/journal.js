import { h, timeAgo } from '../ui.js';

export const live = true;
const ICONS = { level: '⬆️', profession: '📜', travel: '🗺️', gather: '⛏️', rare: '✨', craft: '🔨', quest: '❗', combat: '⚔️', arena: '🏟️', market: '⚖️', item: '🎒', system: '📣' };

export function render(state) {
  return h('div', {},
    h('div', { class: 'page-head' }, h('h1', {}, 'Journal'), h('p', { class: 'muted' }, 'Everything that happened to your hero, including while you were away.')),
    h('section', { class: 'panel journal' }, state.log.map((e) => h('div', { class: `journal-row k-${e.kind}` },
      h('span', { class: 'j-icon' }, ICONS[e.kind] || '•'), h('span', { class: 'j-text' }, e.text), h('span', { class: 'j-time muted small' }, timeAgo(e.created_at))))));
}
