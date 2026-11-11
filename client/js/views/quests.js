// Quests: timed missions in the current area that end with an automatic battle.
import { h, fmt, duration } from '../ui.js';
import { act, store, activityBar, renderView } from '../main.js';
import { get } from '../api.js';
import { AREAS } from '/shared/data/areas.js';
import { ENEMIES } from '/shared/data/enemies.js';
import { RESOURCES } from '/shared/data/resources.js';
import { QUEST_DIFFICULTIES } from '/shared/data/quests.js';
import { showBattle } from '../battle.js';

export const live = true;
let offers = null;
let offersKey = '';

async function loadOffers() {
  try {
    const res = await get('/quests');
    offers = res.result;
    offersKey = `${res.state.character.location}`;
    store.state = res.state;
    renderView();
  } catch { /* ignore */ }
}

export function render(state) {
  const c = state.character;
  const a = c.activity;
  if (offersKey !== c.location || (offers && offers.length && offers[0].area !== c.location)) { offers = null; offersKey = c.location; }
  if (!offers && a.type !== 'travel') loadOffers();

  const last = store.lastQuests || [];
  const results = last.length ? h('section', { class: 'panel' }, h('h2', {}, 'Recent results'),
    last.map((qr) => h('div', { class: 'row gap center-v between quest-result' },
      h('div', {}, h('b', { class: qr.won ? 'good' : 'bad' }, qr.won ? '✔ ' : '✘ '), qr.title, h('span', { class: 'muted small' }, ` +${fmt(qr.xp)} XP${qr.gold ? `, +${fmt(qr.gold)} gold` : ''}${qr.loot.length ? ', ' + qr.loot.join(', ') : ''}`)),
      h('button', { class: 'btn tiny', onclick: () => showBattle(qr, { title: qr.title }) }, 'Watch battle')))) : null;

  let active = null;
  if (a.type === 'quest') {
    const qq = a.quest;
    active = h('section', { class: 'panel quest-active' }, h('div', { class: 'panel-head' }, h('h2', {}, qq.title), h('span', { class: `tag diff-${qq.difficulty}` }, QUEST_DIFFICULTIES[qq.difficulty].name)),
      h('p', {}, qq.text), activityBar(a),
      h('p', { class: 'small muted' }, `At the end you will face a ${ENEMIES[qq.enemy].name} (level ${qq.level}).`),
      h('button', { class: 'btn small', onclick: () => act('/stop', {}, { success: 'Quest abandoned.' }) }, 'Abandon'));
  }

  const busy = a.type !== 'idle' && a.type !== 'gather';
  const cards = (offers || []).map((qq) => {
    const e = ENEMIES[qq.enemy];
    return h('div', { class: 'panel quest-card' },
      h('div', { class: 'panel-head' }, h('h2', {}, qq.title), h('span', { class: `tag diff-${qq.difficulty}` }, QUEST_DIFFICULTIES[qq.difficulty].name)),
      h('p', { class: 'small' }, qq.text),
      h('div', { class: 'row gap wrap' },
        h('span', { class: 'tag' }, `⏱ ${duration(qq.seconds * 1000)}`),
        h('span', { class: 'tag' }, `${e.icon} ${e.name} Lv ${qq.level}`)),
      h('div', { class: 'rewards' },
        h('span', {}, `✨ ${fmt(qq.xp)} XP`), h('span', {}, `🪙 ${fmt(qq.gold)}`),
        qq.resource ? h('span', {}, `${RESOURCES[qq.resource.res].icon} ${qq.resource.qty}x ${RESOURCES[qq.resource.res].name}`) : null,
        h('span', {}, `🎁 ${Math.round(qq.itemChance * 100)}% item`)),
      h('button', { class: 'btn primary wide', disabled: busy || undefined, onclick: async () => { const r = await act('/quest', { questId: qq.id }, { success: `Quest accepted: ${qq.title}` }); if (r) offers = null; } },
        busy ? 'Busy' : a.type === 'gather' ? 'Accept (stops gathering)' : 'Accept quest'));
  });

  return h('div', {},
    h('div', { class: 'page-head' }, h('h1', {}, `Quests — ${AREAS[c.location].name}`), h('p', { class: 'muted' }, 'Quests run while you are offline. When the timer ends your hero battles the quest target automatically; victory grants the full rewards.')),
    active, results,
    a.type === 'travel' ? h('p', { class: 'muted' }, 'No quests while traveling.') : h('div', { class: 'card-grid' }, offers ? cards : h('p', { class: 'muted' }, 'Loading quests…')));
}
