// Express app: JSON API + static client. Every game action runs inside one DB transaction:
// load character -> advance offline progress (tick) -> validate & apply action -> save.
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { tx, GameError, q } from './db.js';
import * as auth from './auth.js';
import { loadCharByUser, loadChar, saveChar, createCharacter, allocateAttribute, getEquipped, publicProfile, publicItem, statsFor } from './game/characters.js';
import * as inv from './game/inventory.js';
import * as act from './game/activities.js';
import * as combat from './game/combat.js';
import * as shop from './game/shop.js';
import * as ah from './game/auction.js';
import * as arena from './game/arena.js';
import { BALANCE } from '../shared/balance.js';
import { inventoryUpgradeCost } from '../shared/rules.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// --- tiny per-user rate limiter (token bucket) ---
const buckets = new Map();
function rateLimit(key, perSecond = 8, burst = 25) {
  const now = Date.now();
  const b = buckets.get(key) || { tokens: burst, at: now };
  b.tokens = Math.min(burst, b.tokens + ((now - b.at) / 1000) * perSecond);
  b.at = now;
  if (b.tokens < 1) throw new GameError('Too many requests, slow down.', 429);
  b.tokens -= 1;
  buckets.set(key, b);
}
setInterval(() => { const cut = Date.now() - 600000; for (const [k, b] of buckets) if (b.at < cut) buckets.delete(k); }, 300000).unref();

