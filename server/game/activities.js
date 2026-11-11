// Timed idle activities (travel, gathering, crafting, quests) and the offline-progress tick.
// Progress is computed from timestamps: nothing depends on a browser timer.
import crypto from 'node:crypto';
import { GameError } from '../db.js';
import { AREAS, ACTIVITIES, TRAVEL_SECONDS_PER_UNIT } from '../../shared/data/areas.js';
import { ENEMIES } from '../../shared/data/enemies.js';
import { RECIPES } from '../../shared/data/recipes.js';
import { RESOURCES } from '../../shared/data/resources.js';
import { CONSUMABLES, TIERS, BASE_TYPES } from '../../shared/data/items.js';
import { QUEST_DIFFICULTIES, QUEST_TEMPLATES } from '../../shared/data/quests.js';
import { BALANCE } from '../../shared/balance.js';
import { gatherRates, travelSeconds } from '../../shared/rules.js';
import { statsFor, grantXp, grantProfXp, addLog, getEquipped } from './characters.js';
import { addStack, addEquipment, removeStack, countStack } from './inventory.js';
import { generateEquipment, generateUnique, rollRarity, randomDrop } from './loot.js';
import { resolvePve } from './combat.js';

const IDLE = { type: 'idle' };

// ---------- World / travel ----------

export function isUnlocked(c, areaId) {
  return c.level >= (AREAS[areaId].unlock?.level || 1);
}

/** Shortest path through discovered + unlocked areas (Dijkstra). */
export function findPath(c, from, to) {
  const dist = { [from]: 0 };
  const prev = {};
  const open = new Set([from]);
  while (open.size) {
    let cur = null;
    for (const n of open) if (cur === null || dist[n] < dist[cur]) cur = n;
    open.delete(cur);
    if (cur === to) break;
    for (const [nb, d] of Object.entries(AREAS[cur].connections)) {
      if (!c.discovered.includes(nb) || !isUnlocked(c, nb)) continue;
      const nd = dist[cur] + d;
      if (dist[nb] === undefined || nd < dist[nb]) { dist[nb] = nd; prev[nb] = cur; open.add(nb); }
    }
  }
  if (dist[to] === undefined) return null;
  const path = [to];
  while (path[0] !== from) path.unshift(prev[path[0]]);
  return { path, distance: dist[to] };
}

export function startTravel(c, to) {
  if (!AREAS[to]) throw new GameError('Unknown destination.');
  if (c.activity.type === 'travel') throw new GameError('You are already traveling.');
  if (['quest', 'craft'].includes(c.activity.type)) throw new GameError('Finish or cancel your current activity first.');
  if (to === c.location) throw new GameError('You are already there.');
  if (!c.discovered.includes(to)) throw new GameError('You have not discovered that area yet.');
  if (!isUnlocked(c, to)) throw new GameError(`Requires character level ${AREAS[to].unlock.level}.`);
  const route = findPath(c, c.location, to);
  if (!route) throw new GameError('No known route leads there.');
  if (c.activity.type === 'gather') stopActivity(c);
  const { stats } = statsFor(c);
  const secs = travelSeconds(route.distance, stats, TRAVEL_SECONDS_PER_UNIT);
  const now = Date.now();
  c.activity = { type: 'travel', from: c.location, to, path: route.path, startedAt: now, endsAt: now + secs * 1000 };
  return c.activity;
}

function arrive(c, to) {
  c.location = to;
  if (!c.visited.includes(to)) {
    c.visited.push(to);
    addLog(c.id, 'travel', `Discovered ${AREAS[to].name}!`);
  } else {
    addLog(c.id, 'travel', `Arrived at ${AREAS[to].name}.`);
  }
  for (const nb of Object.keys(AREAS[to].connections)) if (!c.discovered.includes(nb)) c.discovered.push(nb);
  c.quest_offers = [];
}

// ---------- Gathering ----------

