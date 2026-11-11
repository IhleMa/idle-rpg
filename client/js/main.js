// App shell: auth, character creation, header, navigation, polling and timers.
import { get, post } from './api.js';
import { h, fmt, toast, duration, progressBar, modal } from './ui.js';
import { RACES } from '/shared/data/races.js';
import { CLASSES } from '/shared/data/classes.js';
import { AREAS, ACTIVITIES } from '/shared/data/areas.js';
import { RECIPES } from '/shared/data/recipes.js';
import { RESOURCES } from '/shared/data/resources.js';
import { charXpForLevel } from '/shared/rules.js';
import { formatStat } from '/shared/data/stats.js';

import * as heroView from './views/hero.js';
import * as mapView from './views/map.js';
import * as gatherView from './views/gathering.js';
import * as profView from './views/professions.js';
import * as craftView from './views/crafting.js';
import * as questView from './views/quests.js';
import * as combatView from './views/combat.js';
import * as arenaView from './views/arena.js';
import * as marketView from './views/market.js';
import * as rankView from './views/rankings.js';
import * as journalView from './views/journal.js';

const VIEWS = [
  { id: 'hero', label: 'Hero', icon: '🧝', mod: heroView },
  { id: 'map', label: 'World Map', icon: '🗺️', mod: mapView },
  { id: 'gather', label: 'Gathering', icon: '⛏️', mod: gatherView },
  { id: 'prof', label: 'Professions', icon: '📜', mod: profView },
  { id: 'craft', label: 'Crafting', icon: '🔨', mod: craftView },
  { id: 'quests', label: 'Quests', icon: '❗', mod: questView },
  { id: 'combat', label: 'Combat', icon: '⚔️', mod: combatView },
  { id: 'arena', label: 'Arena', icon: '🏟️', mod: arenaView },
  { id: 'market', label: 'Auction House', icon: '⚖️', mod: marketView },
  { id: 'rank', label: 'Rankings', icon: '🏆', mod: rankView },
  { id: 'journal', label: 'Journal', icon: '📖', mod: journalView },
];

export const store = {
  state: null,
  view: localStorage.getItem('view') || 'hero',
  clockOffset: 0,
  dragging: false,
};

export const serverNow = () => Date.now() + store.clockOffset;
const app = document.getElementById('app');

// ---------- data ----------
export function applyState(state, { silent = false } = {}) {
  store.state = state;
  store.clockOffset = state.now - Date.now();
  if (state.summary && !silent) showSummary(state.summary);
  renderHeader();
  const v = VIEWS.find((x) => x.id === store.view);
  if (v?.mod.live !== false && !store.dragging) renderView();
}

export async function refresh(opts) {
  const state = await get('/state');
  applyState(state, opts);
  return state;
}

/** POST an action; on success apply returned state. Returns the action result. */
export async function act(path, body, { success, rerender = true } = {}) {
  try {
    const res = await post(path, body);
    if (res.state) {
      store.state = res.state;
      store.clockOffset = res.state.now - Date.now();
      if (res.state.summary) showSummary(res.state.summary);
      renderHeader();
      if (rerender) renderView();
    }
    if (success) toast(typeof success === 'function' ? success(res.result) : success, 'success');
    return res.result ?? true;
  } catch (e) {
    toast(e.message, 'error');
    if (e.status === 401) boot();
    return undefined;
  }
}

function showSummary(s) {
  const res = Object.entries(s.resources || {});
  const lines = [];
  if (s.arrived) toast(`Arrived at ${AREAS[s.arrived].name}`, 'success');
  if (s.stopped) toast(`Gathering stopped: ${s.stopped}`, 'error');
  if (s.quests?.length) store.lastQuests = [...s.quests, ...(store.lastQuests || [])].slice(0, 5);
  for (const qst of s.quests || []) toast(`${qst.won ? '✅ Quest complete' : '❌ Quest failed'}: ${qst.title}`, qst.won ? 'success' : 'error');
  if (s.crafted?.length && s.crafted.length <= 3) for (const c of s.crafted) toast(`Crafted ${c}`, 'success');
  const big = s.offlineMs > 0 || res.reduce((a, [, n]) => a + n, 0) > 25 || (s.crafted?.length || 0) > 3;
  if (big) {
    if (res.length) lines.push(h('div', {}, h('b', {}, 'Gathered: '), res.map(([r, n]) => `${n}x ${RESOURCES[r]?.name}`).join(', ')));
    if (s.crafted?.length) lines.push(h('div', {}, h('b', {}, 'Crafted: '), `${s.crafted.length} item(s)`));
    if (s.items?.length) lines.push(h('div', {}, h('b', {}, 'Found: '), s.items.join(', ')));
    for (const [p, xp] of Object.entries(s.profXp || {})) lines.push(h('div', {}, `+${fmt(xp)} ${p} XP`));
    if (s.offlineMs) lines.push(h('p', { class: 'muted' }, `You were away ${duration(s.offlineMs)}. Offline progress is capped at 12 hours.`));
    if (lines.length) modal('While you were away…', h('div', { class: 'summary' }, lines));
  } else {
    for (const it of s.items || []) toast(`Found ${it}!`, 'success');
  }
}

