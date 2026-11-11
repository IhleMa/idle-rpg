// End-to-end tests against the real HTTP API with an in-memory database.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { openDb, q } from '../server/db.js';
import { createApp } from '../server/app.js';

let server;
let base;

before(async () => {
  openDb(':memory:');
  server = createApp().listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => server.close());

function client() {
  let cookie = '';
  const call = async (method, path, body) => {
    const res = await fetch(base + path, {
      method,
      headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'idle-rpg', cookie },
      body: body ? JSON.stringify(body) : undefined,
    });
    const set = res.headers.get('set-cookie');
    if (set) cookie = set.split(';')[0];
    const json = await res.json();
    return { status: res.status, ...json };
  };
  return { get: (p) => call('GET', p), post: (p, b) => call('POST', p, b) };
}

let n = 0;
async function newPlayer(race = 'human', cls = 'warrior') {
  const c = client();
  const name = `Hero${++n}x`;
  assert.equal((await c.post('/api/auth/register', { username: `user${n}x`, password: 'secret-pass' })).ok, true);
  const r = await c.post('/api/character', { name, race, cls });
  assert.equal(r.ok, true, r.error);
  const st = await c.get('/api/state');
  return { c, name, id: st.character.id, st };
}

const charRow = (id) => q('SELECT * FROM characters WHERE id = ?').get(id);
const setChar = (id, fields) => {
  for (const [k, v] of Object.entries(fields)) q(`UPDATE characters SET ${k} = ? WHERE id = ?`).run(typeof v === 'object' ? JSON.stringify(v) : v, id);
};
const rewind = (id, ms) => {
  const a = JSON.parse(charRow(id).activity);
  for (const k of ['startedAt', 'lastAt', 'endsAt', 'nextAt']) if (a[k]) a[k] -= ms;
  setChar(id, { activity: a });
};
const giveRes = (id, res, qty) => q(`INSERT INTO items (char_id, kind, base, name, quantity, location, position, created_at) VALUES (?, 'resource', ?, ?, ?, 'inventory', 900 + ?, ?)`).run(id, res, res, qty, Math.floor(Math.random() * 1000), Date.now());

