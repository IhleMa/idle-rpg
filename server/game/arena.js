// PvP Arena: matchmaking, Elo rating, daily limits, anti-farming, seasons and rewards.
// Defenders are offline: their current server-side character is used, never client data.
import { q, GameError } from '../db.js';
import { ARENA_CONFIG as CFG, ARENA_TIERS, ARENA_SHOP, tierForRating } from '../../shared/data/arena.js';
import { RACES } from '../../shared/data/races.js';
import { simulateFight } from '../../shared/combat.js';
import { loadChar, addLog, publicProfile } from './characters.js';
import { buildFighter, seed } from './combat.js';
import { addStack, addEquipment } from './inventory.js';
import { generateUnique } from './loot.js';

const DAY = 86400000;
export const dayKey = (t = Date.now()) => new Date(t).toISOString().slice(0, 10);
export function weekKey(t = Date.now()) {
  const d = new Date(t);
  const day = (d.getUTCDay() + 6) % 7; // Monday = 0
  const monday = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - day));
  return monday.toISOString().slice(0, 10);
}

/** Current season; finalizes finished seasons (rewards + soft reset) lazily. */
export function currentSeason(now = Date.now()) {
  let s = q('SELECT * FROM arena_seasons WHERE finalized = 0 ORDER BY id DESC LIMIT 1').get();
  if (!s) {
    const info = q('INSERT INTO arena_seasons (started_at, ends_at) VALUES (?, ?)').run(now, now + CFG.seasonDays * DAY);
    return q('SELECT * FROM arena_seasons WHERE id = ?').get(Number(info.lastInsertRowid));
  }
  while (now >= s.ends_at) {
    finalizeSeason(s);
    const info = q('INSERT INTO arena_seasons (started_at, ends_at) VALUES (?, ?)').run(s.ends_at, s.ends_at + CFG.seasonDays * DAY);
    s = q('SELECT * FROM arena_seasons WHERE id = ?').get(Number(info.lastInsertRowid));
    q('UPDATE arena_profiles SET season_id = ?').run(s.id);
  }
  return s;
}