export function startGathering(c, activityId) {
  if (c.activity.type === 'travel') throw new GameError('You are traveling.');
  if (['quest', 'craft'].includes(c.activity.type)) throw new GameError('Finish or cancel your current activity first.');
  const area = AREAS[c.location];
  if (!area.activities[activityId]) throw new GameError('That activity is not available here.');
  const act = ACTIVITIES[activityId];
  if (act.tool && !getEquipped(c.id).some((i) => i.slot === act.tool)) {
    throw new GameError(`${act.name} requires a ${BASE_TYPES[Object.keys(BASE_TYPES).find((b) => BASE_TYPES[b].slot === act.tool)].name} equipped.`);
  }
  if (c.activity.type === 'gather') stopActivity(c);
  const now = Date.now();
  c.activity = { type: 'gather', area: c.location, activityId, startedAt: now, lastAt: now, totals: {}, xp: 0 };
  refreshGatherRate(c);
  return c.activity;
}

function refreshGatherRate(c) {
  const act = ACTIVITIES[c.activity.activityId];
  const { stats } = statsFor(c);
  const rates = gatherRates(stats, act.profession, c.professions[act.profession].level, act.baseSeconds);
  c.activity.cycleMs = Math.round(rates.cycleSeconds * 1000);
  return rates;
}

function gatherCycle(c, rates, summary) {
  const actId = c.activity.activityId;
  const act = ACTIVITIES[actId];
  const table = AREAS[c.activity.area].activities[actId];
  const plvl = c.professions[act.profession].level;
  const eligible = table.drops.filter((d) => (d.lvl || 1) <= plvl);
  const total = eligible.reduce((s, d) => s + d.w, 0);
  let roll = Math.random() * total;
  let pick = eligible[0];
  for (const d of eligible) { roll -= d.w; if (roll <= 0) { pick = d; break; } }
  const y = rates.yieldBonus;
  const qty = 1 + Math.floor(y) + (Math.random() < y - Math.floor(y) ? 1 : 0);
  const got = {};
  got[pick.res] = qty;
  for (const r of table.rares || []) {
    if ((r.lvl || 1) <= plvl && Math.random() < r.chance * rates.rareMult) got[r.res] = (got[r.res] || 0) + 1;
  }
  for (const [res, n] of Object.entries(got)) {
    const added = addStack(c, 'resource', res, n);
    if (added < n) return false; // inventory full
    c.activity.totals[res] = (c.activity.totals[res] || 0) + added;
    summary.resources[res] = (summary.resources[res] || 0) + added;
    if (RESOURCES[res].rare) addLog(c.id, 'rare', `Rare discovery while ${act.name.toLowerCase()}: ${RESOURCES[res].name}!`);
  }
  // Exploration: very rarely find a piece of equipment (often a tool for this profession)
  if (Math.random() < 0.0015 * rates.rareMult) {
    const toolBase = Object.keys(BASE_TYPES).find((b) => BASE_TYPES[b].profession_tool === act.profession);
    const level = Math.max(1, AREAS[c.activity.area].level + 2);
    const item = toolBase && Math.random() < 0.6
      ? generateEquipment({ base: toolBase, ilvl: level, rarity: rollRarity(0.5 + rates.rareMult - 1, { min: 'uncommon' }) })
      : randomDrop(level, 0.5, Math.random, { minRarity: 'uncommon' });
    if (addEquipment(c, item)) {
      summary.items.push(item.name);
      addLog(c.id, 'rare', `Found ${item.name} while ${act.name.toLowerCase()}!`);
    }
  }
  const areaLvl = AREAS[c.activity.area].level;
  const pxp = 5 + areaLvl * 0.4 + (pick.lvl || 1) * 0.5;
  const lvBefore = c.professions[act.profession].level;
  grantProfXp(c, act.profession, pxp);
  summary.profXp[act.profession] = (summary.profXp[act.profession] || 0) + Math.round(pxp);
  c.activity.xp = (c.activity.xp || 0) + Math.round(pxp);
  summary.charXp += 1 + areaLvl * 0.25;
  return c.professions[act.profession].level !== lvBefore ? 'levelup' : true;
}

