// Server-side item generation: rarities, implicit stats and random prefixes/suffixes.
import { BASE_TYPES, TIERS, RARITIES, RARITY_INFO, UNIQUES } from '../../shared/data/items.js';
import { AFFIXES } from '../../shared/data/affixes.js';
import { STATS } from '../../shared/data/stats.js';
import { BALANCE } from '../../shared/balance.js';

const rand = Math.random;

export function tierForIlvl(ilvl) {
  let t = 0;
  TIERS.forEach((tier, i) => { if (ilvl >= tier.level) t = i; });
  return t;
}

export function rollRarity(bonus = 0, { min = 'common', max = 'mythic', rng = rand } = {}) {
  const lo = RARITIES.indexOf(min);
  const hi = RARITIES.indexOf(max);
  const weights = RARITIES.map((r, i) => (i < lo || i > hi ? 0 : RARITY_INFO[r].weight * Math.pow(1 + Math.max(0, bonus), i)));
  const total = weights.reduce((s, w) => s + w, 0);
  let roll = rng() * total;
  for (let i = 0; i < RARITIES.length; i++) {
    roll -= weights[i];
    if (roll <= 0) return RARITIES[i];
  }
  return RARITIES[lo];
}

function itemTags(base) {
  const b = BASE_TYPES[base];
  return new Set([...b.tags, b.slot]);
}

function scaleAffix(affix, ilvl, rarity, rng) {
  const pct = !!STATS[affix.resolvedStat]?.pct;
  let roll = affix.min + rng() * (affix.max - affix.min);
  let perfect = false;
  if (rng() < 0.02) { roll = affix.max * 1.25; perfect = true; } // exceptionally rare perfect roll
  let v = roll * (pct ? 1 + ilvl * 0.025 : 1 + ilvl * 0.12) * RARITY_INFO[rarity].mult;
  v = pct ? Math.round(v * 10000) / 10000 : Math.max(1, Math.round(v));
  return { id: affix.id, name: affix.name, kind: affix.kind, stat: affix.resolvedStat, value: v, ...(perfect ? { perfect: true } : {}) };
}

export function rollAffixes(base, ilvl, rarity, count, rng = rand, exclude = []) {
  const tags = itemTags(base);
  const prof = BASE_TYPES[base].profession_tool;
  const pool = AFFIXES.filter((a) => a.minIlvl <= ilvl && a.tags.some((t) => tags.has(t)) && (!a.stat.includes('{prof}') || prof))
    .map((a) => ({ ...a, resolvedStat: a.stat.replace('{prof}', prof || '') }));
  const chosen = [];
  const usedIds = new Set(exclude);
  const usedStats = new Set();
  const kinds = { prefix: 0, suffix: 0 };
  for (let n = 0; n < count; n++) {
    const avail = pool.filter((a) => !usedIds.has(a.id) && !usedStats.has(a.resolvedStat) && kinds[a.kind] < 3);
    if (!avail.length) break;
    const total = avail.reduce((s, a) => s + a.weight, 0);
    let roll = rng() * total;
    let pick = avail[0];
    for (const a of avail) { roll -= a.weight; if (roll <= 0) { pick = a; break; } }
    usedIds.add(pick.id);
    usedStats.add(pick.resolvedStat);
    kinds[pick.kind]++;
    chosen.push(scaleAffix(pick, ilvl, rarity, rng));
  }
  return chosen;
}

function implicitStats(base, ilvl, rarity) {
  const b = BASE_TYPES[base];
  const out = {};
  const rm = 1 + (RARITY_INFO[rarity].mult - 1) * 0.5;
  for (const [stat, [v0, per]] of Object.entries(b.implicit)) {
    let v = (v0 + per * ilvl) * (v0 >= 0 ? rm : 1);
    v = STATS[stat]?.pct ? Math.round(v * 10000) / 10000 : Math.round(v);
    if (v !== 0) out[stat] = v;
  }
  return out;
}

export function displayName(base, tier, affixes, uniqueName) {
  if (uniqueName) return uniqueName;
  const b = BASE_TYPES[base];
  const mat = TIERS[tier][b.material] || TIERS[tier].metal;
  const prefix = affixes.find((a) => a.kind === 'prefix');
  const suffix = affixes.find((a) => a.kind === 'suffix');
  return [prefix?.name, mat, b.name, suffix?.name].filter(Boolean).join(' ');
}

export function reqLevelFor(ilvl) {
  return Math.max(1, Math.min(BALANCE.maxLevel, ilvl - 2));
}

/** Build a new equipment item (not yet stored). */
export function generateEquipment({ base, ilvl, rarity, rng = rand, tier }) {
  if (!BASE_TYPES[base]) throw new Error(`Unknown base ${base}`);
  ilvl = Math.max(1, Math.min(BALANCE.maxLevel + 5, Math.round(ilvl)));
  const t = tier ?? tierForIlvl(ilvl);
  const affixes = rollAffixes(base, ilvl, rarity, RARITY_INFO[rarity].affixes, rng);
  return {
    kind: 'equipment', base, rarity, ilvl, tier: t, req_level: reqLevelFor(ilvl),
    stats: implicitStats(base, ilvl, rarity), affixes, name: displayName(base, t, affixes), quantity: 1,
  };
}

export function generateUnique(uniqueId, ilvl, rng = rand) {
  const u = UNIQUES[uniqueId];
  if (!u) throw new Error(`Unknown unique ${uniqueId}`);
  ilvl = Math.max(1, Math.round(ilvl));
  const extra = rollAffixes(u.base, ilvl, u.rarity, Math.max(0, RARITY_INFO[u.rarity].affixes - u.special.length), rng);
  const special = u.special.map((s) => ({ id: `unique_${s.stat}`, name: 'Unique', kind: 'special', stat: s.stat, value: s.value }));
  return {
    kind: 'equipment', base: u.base, rarity: u.rarity, ilvl, tier: tierForIlvl(ilvl), req_level: reqLevelFor(ilvl),
    stats: implicitStats(u.base, ilvl, u.rarity), affixes: [...special, ...extra], name: u.name, quantity: 1,
    set_id: u.set || null, unique_id: uniqueId, bound: u.bound ? 1 : 0,
  };
}

/** Random equipment drop around a level. Tools are less common than combat gear. */
export function randomDrop(level, rarityBonus = 0, rng = rand, { minRarity = 'common' } = {}) {
  const bases = Object.keys(BASE_TYPES);
  const tools = bases.filter((b) => BASE_TYPES[b].slot.startsWith('tool_'));
  const gear = bases.filter((b) => !tools.includes(b));
  const pool = rng() < 0.15 ? tools : gear;
  const base = pool[Math.floor(rng() * pool.length)];
  const ilvl = Math.max(1, level + Math.floor(rng() * 5) - 2);
  return generateEquipment({ base, ilvl, rarity: rollRarity(rarityBonus, { min: minRarity, rng }), rng });
}
