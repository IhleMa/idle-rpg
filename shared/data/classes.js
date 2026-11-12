// Classes: starting attributes, per-level growth, passives, and abilities that unlock with level.
// Ability `type` values are interpreted by shared/combat.js:
//   strike  - every `every` attacks, deal `mult`x damage (optionally `crit: true` guaranteed)
//   opener  - the first attack deals `mult`x damage
//   heal    - when HP < `below`, heal `pct` of max HP (max `uses` times per fight)
//   shield  - start the fight with an absorb shield of `pct` max HP
//   buff    - start the fight with +`dmg` damage multiplier
//   bleed   - every `every` attacks, apply `pct` of hit damage per turn for `turns` turns
//   passive - permanent stat bonus once unlocked (applies everywhere)
export const CLASSES = {
  warrior: {
    name: 'Warrior',
    icon: '⚔️',
    description: 'Front-line fighter with high health, armor and physical damage.',
    damageType: 'phys',
    mainStat: 'str',
    baseAttributes: { str: 8, dex: 4, int: 2, con: 7, lck: 3 },
    growth: { str: 2, dex: 0.6, int: 0.3, con: 1.6, lck: 0.4 },
    passives: { healthPct: 0.15, armorPct: 0.10, physDmgPct: 0.06 },
    weaponSynergy: ['sword', 'axe_weapon', 'mace'],
    abilities: [
      { id: 'cleave', name: 'Cleave', level: 1, type: 'strike', every: 4, mult: 1.7, description: 'Every 4th attack deals 170% damage.' },
      { id: 'battle_cry', name: 'Battle Cry', level: 8, type: 'buff', dmg: 0.12, description: 'Start each fight with +12% damage.' },
      { id: 'iron_skin', name: 'Iron Skin', level: 15, type: 'passive', stats: { armorPct: 0.15 }, description: 'Permanently +15% armor.' },
      { id: 'second_wind', name: 'Second Wind', level: 22, type: 'heal', below: 0.3, pct: 0.25, uses: 1, description: 'Once per fight, heal 25% HP when below 30%.' },
      { id: 'executioner', name: 'Executioner', level: 30, type: 'strike', every: 7, mult: 2.6, crit: true, description: 'Every 7th attack is a guaranteed critical dealing 260%.' },
    ],
  },
  mage: {
    name: 'Mage',
    icon: '🔮',
    description: 'Wields arcane power. Fragile, but devastating magic damage and crafting insight.',
    damageType: 'magic',
    mainStat: 'int',
    baseAttributes: { str: 2, dex: 4, int: 9, con: 4, lck: 4 },
    growth: { str: 0.3, dex: 0.6, int: 2.4, con: 1.0, lck: 0.6 },
    passives: { magicDmgPct: 0.08, craftEff: 0.05 },
    weaponSynergy: ['staff', 'wand'],
    abilities: [
      { id: 'fireball', name: 'Fireball', level: 1, type: 'strike', every: 3, mult: 1.7, description: 'Every 3rd attack hurls a fireball for 170% damage.' },
      { id: 'mana_shield', name: 'Mana Shield', level: 8, type: 'shield', pct: 0.25, description: 'Start each fight with a shield of 25% max HP.' },
      { id: 'arcane_mind', name: 'Arcane Mind', level: 15, type: 'passive', stats: { magicDmgPct: 0.12, craftQuality: 0.05 }, description: 'Permanently +12% magic damage and +5% crafting quality.' },
      { id: 'ignite', name: 'Ignite', level: 22, type: 'bleed', every: 4, pct: 0.35, turns: 3, description: 'Every 4th attack burns for 35% of the hit per turn, 3 turns.' },
      { id: 'meteor', name: 'Meteor', level: 30, type: 'opener', mult: 3.0, description: 'Open each fight with a meteor dealing 300% damage.' },
    ],
  },
  ranger: {
    name: 'Ranger',
    icon: '🏹',
    description: 'Precise marksman. High critical chance and an expert hunter of beasts.',
    damageType: 'phys',
    mainStat: 'dex',
    baseAttributes: { str: 4, dex: 9, int: 3, con: 5, lck: 5 },
    growth: { str: 0.8, dex: 2.2, int: 0.4, con: 1.4, lck: 0.8 },
    passives: { critChance: 0.09, critDmg: 0.15, huntingYield: 0.15, huntingSpeed: 0.10 },
    weaponSynergy: ['bow'],
    abilities: [
      { id: 'aimed_shot', name: 'Aimed Shot', level: 1, type: 'strike', every: 4, mult: 1.6, crit: true, description: 'Every 4th attack is a guaranteed critical for 160%.' },
      { id: 'hunters_mark', name: "Hunter's Mark", level: 8, type: 'buff', dmg: 0.10, description: 'Start each fight with +10% damage.' },
      { id: 'pathfinder', name: 'Pathfinder', level: 15, type: 'passive', stats: { travelSpeed: 0.15, dodge: 0.04 }, description: 'Permanently +15% travel speed and +4% dodge.' },
      { id: 'poison_arrow', name: 'Poison Arrow', level: 22, type: 'bleed', every: 3, pct: 0.25, turns: 3, description: 'Every 3rd attack poisons for 25% of the hit per turn, 3 turns.' },
      { id: 'volley', name: 'Volley', level: 30, type: 'strike', every: 6, mult: 2.8, description: 'Every 6th attack looses a volley for 280% damage.' },
    ],
  },
  rogue: {
    name: 'Rogue',
    icon: '🗡️',
    description: 'Fast and deadly. High attack speed, brutal critical hits and a knack for loot.',
    damageType: 'phys',
    mainStat: 'dex',
    baseAttributes: { str: 5, dex: 8, int: 3, con: 4, lck: 6 },
    growth: { str: 1.0, dex: 2.1, int: 0.4, con: 1.2, lck: 1.0 },
    passives: { attackSpeed: 0.16, critDmg: 0.3, lootFind: 0.10, healthPct: 0.03 },
    weaponSynergy: ['dagger', 'sword'],
    abilities: [
      { id: 'backstab', name: 'Backstab', level: 1, type: 'opener', mult: 2.2, description: 'The first attack of each fight deals 220% damage.' },
      { id: 'evasion', name: 'Evasion', level: 8, type: 'passive', stats: { dodge: 0.08 }, description: 'Permanently +8% dodge chance.' },
      { id: 'lacerate', name: 'Lacerate', level: 15, type: 'bleed', every: 3, pct: 0.3, turns: 3, description: 'Every 3rd attack causes bleeding for 30% of the hit per turn.' },
      { id: 'pickpocket', name: 'Pickpocket', level: 22, type: 'passive', stats: { goldFind: 0.15, lootFind: 0.10 }, description: 'Permanently +15% gold and +10% loot discovery.' },
      { id: 'shadow_flurry', name: 'Shadow Flurry', level: 30, type: 'strike', every: 5, mult: 2.4, crit: true, description: 'Every 5th attack is a guaranteed critical for 240%.' },
    ],
  },
  paladin: {
    name: 'Paladin',
    icon: '🛡️',
    description: 'Holy defender. Heals in battle, wears heavy armor and is very hard to kill.',
    damageType: 'phys',
    mainStat: 'str',
    baseAttributes: { str: 6, dex: 3, int: 5, con: 8, lck: 3 },
    growth: { str: 1.4, dex: 0.4, int: 1.0, con: 1.9, lck: 0.4 },
    passives: { armorPct: 0.15, healthPct: 0.10 },
    weaponSynergy: ['mace', 'sword'],
    abilities: [
      { id: 'holy_light', name: 'Holy Light', level: 1, type: 'heal', below: 0.5, pct: 0.18, uses: 2, description: 'Twice per fight, heal 18% HP when below 50%.' },
      { id: 'divine_shield', name: 'Divine Shield', level: 8, type: 'shield', pct: 0.20, description: 'Start each fight with a shield of 20% max HP.' },
      { id: 'smite', name: 'Smite', level: 15, type: 'strike', every: 4, mult: 1.6, description: 'Every 4th attack smites for 160% damage.' },
      { id: 'aura_of_devotion', name: 'Aura of Devotion', level: 22, type: 'passive', stats: { armorPct: 0.10, healthPct: 0.10 }, description: 'Permanently +10% armor and health.' },
      { id: 'judgement', name: 'Judgement', level: 30, type: 'opener', mult: 2.5, description: 'Open each fight with Judgement for 250% damage.' },
    ],
  },
};