// ---------- timers ----------
setInterval(() => {
  const now = serverNow();
  for (const el of document.querySelectorAll('[data-countdown]')) el.textContent = duration(Number(el.dataset.countdown) - now);
  for (const el of document.querySelectorAll('[data-progress-end]')) {
    const s = Number(el.dataset.progressStart);
    const e = Number(el.dataset.progressEnd);
    el.style.width = `${Math.max(0, Math.min(100, ((now - s) / (e - s)) * 100))}%`;
  }
  for (const el of document.querySelectorAll('[data-cycle-ms]')) {
    const s = Number(el.dataset.cycleStart);
    const ms = Number(el.dataset.cycleMs);
    el.style.width = `${(((now - s) % ms) / ms) * 100}%`;
  }
  const a = store.state?.character.activity;
  if (a && ((a.endsAt && now >= a.endsAt + 500) || (a.type === 'craft' && now >= a.nextAt + 500))) {
    if (!refresh.pending) { refresh.pending = true; refresh().finally(() => { refresh.pending = false; }); }
  }
}, 1000);
setInterval(() => { if (store.state && document.visibilityState === 'visible' && !store.dragging) refresh({}).catch(() => {}); }, 15000);

// ---------- auth ----------
function authScreen() {
  let mode = 'login';
  const user = h('input', { placeholder: 'Username', autocomplete: 'username', maxlength: 20 });
  const pass = h('input', { placeholder: 'Password (8+ characters)', type: 'password', autocomplete: 'current-password' });
  const btn = h('button', { class: 'btn primary wide', type: 'submit' }, 'Enter the Realm');
  const switcher = h('a', { href: '#' }, 'New here? Create an account');
  const form = h('form', { class: 'auth-form', onsubmit: async (e) => {
    e.preventDefault();
    btn.disabled = true;
    try {
      await post(mode === 'login' ? '/auth/login' : '/auth/register', { username: user.value.trim(), password: pass.value });
      boot();
    } catch (err) { toast(err.message, 'error'); } finally { btn.disabled = false; }
  } }, user, pass, btn, switcher);
  switcher.onclick = (e) => {
    e.preventDefault();
    mode = mode === 'login' ? 'register' : 'login';
    btn.textContent = mode === 'login' ? 'Enter the Realm' : 'Create Account';
    switcher.textContent = mode === 'login' ? 'New here? Create an account' : 'Have an account? Log in';
    pass.autocomplete = mode === 'login' ? 'current-password' : 'new-password';
  };
  app.replaceChildren(h('div', { class: 'auth-screen' },
    h('div', { class: 'auth-card panel' },
      h('div', { class: 'logo' }, 'Realms of', h('span', {}, 'Ashenvale')),
      h('p', { class: 'muted center' }, 'A persistent fantasy idle RPG. Explore, gather, craft, trade and fight — even while you are away.'),
      form)));
  user.focus();
}

function createScreen() {
  let race = 'human';
  let cls = 'warrior';
  const name = h('input', { placeholder: 'Character name', maxlength: 16 });
  const raceBox = h('div', { class: 'choice-grid' });
  const classBox = h('div', { class: 'choice-grid' });
  const draw = () => {
    raceBox.replaceChildren(...Object.entries(RACES).map(([id, r]) => h('button', { type: 'button', class: `choice ${race === id ? 'selected' : ''}`, onclick: () => { race = id; draw(); } },
      h('div', { class: 'choice-icon' }, r.icon), h('b', {}, r.name), h('p', {}, r.description),
      h('div', { class: 'choice-stats' }, Object.entries(r.bonuses).map(([k, v]) => h('div', {}, formatStat(k, v)))))));
    classBox.replaceChildren(...Object.entries(CLASSES).map(([id, c]) => h('button', { type: 'button', class: `choice ${cls === id ? 'selected' : ''}`, onclick: () => { cls = id; draw(); } },
      h('div', { class: 'choice-icon' }, c.icon), h('b', {}, c.name), h('p', {}, c.description),
      h('div', { class: 'choice-stats' }, c.abilities.slice(0, 2).map((a) => h('div', {}, `${a.name} (Lv ${a.level})`))))));
  };
  draw();
  app.replaceChildren(h('div', { class: 'create-screen' },
    h('div', { class: 'panel create-card' },
      h('h1', { class: 'title' }, 'Create your hero'),
      h('h3', {}, 'Race'), raceBox,
      h('h3', {}, 'Class'), classBox,
      h('div', { class: 'row gap center-v' }, name,
        h('button', { class: 'btn primary', onclick: async () => {
          try { await post('/character', { name: name.value.trim(), race, cls }); boot(); } catch (e) { toast(e.message, 'error'); }
        } }, 'Begin your journey')))));
}

// ---------- shell ----------
let header;
let content;
let nav;

function shell() {
  header = h('header', { class: 'topbar' });
  nav = h('nav', { class: 'nav' });
  content = h('main', { class: 'content' });
  app.replaceChildren(h('div', { class: 'shell' }, header, h('div', { class: 'body' }, nav, content)));
  renderNav();
}

