import { q, tx, GameError } from '../db.js';
import { RACES } from '../../shared/data/races.js';
import { CLASSES } from '../../shared/data/classes.js';
import { PROFESSIONS, PROFESSION_MAX_LEVEL } from '../../shared/data/professions.js';
import { AREAS, START_AREA } from '../../shared/data/areas.js';
import { BALANCE } from '../../shared/balance.js';
import { charXpForLevel, profXpForLevel, computeStats, unlockedAbilities } from '../../shared/rules.js';

const JSON_FIELDS = ['alloc', 'discovered', 'visited', 'activity', 'professions', 'quest_offers', 'buffs', 'titles', 'stats_cache', 'bosses_defeated'];
const MUTABLE = ['level', 'xp', 'attr_points', 'alloc', 'gold', 'arena_tokens', 'location', 'discovered', 'visited', 'stamina', 'stamina_at',
  'activity', 'professions', 'quest_offers', 'buffs', 'inv_size', 'titles', 'title', 'stats_cache', 'bosses_defeated', 'last_seen'];

export function parseChar(row) {
  if (!row) return null;
  const c = { ...row };
  for (const f of JSON_FIELDS) c[f] = JSON.parse(c[f]);
  return c;
}

export function loadChar(id) {
  return parseChar(q('SELECT * FROM characters WHERE id = ?').get(id));
}
export function loadCharByUser(userId) {
  return parseChar(q('SELECT * FROM characters WHERE user_id = ?').get(userId));
}

export function saveChar(c) {
  const sets = MUTABLE.map((f) => `${f} = ?`).join(', ');
  const vals = MUTABLE.map((f) => (JSON_FIELDS.includes(f) ? JSON.stringify(c[f]) : c[f]));
  q(`UPDATE characters SET ${sets} WHERE id = ?`).run(...vals, c.id);
}

export function addLog(charId, kind, text, data = null) {
  q('INSERT INTO char_log (char_id, kind, text, data, created_at) VALUES (?, ?, ?, ?, ?)')
    .run(charId, kind, text, data ? JSON.stringify(data) : null, Date.now());
  // keep the log bounded
  q('DELETE FROM char_log WHERE char_id = ? AND id < (SELECT MIN(id) FROM (SELECT id FROM char_log WHERE char_id = ? ORDER BY id DESC LIMIT 200))').run(charId, charId);
}

export function getEquipped(charId) {
  return q("SELECT * FROM items WHERE char_id = ? AND location = 'equipped'").all(charId).map(parseItem);
}

export function parseItem(row) {
  if (!row) return null;
  return { ...row, stats: JSON.parse(row.stats), affixes: JSON.parse(row.affixes), bound: !!row.bound };
}

/** Full stats for a character, recomputed from authoritative server data. */
export function statsFor(c, opts = {}) {
  return computeStats(c, getEquipped(c.id), { buffs: c.buffs, ...opts });
}

export function createCharacter(userId, { name, race, cls }) {
  name = String(name || '').trim();
  if (!/^[A-Za-z][A-Za-z0-9_]{2,15}$/.test(name)) throw new GameError('Name must be 3-16 letters/numbers and start with a letter.');
  if (!RACES[race]) throw new GameError('Unknown race.');
  if (!CLASSES[cls]) throw new GameError('Unknown class.');
  if (q('SELECT 1 FROM characters WHERE user_id = ?').get(userId)) throw new GameError('You already have a character.');
  if (q('SELECT 1 FROM characters WHERE name = ?').get(name)) throw new GameError('That name is taken.');

  const now = Date.now();
  const professions = Object.fromEntries(Object.keys(PROFESSIONS).map((p) => [p, { level: 1, xp: 0 }]));
  const discovered = [START_AREA, ...Object.keys(AREAS[START_AREA].connections)];
  return tx(() => {
    const info = q(`INSERT INTO characters (user_id, name, race, class, location, discovered, visited, stamina, stamina_at, professions, gold, inv_size, created_at, last_seen)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(userId, name, race, cls, START_AREA, JSON.stringify(discovered), JSON.stringify([START_AREA]), BALANCE.staminaMax, now,
        JSON.stringify(professions), 100, BALANCE.baseInventorySize, now, now);
    return Number(info.lastInsertRowid);
  });
}

/** Grant character XP (with xpGain bonus applied by caller if desired). Returns levels gained. */
export function grantXp(c, amount) {
  if (c.level >= BALANCE.maxLevel) return 0;
  c.xp += Math.max(0, Math.round(amount));
  let gained = 0;
  while (c.level < BALANCE.maxLevel && c.xp >= charXpForLevel(c.level)) {
    c.xp -= charXpForLevel(c.level);
    c.level++;
    c.attr_points += BALANCE.attributePointsPerLevel;
    gained++;
    const newAbilities = CLASSES[c.class].abilities.filter((a) => a.level === c.level);
    addLog(c.id, 'level', `Reached level ${c.level}!${newAbilities.length ? ' Unlocked: ' + newAbilities.map((a) => a.name).join(', ') : ''}`);
  }
  if (c.level >= BALANCE.maxLevel) c.xp = 0;
  return gained;
}

export function grantProfXp(c, prof, amount) {
  const p = c.professions[prof];
  if (!p || p.level >= PROFESSION_MAX_LEVEL) return 0;
  p.xp += Math.max(0, Math.round(amount));
  let gained = 0;
  while (p.level < PROFESSION_MAX_LEVEL && p.xp >= profXpForLevel(p.level)) {
    p.xp -= profXpForLevel(p.level);
    p.level++;
    gained++;
    const perk = PROFESSIONS[prof].perks.find((pk) => pk.level === p.level);
    addLog(c.id, 'profession', `${PROFESSIONS[prof].name} reached level ${p.level}!${perk ? ' Perk unlocked: ' + perk.name : ''}`);
  }
  return gained;
}

export function allocateAttribute(c, attr, amount) {
  amount = Math.floor(Number(amount));
  if (!['str', 'dex', 'int', 'con', 'lck'].includes(attr)) throw new GameError('Unknown attribute.');
  if (!(amount >= 1) || amount > c.attr_points) throw new GameError('Not enough attribute points.');
  c.alloc[attr] = (c.alloc[attr] || 0) + amount;
  c.attr_points -= amount;
}

/** Public profile - safe to show to other players (no user id, no private data). */
export function publicProfile(charId) {
  const c = loadChar(charId);
  if (!c) throw new GameError('Character not found.', 404);
  const equipped = getEquipped(c.id);
  const { stats, sets } = computeStats(c, equipped, { pvp: true });
  return {
    id: c.id, name: c.name, race: c.race, class: c.class, level: c.level, title: c.title,
    stats, sets, equipped: equipped.map(publicItem),
    abilities: unlockedAbilities(c.class, c.level).map((a) => a.id),
  };
}

export function publicItem(i) {
  return {
    id: i.id, kind: i.kind, base: i.base, name: i.name, rarity: i.rarity, ilvl: i.ilvl, req_level: i.req_level, tier: i.tier,
    stats: i.stats, affixes: i.affixes, set_id: i.set_id, unique_id: i.unique_id, quantity: i.quantity, slot: i.slot,
    location: i.location, position: i.position, bound: i.bound, crafted_by: i.crafted_by,
  };
}
