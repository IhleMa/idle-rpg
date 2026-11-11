// Pure game rules shared by server and client. The server is authoritative; the client only
// uses these to display previews (e.g. item comparison, gathering rates).
import { RACES } from './data/races.js';
import { CLASSES } from './data/classes.js';
import { PROFESSIONS } from './data/professions.js';
import { BASE_TYPES, SETS } from './data/items.js';
import { ATTRIBUTES } from './data/stats.js';
import { BALANCE } from './balance.js';

export const charXpForLevel = (level) => Math.round(60 * Math.pow(level, 1.9));
export const profXpForLevel = (level) => Math.round(30 * Math.pow(level, 1.7));

function add(target, stats, mult = 1) {
  for (const [k, v] of Object.entries(stats || {})) target[k] = (target[k] || 0) + v * mult;
}

/** All stat contributions from one item (implicit + affixes), incl. class synergy. */
export function itemStats(item, classId) {
  const out = {};
  const base = BASE_TYPES[item.base];
  const synergy = base?.classes?.includes(classId) ? 1.1 : 1;
  add(out, item.stats, synergy);
  for (const a of item.affixes || []) out[a.stat] = (out[a.stat] || 0) + a.value;
  return out;
}

export function unlockedAbilities(classId, level) {
  return CLASSES[classId].abilities.filter((a) => a.level <= level);
}

/**
 * Compute a character's full stat sheet.
 * @param char { race, class, level, alloc:{str..}, professions:{id:{level}} }
 * @param equipped array of equipped items
 * @param opts { buffs: [{stats, until}], now, pvp }
 */
export function computeStats(char, equipped = [], opts = {}) {
  const race = RACES[char.race];
  const cls = CLASSES[char.class];
  const lvl = char.level;
  const flat = {};

  // Attributes: class base + growth + race + allocated points
  for (const a of ATTRIBUTES) {
    flat[a] = cls.baseAttributes[a] + cls.growth[a] * (lvl - 1) + (race.attributes[a] || 0) + (char.alloc?.[a] || 0);
  }
  add(flat, race.bonuses);
  add(flat, cls.passives);
  for (const ab of unlockedAbilities(char.class, lvl)) if (ab.type === 'passive') add(flat, ab.stats);

  // Profession perks
  for (const [pid, p] of Object.entries(char.professions || {})) {
    for (const perk of PROFESSIONS[pid]?.perks || []) if (p.level >= perk.level) add(flat, perk.stats);
  }

  // Equipment + set bonuses
  const setCounts = {};
  for (const item of equipped) {
    add(flat, itemStats(item, char.class));
    if (item.set_id) setCounts[item.set_id] = (setCounts[item.set_id] || 0) + 1;
  }
  const activeSets = [];
  for (const [sid, count] of Object.entries(setCounts)) {
    const set = SETS[sid];
    if (!set) continue;
    for (const b of set.bonuses) if (count >= b.pieces) add(flat, b.stats);
    activeSets.push({ id: sid, name: set.name, count, bonuses: set.bonuses });
  }

  // Timed buffs (elixirs) - not in PvP
  if (!opts.pvp) {
    const now = opts.now ?? Date.now();
    for (const b of opts.buffs || []) if (b.until > now) add(flat, b.stats);
  }

  const s = flat;
  const g = (k) => s[k] || 0;
  const main = cls.mainStat;
  const physBase = 3 + g('physDmg') + g('str') * 0.8 + g('dex') * (main === 'dex' ? 0.8 : 0.2);
  const magicBase = 2 + g('magicDmg') + g('int') * 1.1;
  const derived = {
    str: g('str'), dex: g('dex'), int: g('int'), con: g('con'), lck: g('lck'),
    health: Math.round((50 + g('con') * 12 + lvl * 8 + g('health')) * (1 + g('healthPct'))),
    physDmg: Math.round(physBase * (1 + g('physDmgPct')) * 10) / 10,
    magicDmg: Math.round(magicBase * (1 + g('magicDmgPct')) * 10) / 10,
    armor: Math.round(g('armor') * (1 + g('armorPct'))),
    critChance: 0.05 + g('lck') * 0.002 + g('dex') * 0.001 + g('critChance'),
    critDmg: 0.5 + g('critDmg'),
    attackSpeed: Math.max(0.3, 1 + g('dex') * 0.003 + g('attackSpeed')),
    dodge: g('dex') * 0.0006 + g('dodge'),
    lifeSteal: g('lifeSteal'),
    xpGain: g('xpGain'),
    lootFind: g('lootFind') + g('lck') * 0.003,
    goldFind: g('goldFind'),
    travelSpeed: g('travelSpeed') + g('dex') * 0.001,
    craftEff: g('craftEff') + g('int') * 0.004,
    craftQuality: g('craftQuality') + g('int') * 0.002,
    gatherSpeed: g('gatherSpeed') + g('dex') * 0.003,
    gatherYield: g('gatherYield'),
    rareFind: g('rareFind') + g('lck') * 0.004,
  };
  for (const p of Object.keys(PROFESSIONS)) {
    if (PROFESSIONS[p].kind !== 'gathering') continue;
    derived[`${p}Speed`] = g(`${p}Speed`) + (p === 'mining' ? g('str') * 0.003 : 0);
    derived[`${p}Yield`] = g(`${p}Yield`);
    derived[`${p}Rare`] = g(`${p}Rare`);
  }
  derived.damage = cls.damageType === 'magic' ? derived.magicDmg : derived.physDmg;
  derived.damageType = cls.damageType;
  derived.power = Math.round(
    derived.health * 0.25 + derived.damage * 4 * derived.attackSpeed * (1 + Math.min(derived.critChance, 0.6) * derived.critDmg)
    + derived.armor * 0.6,
  );
  return { stats: derived, sets: activeSets };
}