test('auth protects the API and rejects cross-site posts', async () => {
  const anon = client();
  assert.equal((await anon.get('/api/state')).status, 401);
  const res = await fetch(base + '/api/auth/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
  assert.equal(res.status, 403);
});

test('character creation gives a starter kit with all tool slots', async () => {
  const { st } = await newPlayer('elf', 'ranger');
  const slots = st.equipped.map((i) => i.slot).sort();
  for (const s of ['tool_axe', 'tool_pickaxe', 'tool_sickle', 'tool_bow', 'tool_rod', 'weapon', 'chest', 'boots']) assert.ok(slots.includes(s), s);
  assert.equal(st.character.location, 'greenhollow');
  assert.ok(st.stats.health > 0 && st.stats.damage > 0);
});

test('gathering progresses offline from timestamps and levels the profession', async () => {
  const { c, id } = await newPlayer();
  assert.equal((await c.post('/api/gather', { activityId: 'herbalism' })).ok, true);
  rewind(id, 10 * 60 * 1000); // 10 minutes away
  const st = await c.get('/api/state');
  const herbs = st.inventory.filter((i) => ['flax', 'greenleaf'].includes(i.base)).reduce((s, i) => s + i.quantity, 0);
  assert.ok(herbs > 50, `gathered ${herbs}`);
  assert.ok(st.character.professions.herbalism.level > 1);
  assert.equal(st.character.activity.type, 'gather');
});

test('offline progress is capped', async () => {
  const { c, id } = await newPlayer();
  await c.post('/api/inventory/upgrade').catch(() => {});
  await c.post('/api/gather', { activityId: 'fishing' });
  rewind(id, 72 * 3600 * 1000);
  const st = await c.get('/api/state');
  const fish = st.inventory.filter((i) => i.base === 'river_trout' || i.base === 'salmon').reduce((s, i) => s + i.quantity, 0);
  assert.ok(fish < (12 * 3600) / 1.5 + 100, `capped (${fish})`);
});

test('travel takes time, then arrives and discovers neighbours', async () => {
  const { c, id } = await newPlayer();
  const r = await c.post('/api/travel', { to: 'whisperwood' });
  assert.equal(r.ok, true, r.error);
  assert.equal(r.state.character.location, 'greenhollow');
  const fail = await c.post('/api/gather', { activityId: 'woodcutting' });
  assert.equal(fail.status, 400);
  rewind(id, 3600 * 1000);
  const st = await c.get('/api/state');
  assert.equal(st.character.location, 'whisperwood');
  assert.ok(st.character.discovered.includes('ironpeak'));
  const locked = await c.post('/api/travel', { to: 'ironpeak' });
  assert.match(locked.error, /level/i);
});

test('crafting consumes materials and produces items over time', async () => {
  const { c, id } = await newPlayer();
  giveRes(id, 'copper_ore', 10);
  const before = (await c.get('/api/state')).inventory.length;
  const r = await c.post('/api/craft', { recipeId: 'copper_bar', count: 5 });
  assert.equal(r.ok, true, r.error);
  rewind(id, 60 * 1000);
  const st = await c.get('/api/state');
  assert.equal(st.inventory.find((i) => i.base === 'copper_bar')?.quantity, 5);
  assert.ok(!st.inventory.find((i) => i.base === 'copper_ore'));
  assert.ok(st.character.professions.blacksmithing.xp > 0 || st.character.professions.blacksmithing.level > 1);
  assert.ok(before > 0);
  giveRes(id, 'copper_bar', 10); giveRes(id, 'oak_log', 10);
  await c.post('/api/craft', { recipeId: 'sword_t0', count: 1 });
  rewind(id, 120 * 1000);
  const st2 = await c.get('/api/state');
  assert.ok(st2.inventory.some((i) => i.kind === 'equipment' && i.base === 'sword' && i.crafted_by));
});

test('PvE combat costs stamina and returns a replayable log', async () => {
  const { c } = await newPlayer('orc', 'warrior');
  const r = await c.post('/api/fight', { enemyId: 'giant_rat' });
  assert.equal(r.ok, true, r.error);
  assert.ok(r.result.log.length > 2);
  assert.equal(r.result.won, true);
  assert.ok(r.state.character.stamina <= 90.1);
  const bad = await c.post('/api/fight', { enemyId: 'ashen_dragon' });
  assert.equal(bad.status, 400);
});

test('quests run on a timer and resolve with a fight', async () => {
  const { c, id } = await newPlayer();
  const offers = (await c.get('/api/quests')).result;
  assert.equal(offers.length, 3);
  await c.post('/api/quest', { questId: offers[0].id });
  rewind(id, 3600 * 1000);
  const st = await c.get('/api/state');
  assert.equal(st.character.activity.type, 'idle');
  assert.equal(st.summary.quests.length, 1);
});

test('equipping validates slots and level; drag-to-slot works', async () => {
  const { c, st } = await newPlayer();
  const pot = st.inventory.find((i) => i.kind === 'consumable');
  assert.equal((await c.post('/api/equip', { itemId: pot.id })).status, 400);
  const weapon = st.equipped.find((i) => i.slot === 'weapon');
  const un = await c.post('/api/unequip', { slot: 'weapon', position: 7 });
  assert.equal(un.ok, true);
  assert.equal(un.state.inventory.find((i) => i.id === weapon.id).position, 7);
  assert.equal((await c.post('/api/equip', { itemId: weapon.id, slot: 'helmet' })).status, 400);
  assert.equal((await c.post('/api/equip', { itemId: weapon.id, slot: 'weapon' })).ok, true);
});

test('auction house: list, buy, tax, payouts, and no double-spend', async () => {
  const seller = await newPlayer();
  const b1 = await newPlayer();
  const b2 = await newPlayer();
  for (const p of [seller, b1, b2]) setChar(p.id, { level: 10, gold: 1000 });
  giveRes(seller.id, 'iron_ore', 20);
  const st = await seller.c.get('/api/state');
  const ore = st.inventory.find((i) => i.base === 'iron_ore');

  // cannot list equipped
  const eq = st.equipped[0];
  assert.match((await seller.c.post('/api/market/list', { itemId: eq.id, quantity: 1, unitPrice: 5, hours: 24 })).error, /unequip|inventory/i);

  const listed = await seller.c.post('/api/market/list', { itemId: ore.id, quantity: 20, unitPrice: 10, hours: 24, requestId: 'req-list-0001' });
  assert.equal(listed.ok, true, listed.error);
  const fee = 1000 - listed.state.character.gold;
  assert.ok(fee >= 1);
  assert.equal((await seller.c.post('/api/market/list', { itemId: ore.id, quantity: 1, unitPrice: 10, hours: 24, requestId: 'req-list-0001' })).status, 409);
  const listingId = listed.result;

  assert.match((await seller.c.post('/api/market/buy', { listingId, quantity: 1 })).error, /own/);

  // Two buyers race for the full stack at the same time
  const [r1, r2] = await Promise.all([
    b1.c.post('/api/market/buy', { listingId, quantity: 20, requestId: 'buy-race-aaaa' }),
    b2.c.post('/api/market/buy', { listingId, quantity: 20, requestId: 'buy-race-bbbb' }),
  ]);
  const wins = [r1, r2].filter((r) => r.ok);
  assert.equal(wins.length, 1, 'exactly one purchase succeeds');
  const winner = r1.ok ? b1 : b2;
  const loser = r1.ok ? b2 : b1;
  assert.equal(charRow(winner.id).gold, 800);
  assert.equal(charRow(loser.id).gold, 1000);
  const total = q("SELECT COALESCE(SUM(quantity),0) AS n FROM items WHERE base = 'iron_ore' AND char_id = ?").get(winner.id).n;
  assert.equal(total, 20);
  assert.equal(q("SELECT COUNT(*) AS n FROM items WHERE base = 'iron_ore' AND char_id = ?").get(seller.id).n, 0);

  // Seller collects proceeds minus 5% tax
  const col = await seller.c.post('/api/market/collect');
  assert.equal(col.result, 190);
  assert.equal(charRow(seller.id).gold, 1000 - fee + 190);
  assert.equal((await seller.c.post('/api/market/collect')).status, 400);

  // Stats and history
  const stats = await seller.c.get('/api/market/stats/iron_ore');
  assert.equal(stats.recentSales.length, 1);
  const mine = await seller.c.get('/api/market/mine');
  assert.equal(mine.history[0].side, 'sold');
});

test('auction house: partial stack purchase, filters and cancel', async () => {
  const seller = await newPlayer();
  const buyer = await newPlayer();
  setChar(seller.id, { level: 10, gold: 500 });
  setChar(buyer.id, { level: 10, gold: 500 });
  giveRes(seller.id, 'oak_log', 30);
  const ore = (await seller.c.get('/api/state')).inventory.find((i) => i.base === 'oak_log');
  const l = await seller.c.post('/api/market/list', { itemId: ore.id, quantity: 10, unitPrice: 3, hours: 12 });
  assert.equal(l.ok, true, l.error);
  assert.equal(l.state.inventory.find((i) => i.base === 'oak_log').quantity, 20);
  const browse = await buyer.c.get('/api/market?category=wood&sort=price_asc');
  assert.ok(browse.listings.some((x) => x.id === l.result));
  const b = await buyer.c.post('/api/market/buy', { listingId: l.result, quantity: 4 });
  assert.equal(b.ok, true, b.error);
  assert.equal(q('SELECT quantity FROM listings WHERE id = ?').get(l.result).quantity, 6);
  const cancel = await seller.c.post('/api/market/cancel', { listingId: l.result });
  assert.equal(cancel.ok, true);
  assert.equal(cancel.state.inventory.filter((i) => i.base === 'oak_log').reduce((s, i) => s + i.quantity, 0), 26);
  // equipment with affix filter
  const st = await seller.c.get('/api/state');
  const tool = st.equipped.find((i) => i.slot === 'tool_pickaxe');
  await seller.c.post('/api/unequip', { slot: 'tool_pickaxe' });
  const l2 = await seller.c.post('/api/market/list', { itemId: tool.id, unitPrice: 50, hours: 24 });
  assert.equal(l2.ok, true, l2.error);
  const f = await buyer.c.get('/api/market?stat=miningSpeed');
  assert.ok(f.listings.some((x) => x.id === l2.result));
});

test('arena: matchmaking, rating changes, daily limits and anti-farming', async () => {
  const a = await newPlayer('orc', 'warrior');
  const d = await newPlayer('dwarf', 'paladin');
  setChar(a.id, { level: 10 });
  setChar(d.id, { level: 10 });
  const status = await a.c.get('/api/arena');
  assert.equal(status.result.fightsLeft, 5);
  const opps = await a.c.get('/api/arena/opponents');
  assert.ok(opps.result.some((o) => o.id === d.id));
  const ratings = [];
  for (let i = 0; i < 3; i++) {
    const f = await a.c.post('/api/arena/fight', { opponentId: d.id });
    assert.equal(f.ok, true, f.error);
    assert.ok(f.result.log.length > 0);
    ratings.push(f.result);
  }
  assert.ok(ratings[0].ratingDelta !== 0);
  assert.equal(ratings[2].farmLimited, true);
  assert.ok(ratings[2].ratingDelta <= 0);
  const st2 = await a.c.get('/api/arena');
  assert.equal(st2.result.fightsLeft, 2);
  // defender lost nothing material
  assert.ok(charRow(d.id).gold >= 100);
  const lb = await a.c.get('/api/leaderboard');
  assert.ok(lb.rows.length >= 1);
});

test('arena season rollover pays rewards and soft-resets rating', async () => {
  const a = await newPlayer();
  const d = await newPlayer();
  setChar(a.id, { level: 10 }); setChar(d.id, { level: 10 });
  await a.c.post('/api/arena/fight', { opponentId: d.id });
  q('UPDATE arena_profiles SET rating = 1400 WHERE char_id = ?').run(a.id);
  q('UPDATE arena_seasons SET ends_at = ? WHERE finalized = 0').run(Date.now() - 1000);
  const st = await a.c.get('/api/arena');
  assert.equal(st.result.rating, 1200);
  assert.ok(st.result.pendingSeasonRewards.length === 1);
  const claim = await a.c.post('/api/arena/claim-season');
  assert.equal(claim.ok, true);
});