function renderNav() {
  nav.replaceChildren(...VIEWS.map((v) => h('button', { class: `nav-btn ${store.view === v.id ? 'active' : ''}`, onclick: () => go(v.id) },
    h('span', { class: 'nav-icon' }, v.icon), h('span', { class: 'nav-label' }, v.label))),
  h('button', { class: 'nav-btn logout', onclick: async () => { await post('/auth/logout'); boot(); } }, h('span', { class: 'nav-icon' }, '🚪'), h('span', { class: 'nav-label' }, 'Log out')));
}

export function go(id) {
  store.view = id;
  localStorage.setItem('view', id);
  renderNav();
  renderView(true);
}

export function renderView(scrollTop = false) {
  const v = VIEWS.find((x) => x.id === store.view) || VIEWS[0];
  const y = content.scrollTop;
  try {
    content.replaceChildren(v.mod.render(store.state));
  } catch (e) {
    console.error(e);
    content.replaceChildren(h('div', { class: 'panel' }, 'Something went wrong rendering this view.'));
  }
  content.scrollTop = scrollTop ? 0 : y;
}

export function activityText(a, c) {
  switch (a.type) {
    case 'travel': return `Traveling to ${AREAS[a.to].name}`;
    case 'gather': return `${ACTIVITIES[a.activityId].name} in ${AREAS[a.area].name}`;
    case 'craft': return `Crafting ${RECIPES[a.recipeId].name} (${a.done}/${a.count})`;
    case 'quest': return `Quest: ${a.quest.title}`;
    default: return `Idle in ${AREAS[c.location].name}`;
  }
}

export function activityBar(a) {
  if (a.type === 'travel' || a.type === 'quest') {
    return h('div', { class: 'bar' }, h('div', { class: 'bar-fill', dataset: { progressStart: a.startedAt, progressEnd: a.endsAt } }),
      h('span', { class: 'bar-label' }, h('span', { dataset: { countdown: a.endsAt } }, duration(a.endsAt - serverNow())), ' left'));
  }
  if (a.type === 'craft') {
    return h('div', { class: 'bar' }, h('div', { class: 'bar-fill', dataset: { progressStart: a.nextAt - a.cycleMs, progressEnd: a.nextAt } }),
      h('span', { class: 'bar-label' }, `${a.done}/${a.count} · next in `, h('span', { dataset: { countdown: a.nextAt } }, '')));
  }
  if (a.type === 'gather') {
    return h('div', { class: 'bar gather' }, h('div', { class: 'bar-fill', dataset: { cycleStart: a.lastAt, cycleMs: a.cycleMs } }),
      h('span', { class: 'bar-label' }, `${(a.cycleMs / 1000).toFixed(1)}s per gather`));
  }
  return null;
}

export function renderHeader() {
  const s = store.state;
  if (!s || !header) return;
  const c = s.character;
  const need = charXpForLevel(c.level);
  const a = c.activity;
  header.replaceChildren(
    h('div', { class: 'brand' }, 'Ashenvale'),
    h('div', { class: 'hero-chip' },
      h('div', { class: 'avatar' }, RACES[c.race].icon),
      h('div', {},
        h('div', { class: 'hero-name' }, c.name, c.title ? h('span', { class: 'title-tag' }, ` ${c.title}`) : null),
        h('div', { class: 'muted small' }, `Level ${c.level} ${RACES[c.race].name} ${CLASSES[c.class].name}`),
        progressBar(c.xp, need, { cls: 'xp thin', label: `${fmt(c.xp)} / ${fmt(need)} XP` }))),
    h('div', { class: 'activity-chip' },
      h('div', { class: 'small' }, h('b', {}, activityText(a, c))),
      activityBar(a),
      a.type !== 'idle' ? h('button', { class: 'btn tiny ghost', onclick: () => act('/stop', {}, { success: 'Stopped.' }) }, a.type === 'travel' ? 'Turn back' : 'Stop') : null),
    h('div', { class: 'res-chips' },
      h('div', { class: 'chip', title: 'Gold' }, '🪙 ', fmt(c.gold)),
      h('div', { class: 'chip', title: 'Arena tokens' }, '🎟️ ', fmt(c.arenaTokens)),
      h('div', { class: 'chip stamina', title: `Stamina: +1 every ${c.staminaRegenSeconds / 60} min` }, '⚡ ', `${Math.floor(c.stamina)}/${c.staminaMax}`),
      s.pendingPayout ? h('button', { class: 'chip gold-glow', onclick: () => go('market') }, `💰 ${fmt(s.pendingPayout)} to collect`) : null,
      c.attrPoints ? h('button', { class: 'chip gold-glow', onclick: () => go('hero') }, `+${c.attrPoints} attribute points`) : null),
  );
}

// ---------- boot ----------
export async function boot() {
  const me = await get('/me').catch(() => ({ user: null }));
  if (!me.user) return authScreen();
  if (!me.hasCharacter) return createScreen();
  shell();
  await refresh();
  renderView(true);
}

document.addEventListener('dragend', () => { store.dragging = false; });
boot();
