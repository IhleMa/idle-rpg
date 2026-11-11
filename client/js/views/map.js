// World map: connected regions, routes, discovery state, travel planning and live travel progress.
import { h, duration, fmt } from '../ui.js';
import { act, store, serverNow } from '../main.js';
import { AREAS, ACTIVITIES, TRAVEL_SECONDS_PER_UNIT } from '/shared/data/areas.js';
import { ENEMIES } from '/shared/data/enemies.js';
import { RESOURCES } from '/shared/data/resources.js';
import { travelSeconds } from '/shared/rules.js';
import { get } from '../api.js';

let shopStock = null;
function merchant(state) {
  if (!shopStock) { get('/shop').then((s) => { shopStock = s; const el = document.querySelector('.merchant'); if (el) el.replaceWith(merchant(store.state)); }); return h('div', { class: 'merchant muted' }, 'Loading merchant…'); }
  const c = state.character;
  return h('div', { class: 'merchant' }, h('h3', {}, '🏪 Village Merchant'), shopStock.map((it) => h('div', { class: 'row between center-v shop-row' },
    h('span', { class: 'small' }, it.name, it.minLevel ? h('span', { class: 'muted' }, ` (Lv ${it.minLevel})`) : null),
    h('button', { class: 'btn tiny', disabled: c.gold < it.price || (it.minLevel && c.level < it.minLevel) || undefined, onclick: () => act('/shop/buy', { stockId: it.id, qty: 1 }, { success: `Bought ${it.name}` }) }, `🪙 ${it.price}`))));
}

export const live = true;
let selected = null;
const NS = 'http://www.w3.org/2000/svg';
const s = (tag, attrs = {}, ...kids) => {
  const el = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) if (v !== undefined && v !== null) el.setAttribute(k, v);
  for (const k of kids.flat()) if (k) el.append(k instanceof Node ? k : document.createTextNode(String(k)));
  return el;
};

function path(c, from, to) {
  const unlocked = (a) => c.level >= (AREAS[a].unlock?.level || 1);
  const dist = { [from]: 0 }; const prev = {}; const open = new Set([from]);
  while (open.size) {
    let cur = null;
    for (const n of open) if (cur === null || dist[n] < dist[cur]) cur = n;
    open.delete(cur);
    for (const [nb, d] of Object.entries(AREAS[cur].connections)) {
      if (!c.discovered.includes(nb) || !unlocked(nb)) continue;
      if (dist[nb] === undefined || dist[cur] + d < dist[nb]) { dist[nb] = dist[cur] + d; prev[nb] = cur; open.add(nb); }
    }
  }
  if (dist[to] === undefined) return null;
  const p = [to]; while (p[0] !== from) p.unshift(prev[p[0]]);
  return { path: p, distance: dist[to] };
}

function travelPosition(a) {
  const now = serverNow();
  const t = Math.max(0, Math.min(1, (now - a.startedAt) / (a.endsAt - a.startedAt)));
  const segs = [];
  let total = 0;
  for (let i = 0; i < a.path.length - 1; i++) { const d = AREAS[a.path[i]].connections[a.path[i + 1]]; segs.push(d); total += d; }
  let target = t * total;
  for (let i = 0; i < segs.length; i++) {
    if (target <= segs[i] || i === segs.length - 1) {
      const A = AREAS[a.path[i]]; const B = AREAS[a.path[i + 1]]; const f = Math.min(1, target / segs[i]);
      return { x: A.x + (B.x - A.x) * f, y: A.y + (B.y - A.y) * f };
    }
    target -= segs[i];
  }
  return { x: AREAS[a.to].x, y: AREAS[a.to].y };
}