// ---------- Crafting ----------

export function startCrafting(c, recipeId, count) {
  const r = RECIPES[recipeId];
  if (!r) throw new GameError('Unknown recipe.');
  count = Math.max(1, Math.min(100, Math.floor(Number(count) || 1)));
  if (c.activity.type === 'travel') throw new GameError('You are traveling.');
  if (['quest', 'craft'].includes(c.activity.type)) throw new GameError('Finish or cancel your current activity first.');
  if (c.professions[r.profession].level < r.level) throw new GameError(`Requires ${r.profession} level ${r.level}.`);
  for (const [mat, n] of Object.entries(r.inputs)) {
    if (countStack(c.id, mat) < n * count) throw new GameError(`Not enough ${RESOURCES[mat]?.name || CONSUMABLES[mat]?.name || mat} (${n * count} needed).`);
  }
  if (c.activity.type === 'gather') stopActivity(c);
  for (const [mat, n] of Object.entries(r.inputs)) removeStack(c.id, mat, n * count);
  const { stats } = statsFor(c);
  const cycleMs = Math.round((r.seconds * 1000) / (1 + stats.craftEff));
  const now = Date.now();
  c.activity = { type: 'craft', recipeId, count, done: 0, startedAt: now, nextAt: now + cycleMs, cycleMs, made: [] };
  return c.activity;
}

function craftOne(c, summary) {
  const r = RECIPES[c.activity.recipeId];
  const plvl = c.professions[r.profession].level;
  const { stats } = statsFor(c);
  const out = r.output;
  let ok = true;
  let label;
  if (out.resource) { ok = addStack(c, 'resource', out.resource, out.qty, { force: true }) > 0; label = `${out.qty}x ${RESOURCES[out.resource].name}`; }
  else if (out.consumable) { ok = addStack(c, 'consumable', out.consumable, out.qty, { force: true }) > 0; label = `${out.qty}x ${CONSUMABLES[out.consumable].name}`; }
  else if (out.base) {
    const tierLvl = TIERS[out.tier].level;
    const ilvl = tierLvl + Math.min(8, Math.floor(Math.max(0, plvl - r.level) / 2)) + Math.floor(Math.random() * 3);
    const quality = stats.craftQuality + plvl * 0.01;
    const item = generateEquipment({ base: out.base, ilvl, tier: out.tier, rarity: rollRarity(quality, { max: 'legendary' }) });
    addEquipment(c, item, { force: true, craftedBy: c.name });
    label = item.name;
    if (['epic', 'legendary'].includes(item.rarity)) addLog(c.id, 'rare', `Crafted an ${item.rarity} item: ${item.name}!`);
  } else if (out.unique) {
    const item = generateUnique(out.unique, Math.max(c.level, r.level));
    addEquipment(c, item, { force: true, craftedBy: c.name });
    label = item.name;
    addLog(c.id, 'rare', `Forged the legendary ${item.name}!`);
  }
  if (!ok) return false;
  c.activity.made.push(label);
  summary.crafted.push(label);
  const xp = (8 + r.level * 2) * (out.base || out.unique ? 3 : 1);
  grantProfXp(c, r.profession, xp);
  summary.charXp += 2 + r.level * 0.5;
  return true;
}

// ---------- Quests ----------

function questLevel(c, enemyId, diff) {
  return Math.max(1, Math.max(ENEMIES[enemyId].level, c.level) + QUEST_DIFFICULTIES[diff].levelOffset);
}