/** Gathering rates for an activity given stats and profession level. */
export function gatherRates(stats, profession, profLevel, baseSeconds) {
  const speed = 1 + stats.gatherSpeed + (stats[`${profession}Speed`] || 0) + profLevel * 0.01;
  const cycleSeconds = Math.max(1.5, baseSeconds / Math.max(0.2, speed));
  const yieldBonus = stats.gatherYield + (stats[`${profession}Yield`] || 0) + profLevel * 0.008;
  const rareMult = 1 + stats.rareFind + (stats[`${profession}Rare`] || 0) + profLevel * 0.01;
  return { cycleSeconds, yieldBonus, rareMult };
}

export function travelSeconds(distance, stats, secondsPerUnit) {
  return Math.max(5, Math.round((distance * secondsPerUnit) / Math.max(0.3, 1 + (stats?.travelSpeed || 0))));
}

/** Derive enemy combat stats from level and template multipliers. */
export function enemyStats(enemy, levelOverride) {
  const L = levelOverride ?? enemy.level;
  const bossHp = enemy.boss ? 1 : 1;
  return {
    name: enemy.name,
    icon: enemy.icon,
    level: L,
    maxHp: Math.round((70 + L * 34 + L * L * 0.5) * enemy.hp * bossHp),
    damage: Math.round((6 + L * 2.9 + L * L * 0.02) * enemy.dmg * 10) / 10,
    damageType: enemy.damageType,
    armor: Math.round((2 + L * 2.2) * enemy.armor),
    critChance: enemy.crit,
    critDmg: 0.5,
    attackSpeed: enemy.speed,
    dodge: 0.03,
    lifeSteal: 0,
    abilities: [],
  };
}

export function staminaCost(enemy) {
  if (enemy.boss) return BALANCE.bossStaminaCost;
  if (enemy.elite) return BALANCE.eliteStaminaCost;
  return BALANCE.fightStaminaCost;
}

export function inventoryUpgradeCost(currentSize) {
  const steps = (currentSize - BALANCE.baseInventorySize) / BALANCE.inventoryUpgradeSize;
  return Math.round(BALANCE.inventoryUpgradeBaseCost * Math.pow(2, steps));
}
