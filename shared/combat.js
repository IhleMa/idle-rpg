// Deterministic (seeded) auto-battle engine. Used by the server for PvE and PvP; the client only
// replays the returned log. Fighters attack on their own timers based on attack speed.
import { BALANCE } from './balance.js';

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function rng() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function prep(f, mode, isPvp) {
  const maxHp = Math.round(f.maxHp * mode.hpMult);
  const st = {
    ...f,
    maxHp,
    hp: maxHp,
    shield: 0,
    dmgBuff: 0,
    attacks: 0,
    interval: 2 / Math.max(0.3, f.attackSpeed),
    healUses: {},
    dots: [],
    potions: isPvp ? [] : (f.potions || []).map((p) => ({ ...p })),
    potionsUsed: {},
  };
  st.nextAt = st.interval * 0.6;
  for (const ab of f.abilities || []) {
    if (ab.type === 'shield') st.shield += Math.round(maxHp * ab.pct * mode.shieldMult);
    if (ab.type === 'buff') st.dmgBuff += ab.dmg;
  }
  return st;
}

/**
 * Simulate a fight. Returns { winner: 0|1, log, duration, fighters, potionsUsed }.
 * fighter: { name, icon, level, maxHp, damage, damageType, armor, critChance, critDmg,
 *            attackSpeed, dodge, lifeSteal, abilities: [], potions: [{id, name, pct, qty}] }
 */