export function render(state) {
  const c = state.character;
  const a = c.activity;
  if (!selected) selected = c.location;
  const svg = s('svg', { viewBox: '0 0 1000 700', class: 'world-map' });
  svg.append(s('defs', {},
    s('radialGradient', { id: 'fog' }, s('stop', { offset: '0%', 'stop-color': '#000', 'stop-opacity': '0' }), s('stop', { offset: '100%', 'stop-color': '#000', 'stop-opacity': '0.35' })),
    s('filter', { id: 'blur', filterUnits: 'userSpaceOnUse', x: -200, y: -200, width: 1400, height: 1100 }, s('feGaussianBlur', { stdDeviation: 30 })),
    s('pattern', { id: 'grain', width: 6, height: 6, patternUnits: 'userSpaceOnUse' }, s('circle', { cx: 1, cy: 1, r: 0.6, fill: 'rgba(255,255,255,0.04)' }))));
  // terrain: soft regional washes so the map reads as geography, undiscovered regions stay dark
  for (const [id, area] of Object.entries(AREAS)) {
    const known = c.discovered.includes(id);
    svg.append(s('ellipse', { cx: area.x, cy: area.y, rx: 120, ry: 90, fill: area.color, opacity: known ? 0.16 : 0.05, filter: 'url(#blur)' }));
  }
  svg.append(s('rect', { x: 0, y: 0, width: 1000, height: 700, fill: 'url(#grain)' }));

  // routes
  const drawn = new Set();
  const travelEdges = new Set();
  if (a.type === 'travel') for (let i = 0; i < a.path.length - 1; i++) travelEdges.add([a.path[i], a.path[i + 1]].sort().join('|'));
  for (const [id, area] of Object.entries(AREAS)) {
    for (const [nb, d] of Object.entries(area.connections)) {
      const key = [id, nb].sort().join('|');
      if (drawn.has(key)) continue;
      drawn.add(key);
      const known = (c.discovered.includes(id) || c.visited.includes(id)) && (c.discovered.includes(nb) || c.visited.includes(nb));
      if (!known) continue;
      const B = AREAS[nb];
      const active = travelEdges.has(key);
      svg.append(s('line', { x1: area.x, y1: area.y, x2: B.x, y2: B.y, class: `route ${active ? 'active' : ''}` }));
      const len = Math.hypot(B.x - area.x, B.y - area.y) || 1;
      const nx = -(B.y - area.y) / len; const ny = (B.x - area.x) / len;
      svg.append(s('text', { x: (area.x + B.x) / 2 + nx * 16, y: (area.y + B.y) / 2 + ny * 16 + 4, class: 'route-label' }, duration(travelSeconds(d, state.stats, TRAVEL_SECONDS_PER_UNIT) * 1000)));
    }
  }

  // nodes
  for (const [id, area] of Object.entries(AREAS)) {
    const discovered = c.discovered.includes(id);
    if (!discovered) continue;
    const unlocked = c.level >= (area.unlock?.level || 1);
    const here = c.location === id && a.type !== 'travel';
    const visited = c.visited.includes(id);
    const g = s('g', { class: `node ${unlocked ? '' : 'locked'} ${here ? 'here' : ''} ${selected === id ? 'selected' : ''} ${visited ? 'visited' : 'unvisited'}`, transform: `translate(${area.x},${area.y})`, tabindex: 0 });
    if (here) g.append(s('circle', { r: 34, class: 'here-ring' }));
    g.append(s('circle', { r: 24, fill: area.color, class: 'node-circle' }));
    g.append(s('text', { y: 7, class: 'node-icon' }, unlocked ? (visited ? themeIcon(area.theme) : '❔') : '🔒'));
    g.append(s('text', { y: 44, class: 'node-label' }, area.name));
    g.append(s('text', { y: 59, class: 'node-sub' }, unlocked ? `Lv ${area.level}+` : `Requires Lv ${area.unlock.level}`));
    g.addEventListener('click', () => { selected = id; store.view === 'map' && document.querySelector('.map-layout').replaceWith(render(store.state)); });
    svg.append(g);
  }

  // traveler
  if (a.type === 'travel') {
    const marker = s('g', { class: 'traveler' }, s('circle', { r: 11 }), s('text', { y: 5 }, '🐎'));
    const update = () => { const p = travelPosition(a); marker.setAttribute('transform', `translate(${p.x},${p.y})`); };
    update();
    const iv = setInterval(() => { if (!marker.isConnected) return clearInterval(iv); update(); }, 500);
    svg.append(marker);
  }

  return h('div', { class: 'map-layout' }, h('section', { class: 'panel map-panel' }, svg), areaPanel(state, selected));
}

