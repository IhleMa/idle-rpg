// PvP Arena: rating, tiers, opponents with full character inspection, battles, rewards and shop.
import { h, fmt, pct, duration, itemSlotEl, modal, toast, timeAgo } from '../ui.js';
import { act, store, serverNow } from '../main.js';
import { get } from '../api.js';
import { ARENA_TIERS, ARENA_SHOP, ARENA_CONFIG } from '/shared/data/arena.js';
import { RACES } from '/shared/data/races.js';
import { CLASSES } from '/shared/data/classes.js';
import { SLOT_LABELS } from '/shared/data/items.js';
import { showBattle } from '../battle.js';

export const live = false;
let data = { status: null, opponents: null, history: null };
let root = null;

async function load(what = ['status', 'opponents', 'history']) {
  if (store.state.character.level < ARENA_CONFIG.minLevelToEnter) what = what.filter((w) => w === 'status');
  try {
    const [s, o, hi] = await Promise.all([
      what.includes('status') ? get('/arena') : null,
      what.includes('opponents') ? get('/arena/opponents').catch((e) => ({ error: e.message })) : null,
      what.includes('history') ? get('/arena/history') : null,
    ]);
    if (s) data.status = s.result;
    if (o) data.opponents = o.error ? { error: o.error } : o.result;
    if (hi) data.history = hi.result;
  } catch (e) { toast(e.message, 'error'); }
  redraw();
}

function redraw() {
  if (root?.isConnected) root.replaceWith(build(store.state));
}

function tierBadge(tier) {
  return h('span', { class: 'tier-badge', style: { '--tc': tier.color } }, tier.name);
}

function compareRow(label, mine, theirs, fmtFn = fmt) {
  const better = mine > theirs ? 'good' : mine < theirs ? 'bad' : '';
  return h('tr', {}, h('td', {}, label), h('td', { class: better }, fmtFn(mine)), h('td', {}, fmtFn(theirs)));
}

function inspect(opp) {
  const me = store.state.stats;
  const p = opp.profile;
  modal(`${p.name} — Level ${p.level} ${RACES[p.race].name} ${CLASSES[p.class].name}`, h('div', {},
    h('div', { class: 'row gap wrap' }, tierBadge(opp.tier), h('span', { class: 'tag' }, `Rating ${opp.rating}`), p.title ? h('span', { class: 'tag' }, p.title) : null),
    h('h3', {}, 'Equipment'),
    h('div', { class: 'equip-preview' }, p.equipped.filter((i) => !i.slot.startsWith('tool_')).map((i) => h('div', { class: 'preview-slot' }, itemSlotEl(i, { tooltip: { classId: p.class } }), h('span', { class: 'small muted' }, SLOT_LABELS[i.slot])))),
    h('h3', {}, 'Stats (PvP)'),
    h('table', { class: 'compare' }, h('tr', {}, h('th', {}, ''), h('th', {}, 'You'), h('th', {}, p.name)),
      compareRow('Health', me.health, p.stats.health),
      compareRow('Damage', me.damage, p.stats.damage),
      compareRow('Armor', me.armor, p.stats.armor),
      compareRow('Crit chance', me.critChance, p.stats.critChance, pct),
      compareRow('Attack speed', me.attackSpeed, p.stats.attackSpeed, (v) => `${v.toFixed(2)}x`),
      compareRow('Dodge', me.dodge, p.stats.dodge, pct),
      compareRow('Power', me.power, p.stats.power)),
    h('p', { class: 'small muted' }, `Abilities: ${CLASSES[p.class].abilities.filter((a) => p.abilities.includes(a.id)).map((a) => a.name).join(', ')}`)), { wide: true });
}