function finalizeSeason(s) {
  const rows = q('SELECT * FROM arena_profiles WHERE season_id = ? AND (wins + losses) > 0 ORDER BY rating DESC').all(s.id);
  rows.forEach((p, idx) => {
    const tier = tierForRating(p.rating);
    q(`INSERT OR IGNORE INTO arena_rewards (char_id, season_id, tier, rating, rank, tokens, gold, title, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(p.char_id, s.id, tier.id, p.rating, idx + 1, tier.seasonTokens + (idx < 3 ? 100 - idx * 30 : 0),
      tier.weeklyGold * 2, tier.title || null, Date.now());
    addLog(p.char_id, 'arena', `Arena season ${s.id} ended. You finished #${idx + 1} in ${tier.name}. Claim your rewards in the Arena.`);
  });
  q(`UPDATE arena_profiles SET rating = ? + CAST((rating - ?) * ? AS INTEGER), wins = 0, losses = 0 WHERE season_id = ?`)
    .run(CFG.startRating, CFG.startRating, CFG.softResetFactor, s.id);
  q('UPDATE arena_seasons SET finalized = 1 WHERE id = ?').run(s.id);
}

export function getProfile(charId, season = currentSeason()) {
  let p = q('SELECT * FROM arena_profiles WHERE char_id = ?').get(charId);
  if (!p) {
    q('INSERT INTO arena_profiles (char_id, season_id, rating, best_rating, updated_at) VALUES (?, ?, ?, ?, ?)')
      .run(charId, season.id, CFG.startRating, CFG.startRating, Date.now());
    p = q('SELECT * FROM arena_profiles WHERE char_id = ?').get(charId);
  }
  const today = dayKey();
  if (p.day !== today) {
    q('UPDATE arena_profiles SET day = ?, fights_today = 0, wins_today = 0, extra_bought_today = 0 WHERE char_id = ?').run(today, charId);
    p = q('SELECT * FROM arena_profiles WHERE char_id = ?').get(charId);
  }
  return p;
}

function fightsLeft(p) {
  return Math.max(0, CFG.freeFightsPerDay - p.fights_today) + p.extra_fights;
}

export const extraFightCost = (level, boughtToday) => Math.round((20 + level * 5) * (1 + boughtToday));

export function arenaStatus(c) {
  const season = currentSeason();
  const p = getProfile(c.id, season);
  const tier = tierForRating(p.rating);
  const rank = q('SELECT COUNT(*) + 1 AS r FROM arena_profiles WHERE rating > ? AND (wins + losses) > 0').get(p.rating).r;
  const pending = q('SELECT * FROM arena_rewards WHERE char_id = ? AND claimed = 0').all(c.id);
  const week = weekKey();
  return {
    season: { id: season.id, startedAt: season.started_at, endsAt: season.ends_at },
    rating: p.rating, bestRating: p.best_rating, wins: p.wins, losses: p.losses, tier, rank,
    fightsLeft: fightsLeft(p), freeLeft: Math.max(0, CFG.freeFightsPerDay - p.fights_today), extraFights: p.extra_fights,
    winsToday: p.wins_today, dailyBonus: { needed: CFG.dailyWinBonus.wins, claimed: p.daily_bonus_claimed === dayKey() },
    extraFightCost: extraFightCost(c.level, p.extra_bought_today), extraBoughtToday: p.extra_bought_today, maxExtra: CFG.maxExtraFightsPerDay,
    weeklyClaimable: p.weekly_claimed !== week && p.wins + p.losses >= 3, weeklyReward: { tokens: tier.weeklyTokens, gold: tier.weeklyGold },
    pendingSeasonRewards: pending,
    tokens: c.arena_tokens,
    minLevel: CFG.minLevelToEnter,
  };
}

function eligibleCheck(c) {
  if (c.level < CFG.minLevelToEnter) throw new GameError(`The Arena opens at level ${CFG.minLevelToEnter}.`);
}

export function findOpponents(c) {
  eligibleCheck(c);
  const p = getProfile(c.id);
  const todayStart = Date.parse(dayKey() + 'T00:00:00Z');
  const rows = q(`SELECT ch.id, ch.name, ch.level, ch.race, ch.class, ch.title, COALESCE(ap.rating, ?) AS rating
      FROM characters ch LEFT JOIN arena_profiles ap ON ap.char_id = ch.id
      WHERE ch.id != ? AND ch.level >= ?
      ORDER BY (ABS(ch.level - ?) > ?) ASC, ABS(COALESCE(ap.rating, ?) - ?) ASC, ABS(ch.level - ?) ASC LIMIT 6`)
    .all(CFG.startRating, c.id, CFG.minLevelToEnter, c.level, CFG.levelWindow, CFG.startRating, p.rating, c.level);
  return rows.map((r) => {
    const fought = q('SELECT COUNT(*) AS n FROM arena_matches WHERE attacker_id = ? AND defender_id = ? AND created_at >= ?').get(c.id, r.id, todayStart).n;
    const prof = publicProfile(r.id);
    return { ...r, tier: tierForRating(r.rating), foughtToday: fought, farmLimited: fought >= CFG.sameOpponentDailyLimit, icon: RACES[r.race].icon, profile: prof };
  });
}

export function challenge(c, opponentId) {
  eligibleCheck(c);
  opponentId = Number(opponentId);
  if (opponentId === c.id) throw new GameError('You cannot fight yourself.');
  const opp = loadChar(opponentId);
  if (!opp || opp.level < CFG.minLevelToEnter) throw new GameError('That opponent is not available.');
  if (Math.abs(opp.level - c.level) > 15) throw new GameError('That opponent is too far from your level.');
  const season = currentSeason();
  const me = getProfile(c.id, season);
  const them = getProfile(opp.id, season);
  if (fightsLeft(me) <= 0) throw new GameError('No Arena fights left today. Buy an extra fight or come back tomorrow.');
  const usingExtra = me.fights_today >= CFG.freeFightsPerDay;

  const todayStart = Date.parse(dayKey() + 'T00:00:00Z');
  const fought = q('SELECT COUNT(*) AS n FROM arena_matches WHERE attacker_id = ? AND defender_id = ? AND created_at >= ?').get(c.id, opp.id, todayStart).n;
  const farmLimited = fought >= CFG.sameOpponentDailyLimit;

  const result = simulateFight(buildFighter(c, { pvp: true }), buildFighter(opp, { pvp: true }), { seed: seed(), pvp: true });
  const won = result.winner === 0;
  const expected = 1 / (1 + Math.pow(10, (them.rating - me.rating) / 400));
  let myDelta = Math.round(CFG.kFactor * ((won ? 1 : 0) - expected));
  let theirDelta = -Math.round(myDelta * 0.5); // defenders are offline: half stakes
  if (farmLimited) { if (myDelta > 0) myDelta = 0; theirDelta = 0; }
  const myNew = Math.max(0, me.rating + myDelta);
  const theirNew = Math.max(0, them.rating + theirDelta);

  const reward = won ? CFG.win : CFG.loss;
  const tokens = reward.tokens;
  const gold = reward.goldPerLevel * c.level;
  c.arena_tokens += tokens;
  c.gold += gold;

  const winsToday = me.wins_today + (won ? 1 : 0);
  let bonus = null;
  if (won && winsToday >= CFG.dailyWinBonus.wins && me.daily_bonus_claimed !== dayKey()) {
    bonus = { tokens: CFG.dailyWinBonus.tokens, gold: CFG.dailyWinBonus.goldPerLevel * c.level };
    c.arena_tokens += bonus.tokens;
    c.gold += bonus.gold;
  }

  q(`UPDATE arena_profiles SET rating = ?, best_rating = MAX(best_rating, ?), wins = wins + ?, losses = losses + ?, fights_today = fights_today + 1,
     wins_today = ?, extra_fights = extra_fights - ?, daily_bonus_claimed = CASE WHEN ? THEN ? ELSE daily_bonus_claimed END, updated_at = ? WHERE char_id = ?`)
    .run(myNew, myNew, won ? 1 : 0, won ? 0 : 1, winsToday, usingExtra ? 1 : 0, bonus ? 1 : 0, dayKey(), Date.now(), c.id);
  q('UPDATE arena_profiles SET rating = ?, best_rating = MAX(best_rating, ?), updated_at = ? WHERE char_id = ?').run(theirNew, theirNew, Date.now(), opp.id);

  const info = q(`INSERT INTO arena_matches (season_id, attacker_id, defender_id, winner_id, attacker_delta, defender_delta, attacker_rating, defender_rating, log, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(season.id, c.id, opp.id, won ? c.id : opp.id, myDelta, theirDelta, myNew, theirNew,
    JSON.stringify({ log: result.log, fighters: result.fighters }), Date.now());

  addLog(c.id, 'arena', `${won ? 'Victory' : 'Defeat'} vs ${opp.name} in the Arena (${myDelta >= 0 ? '+' : ''}${myDelta} rating). +${tokens} tokens, +${gold} gold.${bonus ? ` Daily bonus: +${bonus.tokens} tokens, +${bonus.gold} gold!` : ''}`);
  addLog(opp.id, 'arena', `${c.name} challenged you in the Arena and ${won ? 'won' : 'lost'} (${theirDelta >= 0 ? '+' : ''}${theirDelta} rating).`);

  return {
    matchId: Number(info.lastInsertRowid), won, log: result.log, fighters: result.fighters, duration: result.duration,
    ratingDelta: myDelta, rating: myNew, tier: tierForRating(myNew), tokens, gold, bonus, farmLimited,
  };
}

export function buyExtraFight(c) {
  eligibleCheck(c);
  const p = getProfile(c.id);
  if (p.extra_bought_today >= CFG.maxExtraFightsPerDay) throw new GameError('You cannot buy more fights today.');
  const cost = extraFightCost(c.level, p.extra_bought_today);
  if (c.gold < cost) throw new GameError(`Not enough gold (${cost}).`);
  c.gold -= cost;
  q('UPDATE arena_profiles SET extra_fights = extra_fights + 1, extra_bought_today = extra_bought_today + 1 WHERE char_id = ?').run(c.id);
  return cost;
}

export function claimWeekly(c) {
  const p = getProfile(c.id);
  const week = weekKey();
  if (p.weekly_claimed === week) throw new GameError('Weekly reward already claimed.');
  if (p.wins + p.losses < 3) throw new GameError('Fight at least 3 Arena battles this season to earn weekly rewards.');
  const tier = tierForRating(p.rating);
  q('UPDATE arena_profiles SET weekly_claimed = ? WHERE char_id = ?').run(week, c.id);
  c.arena_tokens += tier.weeklyTokens;
  c.gold += tier.weeklyGold;
  addLog(c.id, 'arena', `Claimed weekly ${tier.name} reward: +${tier.weeklyTokens} tokens, +${tier.weeklyGold} gold.`);
  return { tokens: tier.weeklyTokens, gold: tier.weeklyGold };
}

export function claimSeasonRewards(c) {
  const rows = q('SELECT * FROM arena_rewards WHERE char_id = ? AND claimed = 0').all(c.id);
  if (!rows.length) throw new GameError('No season rewards to claim.');
  for (const r of rows) {
    c.arena_tokens += r.tokens;
    c.gold += r.gold;
    if (r.title && !c.titles.includes(r.title)) c.titles.push(r.title);
    q('UPDATE arena_rewards SET claimed = 1 WHERE id = ?').run(r.id);
  }
  return rows.length;
}

export function buyArenaShop(c, shopId) {
  const s = ARENA_SHOP.find((x) => x.id === shopId);
  if (!s) throw new GameError('Unknown reward.');
  if (s.minLevel && c.level < s.minLevel) throw new GameError(`Requires level ${s.minLevel}.`);
  if (c.arena_tokens < s.cost) throw new GameError('Not enough Arena tokens.');
  if (s.title && c.titles.includes(s.title)) throw new GameError('You already own that title.');
  if (s.unique) {
    if (!addEquipment(c, generateUnique(s.unique, c.level))) throw new GameError('Your inventory is full.');
  } else if (s.resource) {
    if (addStack(c, 'resource', s.resource, s.qty) < s.qty) throw new GameError('Your inventory is full.');
  } else if (s.consumable) {
    if (addStack(c, 'consumable', s.consumable, s.qty) < s.qty) throw new GameError('Your inventory is full.');
  } else if (s.ticket) {
    getProfile(c.id);
    q('UPDATE arena_profiles SET extra_fights = extra_fights + 1 WHERE char_id = ?').run(c.id);
  } else if (s.title) {
    c.titles.push(s.title);
  }
  c.arena_tokens -= s.cost;
  addLog(c.id, 'arena', `Bought ${s.name} for ${s.cost} Arena tokens.`);
}

export function matchHistory(charId) {
  return q(`SELECT m.id, m.attacker_id, m.defender_id, m.winner_id, m.attacker_delta, m.defender_delta, m.created_at, a.name AS attacker, d.name AS defender
    FROM arena_matches m JOIN characters a ON a.id = m.attacker_id JOIN characters d ON d.id = m.defender_id
    WHERE m.attacker_id = ? OR m.defender_id = ? ORDER BY m.id DESC LIMIT 30`).all(charId, charId).map((m) => ({
    id: m.id, attacking: m.attacker_id === charId, opponent: m.attacker_id === charId ? m.defender : m.attacker,
    won: m.winner_id === charId, delta: m.attacker_id === charId ? m.attacker_delta : m.defender_delta, createdAt: m.created_at,
  }));
}

export function matchReplay(charId, matchId) {
  const m = q('SELECT * FROM arena_matches WHERE id = ? AND (attacker_id = ? OR defender_id = ?)').get(Number(matchId), charId, charId);
  if (!m) throw new GameError('Match not found.', 404);
  return JSON.parse(m.log);
}

export function leaderboard(kind = 'arena') {
  if (kind === 'level') {
    return q('SELECT name, level, race, class, title FROM characters ORDER BY level DESC, xp DESC LIMIT 50').all();
  }
  return q(`SELECT c.name, c.level, c.race, c.class, c.title, p.rating, p.wins, p.losses FROM arena_profiles p JOIN characters c ON c.id = p.char_id
    WHERE (p.wins + p.losses) > 0 ORDER BY p.rating DESC LIMIT 50`).all().map((r, i) => ({ rank: i + 1, ...r, tier: tierForRating(r.rating) }));
}

export { ARENA_TIERS };