export function questOffers(c) {
  if (c.quest_offers.length && c.quest_offers[0].area === c.location) return c.quest_offers;
  const area = AREAS[c.location];
  const enemies = area.enemies.filter((e) => !ENEMIES[e].boss);
  const diffs = Object.keys(QUEST_DIFFICULTIES).filter((d) => !QUEST_DIFFICULTIES[d].minLevel || c.level >= QUEST_DIFFICULTIES[d].minLevel);
  const pickD = [diffs[0], diffs[Math.min(1, diffs.length - 1)], diffs[diffs.length - 1]];
  c.quest_offers = pickD.map((diff) => {
    const enemy = enemies[Math.floor(Math.random() * enemies.length)];
    const tpl = QUEST_TEMPLATES[Math.floor(Math.random() * QUEST_TEMPLATES.length)];
    const d = QUEST_DIFFICULTIES[diff];
    const lvl = questLevel(c, enemy, diff);
    const fill = (s) => s.replace('{enemy}', ENEMIES[enemy].name).replace('{area}', area.name);
    const drop = ENEMIES[enemy].drops[0];
    return {
      id: crypto.randomBytes(6).toString('hex'), area: c.location, enemy, level: lvl, difficulty: diff,
      title: fill(tpl.title), text: fill(tpl.text), seconds: d.minutes * 60,
      xp: Math.round((20 + lvl * 12) * Math.pow(d.minutes, 0.85) * d.reward),
      gold: Math.round((8 + lvl * 4) * Math.pow(d.minutes, 0.8) * d.reward),
      itemChance: d.itemChance,
      resource: drop ? { res: drop.res, qty: Math.max(1, Math.round(2 * d.reward)) } : null,
    };
  });
  return c.quest_offers;
}

export function startQuest(c, questId) {
  if (c.activity.type === 'travel') throw new GameError('You are traveling.');
  if (['quest', 'craft'].includes(c.activity.type)) throw new GameError('Finish or cancel your current activity first.');
  const quest = questOffers(c).find((qq) => qq.id === questId);
  if (!quest) throw new GameError('That quest is no longer available.');
  if (c.activity.type === 'gather') stopActivity(c);
  const now = Date.now();
  c.activity = { type: 'quest', quest, startedAt: now, endsAt: now + quest.seconds * 1000 };
  c.quest_offers = [];
  return c.activity;
}

function completeQuest(c, summary) {
  const quest = c.activity.quest;
  const d = QUEST_DIFFICULTIES[quest.difficulty];
  const fight = resolvePve(c, quest.enemy, quest.level, { rewardMult: 0, itemChance: 0, source: 'quest' });
  const { stats } = statsFor(c);
  if (fight.won) {
    const xp = Math.round(quest.xp * (1 + stats.xpGain));
    const gold = Math.round(quest.gold * (1 + stats.goldFind));
    c.gold += gold;
    grantXp(c, xp);
    const loot = [];
    if (quest.resource && addStack(c, 'resource', quest.resource.res, quest.resource.qty)) loot.push(`${quest.resource.qty}x ${RESOURCES[quest.resource.res].name}`);
    if (Math.random() < d.itemChance * (1 + stats.lootFind)) {
      const item = randomDrop(quest.level, stats.lootFind * 0.5 + d.reward * 0.15);
      if (addEquipment(c, item)) loot.push(item.name);
    }
    addLog(c.id, 'quest', `Quest complete: ${quest.title}. +${xp} XP, +${gold} gold${loot.length ? ', ' + loot.join(', ') : ''}.`);
    summary.quests.push({ title: quest.title, won: true, xp, gold, loot, log: fight.log, fighters: fight.fighters });
  } else {
    const xp = Math.round(quest.xp * 0.25);
    grantXp(c, xp);
    addLog(c.id, 'quest', `Quest failed: ${quest.title}. The ${ENEMIES[quest.enemy].name} was too strong. +${xp} XP.`);
    summary.quests.push({ title: quest.title, won: false, xp, gold: 0, loot: [], log: fight.log, fighters: fight.fighters });
  }
}