async function fight(opp) {
  const r = await act('/arena/fight', { opponentId: opp.id }, { rerender: false });
  if (!r) return;
  const outcome = h('div', { class: r.won ? 'win' : 'loss' }, h('h3', {}, r.won ? 'Victory!' : 'Defeat'),
    h('div', {}, `Rating ${r.ratingDelta >= 0 ? '+' : ''}${r.ratingDelta} → ${r.rating} `, tierBadge(r.tier)),
    h('div', {}, `+${r.tokens} Arena tokens · +${fmt(r.gold)} gold`),
    r.bonus ? h('div', { class: 'good' }, `Daily win bonus: +${r.bonus.tokens} tokens, +${fmt(r.bonus.gold)} gold!`) : null,
    r.farmLimited ? h('div', { class: 'muted small' }, 'You have fought this opponent too often today — no rating gained.') : null);
  showBattle(r, { title: `Arena: ${store.state.character.name} vs ${opp.name}`, outcome });
  load();
}

function build(state) {
  const c = state.character;
  const s = data.status;
  if (!s) { root = h('div', {}, h('p', { class: 'muted' }, 'Loading the Arena…')); return root; }
  if (c.level < s.minLevel) {
    root = h('section', { class: 'panel' }, h('h1', {}, 'The Arena'), h('p', {}, `The Arena opens at level ${s.minLevel}. Train, gear up and return to test your build against other players.`));
    return root;
  }
  const statusPanel = h('section', { class: 'panel arena-status' },
    h('div', { class: 'panel-head' }, h('h2', {}, `Season ${s.season.id}`), h('span', { class: 'muted small' }, 'ends in ', h('span', { dataset: { countdown: s.season.endsAt } }, duration(s.season.endsAt - serverNow())))),
    h('div', { class: 'arena-rating' }, tierBadge(s.tier), h('div', { class: 'big' }, s.rating), h('div', { class: 'muted small' }, `Rank #${s.rank} · Best ${s.bestRating} · ${s.wins}W / ${s.losses}L`)),
    h('div', { class: 'rates' },
      h('div', {}, h('span', { class: 'muted' }, 'Fights left today'), h('b', {}, s.fightsLeft)),
      h('div', {}, h('span', { class: 'muted' }, 'Wins today'), h('b', {}, `${s.winsToday}/${s.dailyBonus.needed}${s.dailyBonus.claimed ? ' ✔' : ''}`)),
      h('div', {}, h('span', { class: 'muted' }, 'Arena tokens'), h('b', {}, `🎟️ ${fmt(c.arenaTokens)}`))),
    h('div', { class: 'col gap mt' },
      h('button', { class: 'btn', disabled: s.extraBoughtToday >= s.maxExtra || undefined, onclick: async () => { if (await act('/arena/buy-fight', {}, { success: 'Extra fight purchased', rerender: false })) load(['status']); } },
        `Buy extra fight (${fmt(s.extraFightCost)} gold)`),
      s.weeklyClaimable ? h('button', { class: 'btn primary', onclick: async () => { if (await act('/arena/claim-weekly', {}, { success: 'Weekly reward claimed!', rerender: false })) load(['status']); } },
        `Claim weekly ${s.tier.name} reward (🎟️ ${s.weeklyReward.tokens}, 🪙 ${s.weeklyReward.gold})`) : h('div', { class: 'small muted' }, 'Weekly reward: fight 3+ battles this season, then claim once per week.'),
      s.pendingSeasonRewards.length ? h('button', { class: 'btn primary', onclick: async () => { if (await act('/arena/claim-season', {}, { success: 'Season rewards claimed!', rerender: false })) load(['status']); } },
        `Claim season rewards (${s.pendingSeasonRewards.map((r) => `${r.tier}: 🎟️${r.tokens}`).join(', ')})`) : null),
    h('p', { class: 'small muted' }, `Win: +${ARENA_CONFIG.win.tokens} tokens · Loss: +${ARENA_CONFIG.loss.tokens} token. ${ARENA_CONFIG.freeFightsPerDay} free fights per day. You never lose items or gold in PvP. Arena battles do not interrupt gathering or crafting.`));

  let oppPanel;
  if (!data.opponents) oppPanel = h('p', { class: 'muted' }, 'Finding opponents…');
  else if (data.opponents.error) oppPanel = h('p', { class: 'bad' }, data.opponents.error);
  else if (!data.opponents.length) oppPanel = h('p', { class: 'muted' }, 'No opponents yet — invite friends! Other players appear here once they reach level 5.');
  else {
    oppPanel = h('div', { class: 'opp-list' }, data.opponents.map((o) => h('div', { class: 'opp' },
      h('div', { class: 'opp-icon' }, o.icon),
      h('div', { class: 'opp-main' }, h('b', {}, o.name), o.title ? h('span', { class: 'muted small' }, ` ${o.title}`) : null,
        h('div', { class: 'small muted' }, `Lv ${o.level} ${RACES[o.race].name} ${CLASSES[o.class].name} · Power ${fmt(o.profile.stats.power)}`),
        h('div', { class: 'row gap center-v' }, tierBadge(o.tier), h('span', { class: 'small' }, o.rating), o.farmLimited ? h('span', { class: 'tag bad small' }, 'no rating today') : null)),
      h('div', { class: 'row gap' },
        h('button', { class: 'btn small ghost', onclick: () => inspect(o) }, 'Inspect'),
        h('button', { class: 'btn small primary', disabled: s.fightsLeft < 1 || undefined, onclick: () => fight(o) }, 'Fight')))));
  }

  const ladder = h('div', { class: 'ladder' }, ARENA_TIERS.map((t) => h('div', { class: `ladder-step ${s.tier.id === t.id ? 'current' : ''}`, style: { '--tc': t.color } },
    h('b', {}, t.name), h('span', { class: 'small muted' }, `${t.min}+`), h('span', { class: 'small' }, `Weekly 🎟️${t.weeklyTokens}${t.title ? ` · “${t.title}”` : ''}`))));

  const shop = h('div', { class: 'shop-grid' }, ARENA_SHOP.map((it) => h('div', { class: 'shop-item' },
    h('b', {}, it.name), h('div', { class: 'small muted' }, it.unique ? 'Bound epic set piece, scales to your level' : it.title ? 'Cosmetic title' : it.ticket ? 'One extra Arena fight' : it.resource ? 'Legendary crafting material (tradable)' : 'Consumables'),
    h('button', { class: 'btn small', disabled: c.arenaTokens < it.cost || (it.minLevel && c.level < it.minLevel) || undefined,
      onclick: async () => { if (await act('/arena/shop', { shopId: it.id }, { success: `Bought ${it.name}`, rerender: false })) load(['status']); } },
    `🎟️ ${it.cost}`))));

  const history = h('div', { class: 'history' }, (data.history || []).map((m) => h('div', { class: 'row between center-v hist-row' },
    h('span', {}, h('b', { class: m.won ? 'good' : 'bad' }, m.won ? 'W' : 'L'), ` ${m.attacking ? 'vs' : 'defended vs'} ${m.opponent}`),
    h('span', { class: 'small muted' }, `${m.delta >= 0 ? '+' : ''}${m.delta} · ${timeAgo(m.createdAt)}`),
    h('button', { class: 'btn tiny ghost', onclick: async () => { const r = await get(`/arena/match/${m.id}`); showBattle(r.result, { title: 'Replay' }); } }, 'Replay'))));

  root = h('div', { class: 'arena-layout' },
    h('div', { class: 'page-head' }, h('h1', {}, 'The Arena'), h('p', { class: 'muted' }, 'Automatic battles against other players using their real, server-side builds. PvP uses separate balancing: more health, weaker heals and capped crit/dodge.')),
    h('div', { class: 'arena-grid' },
      statusPanel,
      h('section', { class: 'panel' }, h('div', { class: 'panel-head' }, h('h2', {}, 'Opponents'), h('button', { class: 'btn tiny ghost', onclick: () => load(['opponents']) }, '↻ Refresh')), oppPanel),
      h('section', { class: 'panel' }, h('h2', {}, 'Tiers'), ladder),
      h('section', { class: 'panel' }, h('h2', {}, 'Token shop'), shop),
      h('section', { class: 'panel' }, h('h2', {}, 'Match history'), history.childNodes.length ? history : h('p', { class: 'muted' }, 'No matches yet.'))));
  return root;
}

export function render(state) {
  if (!data.status) load();
  const el = build(state);
  return el;
}
