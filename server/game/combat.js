// PvE combat on the server. Fights are simulated with the shared engine using authoritative
// server-side character data; the client only receives and replays the log.
import crypto from 'node:crypto';
import { GameError, q } from '../db.js';
import { ENEMIES } from '../../shared/data/enemies.js';
import { AREAS } from '../../shared/data/areas.js';
import { CLASSES } from '../../shared/data/classes.js';
import { RACES } from '../../shared/data/races.js';
import { BALANCE } from '../../shared/balance.js';
import { simulateFight } from '../../shared/combat.js';
import { enemyStats, unlockedAbilities, staminaCost } from '../../shared/rules.js';
import { statsFor, grantXp, addLog } from './characters.js';
import { addStack, addEquipment, potionsForCombat, removeStack } from './inventory.js';
import { randomDrop } from './loot.js';

export function seed() {
  return crypto.randomBytes(4).readUInt32LE(0);
}

export function buildFighter(c, { pvp = false } = {}) {
  const { stats } = statsFor(c, { pvp });
  return {
    name: c.name,
    icon: RACES[c.race].icon,
    level: c.level,
    maxHp: stats.health,
    damage: stats.damage,
    damageType: stats.damageType,
    armor: stats.armor,
    critChance: stats.critChance,
    critDmg: stats.critDmg,
    attackSpeed: stats.attackSpeed,
    dodge: stats.dodge,
    lifeSteal: stats.lifeSteal,
    abilities: unlockedAbilities(c.class, c.level).filter((a) => a.type !== 'passive'),
    potions: pvp ? [] : potionsForCombat(c.id),
    className: CLASSES[c.class].name,
  };
}

export const enemyXp = (L, e) => Math.round((12 + L * 9 + L * L * 0.4) * (e.boss ? 4 : e.elite ? 1.6 : 1));
export const enemyGold = (L, e) => Math.round((3 + L * 2.5) * (e.boss ? 5 : e.elite ? 1.8 : 1));

/** Resolve a fight vs an enemy at a level and grant rewards on victory. */
export function resolvePve(c, enemyId, level, { rewardMult = 1, itemChance = null, source = 'combat' } = {}) {
  const e = ENEMIES[enemyId];
  const fighter = buildFighter(c);
  const foe = enemyStats(e, level);
  const result = simulateFight(fighter, foe, { seed: seed() });
  for (const [pid, n] of Object.entries(result.potionsUsed)) removeStack(c.id, pid, n);

  const { stats } = statsFor(c);
  const rewards = { xp: 0, gold: 0, resources: {}, items: [] };
  if (result.winner === 0) {
    rewards.xp = Math.round(enemyXp(level, e) * rewardMult * (1 + stats.xpGain));
    rewards.gold = Math.round(enemyGold(level, e) * rewardMult * (1 + stats.goldFind) * (0.85 + Math.random() * 0.3));
    for (const d of e.drops) {
      if (Math.random() < Math.min(1, d.chance * (1 + stats.lootFind * 0.5))) {
        const qty = d.qty || 1;
        const added = addStack(c, 'resource', d.res, qty);
        if (added) rewards.resources[d.res] = (rewards.resources[d.res] || 0) + added;
      }
    }
    if (e.boss) {
      const first = !c.bosses_defeated.includes(enemyId);
      if (first || Math.random() < 0.35) {
        if (addStack(c, 'resource', 'boss_trophy', 1)) rewards.resources.boss_trophy = (rewards.resources.boss_trophy || 0) + 1;
      }
      if (first) c.bosses_defeated.push(enemyId);
    }
    const chance = itemChance ?? (e.boss ? 1 : e.elite ? 0.2 : 0.08);
    if (Math.random() < chance * (1 + stats.lootFind)) {
      const item = randomDrop(level, stats.lootFind * 0.5 + (e.boss ? 0.6 : 0), Math.random, { minRarity: e.boss ? 'rare' : 'common' });
      const id = addEquipment(c, item);
      if (id) rewards.items.push({ id, name: item.name, rarity: item.rarity });
      else rewards.inventoryFull = true;
    }
    c.gold += rewards.gold;
    rewards.levels = grantXp(c, rewards.xp);
    const loot = [...Object.entries(rewards.resources).map(([r, n]) => `${n}x ${r.replace(/_/g, ' ')}`), ...rewards.items.map((i) => i.name)];
    addLog(c.id, source, `Defeated ${e.name} (Lv ${level}): +${rewards.xp} XP, +${rewards.gold} gold${loot.length ? ', ' + loot.join(', ') : ''}.`);
  } else {
    rewards.xp = Math.round(enemyXp(level, e) * 0.1 * rewardMult);
    rewards.levels = grantXp(c, rewards.xp);
    addLog(c.id, source, `Was defeated by ${e.name} (Lv ${level}). +${rewards.xp} XP.`);
  }
  return { ...result, won: result.winner === 0, rewards, enemy: { id: enemyId, ...foe } };
}

export function fightEnemy(c, enemyId) {
  if (c.activity.type === 'travel') throw new GameError('You cannot fight while traveling.');
  const area = AREAS[c.location];
  if (!area.enemies.includes(enemyId)) throw new GameError('That enemy is not found here.');
  const e = ENEMIES[enemyId];
  const cost = staminaCost(e);
  if (c.stamina < cost) throw new GameError(`Not enough stamina (${cost} needed).`);
  c.stamina -= cost;
  return resolvePve(c, enemyId, e.level);
}

export function staminaInfo() {
  return { max: BALANCE.staminaMax, regenSeconds: BALANCE.staminaRegenSeconds };
}

export function recentLog(charId, limit = 40) {
  return q('SELECT id, kind, text, created_at FROM char_log WHERE char_id = ? ORDER BY id DESC LIMIT ?').all(charId, limit);
}