function themeIcon(t) {
  return { village: '🏘️', forest: '🌲', mountains: '⛰️', coast: '🌊', swamp: '🐸', desert: '🏜️', ancient_forest: '🌳', snow: '🏔️', ruins: '🏛️', volcanic: '🌋' }[t] || '📍';
}

function areaPanel(state, id) {
  const c = state.character;
  const area = AREAS[id];
  const unlocked = c.level >= (area.unlock?.level || 1);
  const visited = c.visited.includes(id);
  const route = id !== c.location ? path(c, c.location, id) : null;
  const a = c.activity;
  const resources = new Set();
  for (const t of Object.values(area.activities)) for (const d of [...t.drops, ...(t.rares || [])]) resources.add(d.res);
  let travelBtn = null;
  if (id === c.location && a.type !== 'travel') travelBtn = h('div', { class: 'tag good' }, 'You are here');
  else if (a.type === 'travel' && a.to === id) travelBtn = h('div', { class: 'tag' }, 'Traveling here — ', h('span', { dataset: { countdown: a.endsAt } }, ''));
  else if (!unlocked) travelBtn = h('div', { class: 'tag bad' }, `Unlocks at character level ${area.unlock.level}`);
  else if (!route) travelBtn = h('div', { class: 'tag bad' }, 'No known route');
  else {
    const secs = travelSeconds(route.distance, state.stats, TRAVEL_SECONDS_PER_UNIT);
    const blocked = ['quest', 'craft'].includes(a.type) || a.type === 'travel';
    travelBtn = h('div', {},
      h('p', { class: 'small muted' }, `Route: ${route.path.map((p) => AREAS[p].name).join(' → ')}`),
      h('button', { class: 'btn primary wide', disabled: blocked || undefined, onclick: () => act('/travel', { to: id }, { success: `Setting off for ${area.name}` }) },
        `Travel (${duration(secs * 1000)})`),
      blocked ? h('p', { class: 'small muted' }, a.type === 'travel' ? 'Already traveling.' : 'Finish your current quest or craft first.') : null,
      a.type === 'gather' ? h('p', { class: 'small muted' }, 'Traveling will stop your gathering.') : null);
  }
  return h('section', { class: 'panel area-panel' },
    h('div', { class: 'area-banner', style: { background: `linear-gradient(135deg, ${area.color}, transparent)` } }, h('span', { class: 'area-icon' }, themeIcon(area.theme)), h('h2', {}, area.name)),
    h('p', {}, area.description),
    h('div', { class: 'row gap wrap' }, h('span', { class: 'tag' }, `Recommended level ${area.level}`), area.shop ? h('span', { class: 'tag' }, '🏪 Merchant') : null, visited ? null : h('span', { class: 'tag' }, 'Unexplored')),
    travelBtn,
    area.shop && id === c.location && a.type !== 'travel' ? merchant(state) : null,
    h('h3', {}, 'Activities'),
    h('div', { class: 'chips' }, Object.keys(area.activities).map((k) => h('span', { class: 'tag' }, `${ACTIVITIES[k].icon} ${ACTIVITIES[k].name}`))),
    h('h3', {}, 'Resources'),
    h('div', { class: 'chips' }, [...resources].map((r) => h('span', { class: `tag ${RESOURCES[r].rare ? 'rare' : ''}`, title: RESOURCES[r].rare ? 'Rare' : '' }, `${RESOURCES[r].icon} ${visited ? RESOURCES[r].name : '???'}`))),
    h('h3', {}, 'Enemies'),
    h('div', { class: 'chips' }, area.enemies.map((e) => h('span', { class: `tag ${ENEMIES[e].boss ? 'boss' : ''}` }, `${ENEMIES[e].icon} ${ENEMIES[e].name} (${ENEMIES[e].level})${ENEMIES[e].boss ? ' 👑' : ''}`))),
    h('h3', {}, 'Connections'),
    h('ul', { class: 'small' }, Object.entries(area.connections).map(([nb, d]) => h('li', {}, c.discovered.includes(nb) ? AREAS[nb].name : 'Unknown region', h('span', { class: 'muted' }, ` · ${fmt(d)} leagues`)))));
}