// ---------- Stop / cancel ----------

export function stopActivity(c) {
  const a = c.activity;
  if (a.type === 'craft') {
    const r = RECIPES[a.recipeId];
    const left = a.count - a.done;
    for (const [mat, n] of Object.entries(r.inputs)) {
      const kind = CONSUMABLES[mat] ? 'consumable' : 'resource';
      addStack(c, kind, mat, n * left, { force: true });
    }
    if (left) addLog(c.id, 'craft', `Cancelled crafting; materials for ${left} craft(s) returned.`);
  } else if (a.type === 'gather') {
    const got = Object.entries(a.totals || {}).map(([r, n]) => `${n}x ${RESOURCES[r].name}`);
    if (got.length) addLog(c.id, 'gather', `Stopped ${ACTIVITIES[a.activityId].name.toLowerCase()}: gathered ${got.join(', ')}.`);
  } else if (a.type === 'quest') {
    addLog(c.id, 'quest', `Abandoned quest: ${a.quest.title}.`);
  } else if (a.type === 'travel') {
    addLog(c.id, 'travel', `Turned back and stayed in ${AREAS[c.location].name}.`);
  }
  c.activity = { ...IDLE };
}

// ---------- The tick ----------

/** Advance a character to `now`. Mutates c; caller saves. Returns a summary of what happened. */
export function tick(c, now = Date.now()) {
  const summary = { resources: {}, items: [], crafted: [], quests: [], profXp: {}, charXp: 0, arrived: null, stopped: null, offlineMs: 0 };
  const capMs = BALANCE.offlineCapHours * 3600 * 1000;

  // Stamina regen
  const regenMs = BALANCE.staminaRegenSeconds * 1000;
  if (c.stamina < BALANCE.staminaMax) {
    c.stamina = Math.min(BALANCE.staminaMax, c.stamina + (now - c.stamina_at) / regenMs);
  }
  c.stamina_at = now;
  c.buffs = c.buffs.filter((b) => b.until > now);

  const a = c.activity;
  if (a.type === 'travel' && now >= a.endsAt) {
    arrive(c, a.to);
    summary.arrived = a.to;
    c.activity = { ...IDLE };
  } else if (a.type === 'gather') {
    let elapsed = now - a.lastAt;
    if (elapsed > capMs) { summary.offlineMs = elapsed; elapsed = capMs; a.lastAt = now - capMs; }
    let rates = refreshGatherRate(c);
    let cycles = Math.floor(elapsed / a.cycleMs);
    let guard = 0;
    while (cycles > 0 && guard++ < 20000) {
      const res = gatherCycle(c, rates, summary);
      if (res === false) {
        summary.stopped = 'Inventory full';
        addLog(c.id, 'gather', 'Your inventory is full - gathering stopped.');
        c.activity = { ...IDLE };
        break;
      }
      a.lastAt += a.cycleMs;
      cycles--;
      if (res === 'levelup') { rates = refreshGatherRate(c); cycles = Math.floor((now - a.lastAt) / a.cycleMs); }
    }
  } else if (a.type === 'craft') {
    let guard = 0;
    while (a.done < a.count && now >= a.nextAt && guard++ < 1000) {
      if (!craftOne(c, summary)) break;
      a.done++;
      a.nextAt += a.cycleMs;
    }
    if (a.done >= a.count) {
      addLog(c.id, 'craft', `Finished crafting ${a.count}x ${RECIPES[a.recipeId].name}.`);
      c.activity = { ...IDLE };
    }
  } else if (a.type === 'quest' && now >= a.endsAt) {
    completeQuest(c, summary);
    c.activity = { ...IDLE };
  }

  if (summary.charXp > 0) {
    const { stats } = statsFor(c);
    grantXp(c, summary.charXp * (1 + stats.xpGain));
  }
  c.last_seen = now;
  return summary;
}