export function simulateFight(a, b, { seed = Date.now(), pvp = false } = {}) {
  const rng = mulberry32(seed);
  const mode = pvp ? BALANCE.pvp : BALANCE.pve;
  const F = [prep(a, mode, pvp), prep(b, mode, pvp)];
  const log = [];
  const r1 = (n) => Math.round(n * 10) / 10;
  const push = (t, actor, kind, value, text) => log.push({ t: r1(t), a: actor, kind, value, text, hp: [Math.max(0, F[0].hp), Math.max(0, F[1].hp)], sh: [F[0].shield, F[1].shield] });

  for (let i = 0; i < 2; i++) {
    if (F[i].shield > 0) push(0, i, 'shield', F[i].shield, `${F[i].name} is protected by a shield (${F[i].shield}).`);
    if (F[i].dmgBuff > 0) push(0, i, 'buff', F[i].dmgBuff, `${F[i].name} is empowered (+${Math.round(F[i].dmgBuff * 100)}% damage).`);
  }

  const applyDamage = (target, amount) => {
    let dmg = amount;
    if (target.shield > 0) {
      const absorbed = Math.min(target.shield, dmg);
      target.shield -= absorbed;
      dmg -= absorbed;
    }
    target.hp -= dmg;
    return dmg;
  };

  let t = 0;
  let guard = 0;
  while (F[0].hp > 0 && F[1].hp > 0 && guard++ < 2000) {
    const i = F[0].nextAt <= F[1].nextAt ? 0 : 1;
    const me = F[i];
    const foe = F[1 - i];
    t = me.nextAt;
    if (t > BALANCE.combatMaxSeconds) break;

    // Damage over time that I applied ticks on my turn
    for (const dot of me.dots) {
      if (dot.turns <= 0) continue;
      dot.turns--;
      applyDamage(foe, dot.dmg);
      push(t, i, 'dot', dot.dmg, `${foe.name} suffers ${dot.dmg} from ${dot.name}.`);
    }
    me.dots = me.dots.filter((d) => d.turns > 0);
    if (foe.hp <= 0) break;

    // Self heals (abilities, then potions)
    for (const ab of me.abilities || []) {
      if (ab.type !== 'heal') continue;
      const used = me.healUses[ab.id] || 0;
      if (used < ab.uses && me.hp < me.maxHp * ab.below) {
        const heal = Math.round(me.maxHp * ab.pct * mode.healMult);
        me.hp = Math.min(me.maxHp, me.hp + heal);
        me.healUses[ab.id] = used + 1;
        push(t, i, 'heal', heal, `${me.name} casts ${ab.name}, healing ${heal}.`);
      }
    }
    if (me.hp < me.maxHp * 0.35) {
      const pot = me.potions.filter((p) => p.qty > 0).sort((x, y) => y.pct - x.pct)[0];
      const totalUsed = Object.values(me.potionsUsed).reduce((s, n) => s + n, 0);
      if (pot && totalUsed < 3) {
        const heal = Math.round(me.maxHp * pot.pct);
        me.hp = Math.min(me.maxHp, me.hp + heal);
        pot.qty--;
        me.potionsUsed[pot.id] = (me.potionsUsed[pot.id] || 0) + 1;
        push(t, i, 'potion', heal, `${me.name} drinks a ${pot.name}, healing ${heal}.`);
      }
    }

    // Attack
    me.attacks++;
    let mult = 1;
    let forcedCrit = false;
    let abilityName = null;
    let bleed = null;
    for (const ab of me.abilities || []) {
      if (ab.type === 'opener' && me.attacks === 1) {
        const m = pvp ? 1 + (ab.mult - 1) * (BALANCE.pvp.openerMult ?? 1) : ab.mult;
        if (m > mult) { mult = m; abilityName = ab.name; }
      }
      if (ab.type === 'strike' && me.attacks % ab.every === 0 && ab.mult >= mult) {
        mult = ab.mult; abilityName = ab.name; forcedCrit = forcedCrit || !!ab.crit;
      }
      if (ab.type === 'bleed' && me.attacks % ab.every === 0) bleed = ab;
    }

    const dodgeChance = Math.min(foe.dodge || 0, mode.dodgeCap);
    if (rng() < dodgeChance) {
      push(t, i, 'dodge', 0, `${foe.name} dodges ${abilityName ? me.name + "'s " + abilityName : me.name + "'s attack"}!`);
    } else {
      const crit = forcedCrit || rng() < Math.min(me.critChance, mode.critChanceCap);
      let raw = me.damage * (0.85 + rng() * 0.3) * mult * (1 + me.dmgBuff) * mode.dmgMult;
      if (crit) raw *= 1 + me.critDmg;
      const effArmor = me.damageType === 'magic' ? foe.armor * 0.5 : foe.armor;
      const reduction = Math.min(0.75, effArmor / (effArmor + 40 + 12 * (me.level || 1)));
      const dmg = Math.max(1, Math.round(raw * (1 - reduction)));
      applyDamage(foe, dmg);
      const verb = abilityName ? `uses ${abilityName} for` : 'hits for';
      push(t, i, crit ? 'crit' : 'hit', dmg, `${me.name} ${verb} ${dmg} damage${crit ? ' — CRITICAL!' : '.'}`);
      if (me.lifeSteal > 0) {
        const heal = Math.round(dmg * me.lifeSteal * mode.lifeStealMult);
        if (heal > 0) {
          me.hp = Math.min(me.maxHp, me.hp + heal);
          push(t, i, 'leech', heal, `${me.name} drains ${heal} health.`);
        }
      }
      if (bleed) {
        me.dots.push({ name: bleed.name, dmg: Math.max(1, Math.round(dmg * bleed.pct)), turns: bleed.turns });
        push(t, i, 'ability', 0, `${bleed.name} afflicts ${foe.name}.`);
      }
    }
    me.nextAt += me.interval;
  }

  let winner;
  if (F[0].hp <= 0 && F[1].hp > 0) winner = 1;
  else if (F[1].hp <= 0 && F[0].hp > 0) winner = 0;
  else winner = F[0].hp / F[0].maxHp >= F[1].hp / F[1].maxHp ? 0 : 1;
  if (!(F[0].hp <= 0 || F[1].hp <= 0)) push(t, winner, 'timeout', 0, 'Time is up! The fighter with more health remaining wins.');
  push(t, winner, 'end', 0, `${F[winner].name} is victorious!`);

  return {
    winner,
    log,
    duration: r1(t),
    fighters: F.map((f) => ({ name: f.name, icon: f.icon, level: f.level, maxHp: f.maxHp })),
    potionsUsed: F[0].potionsUsed,
  };
}