export function buildState(c, summary = null) {
  const equipped = getEquipped(c.id);
  const { stats, sets } = statsFor(c);
  const items = q("SELECT * FROM items WHERE char_id = ? AND location = 'inventory' ORDER BY position").all(c.id);
  return {
    now: Date.now(),
    character: {
      id: c.id, name: c.name, race: c.race, class: c.class, level: c.level, xp: c.xp, attrPoints: c.attr_points, alloc: c.alloc,
      gold: c.gold, arenaTokens: c.arena_tokens, location: c.location, discovered: c.discovered, visited: c.visited,
      stamina: Math.floor(c.stamina * 10) / 10, staminaMax: BALANCE.staminaMax, staminaRegenSeconds: BALANCE.staminaRegenSeconds,
      activity: c.activity, professions: c.professions, buffs: c.buffs, invSize: c.inv_size, invUpgradeCost: c.inv_size < BALANCE.maxInventorySize ? inventoryUpgradeCost(c.inv_size) : null,
      titles: c.titles, title: c.title, bossesDefeated: c.bosses_defeated,
    },
    stats, sets,
    equipped: equipped.map(publicItem),
    inventory: items.map((r) => publicItem({ ...r, stats: JSON.parse(r.stats), affixes: JSON.parse(r.affixes), bound: !!r.bound })),
    log: combat.recentLog(c.id),
    pendingPayout: ah.pendingPayout(c.id),
    summary,
  };
}

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '32kb' }));
  app.use((req, res, next) => {
    res.set({
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'Referrer-Policy': 'same-origin',
      'Content-Security-Policy': "default-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data:",
    });
    next();
  });

  // --- auth middleware ---
  app.use('/api', (req, res, next) => {
    const cookies = auth.parseCookies(req.headers.cookie);
    req.token = cookies[auth.COOKIE];
    req.user = auth.userFromToken(req.token);
    // CSRF: state-changing requests must be JSON with a custom header (not sendable cross-site without CORS)
    if (req.method !== 'GET' && req.get('X-Requested-With') !== 'idle-rpg') return res.status(403).json({ error: 'Bad request origin.' });
    try { rateLimit(req.user ? `u${req.user.id}` : `ip${req.ip}`); } catch (e) { return res.status(429).json({ error: e.message }); }
    next();
  });

  const setCookie = (res, s) => res.cookie(auth.COOKIE, s.token, { httpOnly: true, sameSite: 'lax', secure: process.env.COOKIE_SECURE === '1', maxAge: s.maxAge, path: '/' });

  const handle = (fn) => (req, res) => {
    try {
      const out = fn(req, res);
      if (!res.headersSent) res.json(out ?? { ok: true });
    } catch (err) {
      if (err instanceof GameError) return res.status(err.status).json({ error: err.message });
      console.error(err);
      res.status(500).json({ error: 'Something went wrong.' });
    }
  };
  const needUser = (req) => { if (!req.user) throw new GameError('Please log in.', 401); return req.user; };

  /** Run an action on the caller's character atomically, then return fresh state. */
  const action = (fn, { state = true } = {}) => handle((req) => {
    const user = needUser(req);
    return tx(() => {
      const c = loadCharByUser(user.id);
      if (!c) throw new GameError('Create a character first.', 404);
      const summary = act.tick(c);
      const result = fn(c, req.body || {}, req, user);
      saveChar(c);
      return state ? { ok: true, result, state: buildState(c, summary) } : { ok: true, result };
    });
  });

  // ---------- Auth ----------
  app.post('/api/auth/register', handle((req, res) => {
    const s = tx(() => auth.register(req.body?.username, req.body?.password));
    setCookie(res, s);
    return { ok: true };
  }));
  app.post('/api/auth/login', handle((req, res) => {
    rateLimit(`login${req.ip}`, 0.5, 8);
    const s = auth.login(req.body?.username, req.body?.password);
    setCookie(res, s);
    return { ok: true };
  }));
  app.post('/api/auth/logout', handle((req, res) => {
    auth.logout(req.token);
    res.clearCookie(auth.COOKIE, { path: '/' });
    return { ok: true };
  }));
  app.get('/api/me', handle((req) => {
    if (!req.user) return { user: null };
    const c = loadCharByUser(req.user.id);
    return { user: { username: req.user.username }, hasCharacter: !!c };
  }));
  app.post('/api/character', handle((req) => {
    const user = needUser(req);
    return tx(() => {
      const id = createCharacter(user.id, { name: req.body?.name, race: req.body?.race, cls: req.body?.cls });
      const c = loadChar(id);
      shop.giveStarterKit(c);
      saveChar(c);
      return { ok: true };
    });
  }));

  // ---------- Core state ----------
  app.get('/api/state', handle((req) => {
    const user = needUser(req);
    return tx(() => {
      const c = loadCharByUser(user.id);
      if (!c) throw new GameError('Create a character first.', 404);
      const summary = act.tick(c);
      saveChar(c);
      return buildState(c, summary);
    });
  }));
  app.get('/api/quests', action((c) => act.questOffers(c)));

  app.post('/api/attributes', action((c, b) => allocateAttribute(c, b.attr, b.amount)));
  app.post('/api/title', action((c, b) => {
    if (b.title && !c.titles.includes(b.title)) throw new GameError('You do not own that title.');
    c.title = b.title || null;
  }));

  // Inventory & equipment
  app.post('/api/equip', action((c, b) => inv.equip(c, b.itemId, b.slot)));
  app.post('/api/unequip', action((c, b) => inv.unequip(c, String(b.slot), Number.isInteger(b.position) ? b.position : undefined)));
  app.post('/api/move', action((c, b) => inv.moveItem(c, b.itemId, b.position)));
  app.post('/api/sell', action((c, b) => inv.sellToMerchant(c, b.itemId, b.qty)));
  app.post('/api/use', action((c, b) => inv.useConsumable(c, b.itemId)));
  app.post('/api/shop/buy', action((c, b) => shop.buyFromShop(c, b.stockId, b.qty)));
  app.get('/api/shop', handle(() => shop.SHOP_STOCK));
  app.post('/api/inventory/upgrade', action((c) => shop.upgradeInventory(c)));

  // Activities
  app.post('/api/travel', action((c, b) => act.startTravel(c, String(b.to))));
  app.post('/api/gather', action((c, b) => act.startGathering(c, String(b.activityId))));
  app.post('/api/craft', action((c, b) => act.startCrafting(c, String(b.recipeId), b.count)));
  app.post('/api/quest', action((c, b) => act.startQuest(c, String(b.questId))));
  app.post('/api/stop', action((c) => act.stopActivity(c)));
  app.post('/api/fight', action((c, b) => combat.fightEnemy(c, String(b.enemyId))));

  // Players
  app.get('/api/player/:id', handle((req) => { needUser(req); return publicProfile(Number(req.params.id)); }));

  // ---------- Auction House ----------
  app.get('/api/market', handle((req) => {
    needUser(req);
    tx(() => ah.expireListings());
    return ah.browse(req.query);
  }));
  app.get('/api/market/stats/:key', handle((req) => { needUser(req); return ah.marketStats(String(req.params.key)); }));
  app.get('/api/market/mine', handle((req) => {
    const user = needUser(req);
    const c = loadCharByUser(user.id);
    tx(() => ah.expireListings());
    return { listings: ah.myListings(c.id), history: ah.history(c.id), pendingPayout: ah.pendingPayout(c.id), maxListings: ah.maxListings(c.level), config: ah.AH };
  }));
  app.post('/api/market/list', action((c, b, req, user) => { ah.expireListings(); return ah.createListing(c, user.id, b); }));
  app.post('/api/market/buy', action((c, b, req, user) => { rateLimit(`buy${user.id}`, 2, 6); ah.expireListings(); return ah.buyListing(c, user.id, b); }));
  app.post('/api/market/cancel', action((c, b) => ah.cancelListing(c, b.listingId)));
  app.post('/api/market/collect', action((c) => ah.collectPayouts(c)));

  // ---------- Arena ----------
  app.get('/api/arena', action((c) => arena.arenaStatus(c), { state: false }));
  app.get('/api/arena/opponents', action((c) => arena.findOpponents(c), { state: false }));
  app.post('/api/arena/fight', action((c, b, req, user) => { rateLimit(`arena${user.id}`, 0.5, 3); return arena.challenge(c, b.opponentId); }));
  app.post('/api/arena/buy-fight', action((c) => arena.buyExtraFight(c)));
  app.post('/api/arena/claim-weekly', action((c) => arena.claimWeekly(c)));
  app.post('/api/arena/claim-season', action((c) => arena.claimSeasonRewards(c)));
  app.post('/api/arena/shop', action((c, b) => arena.buyArenaShop(c, String(b.shopId))));
  app.get('/api/arena/history', action((c) => arena.matchHistory(c.id), { state: false }));
  app.get('/api/arena/match/:id', action((c, b, req) => arena.matchReplay(c.id, req.params.id), { state: false }));
  app.get('/api/leaderboard', handle((req) => { needUser(req); return tx(() => ({ season: arena.currentSeason(), rows: arena.leaderboard(req.query.kind === 'level' ? 'level' : 'arena') })); }));

  app.use('/api', (req, res) => res.status(404).json({ error: 'Not found.' }));

  // ---------- Static client ----------
  app.use('/shared', express.static(path.join(ROOT, 'shared'), { maxAge: 0 }));
  app.use(express.static(path.join(ROOT, 'client'), { maxAge: 0 }));
  return app;
}
