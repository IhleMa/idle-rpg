// Enemies. Base stats are derived from level in shared/rules.js (enemyStats) and scaled by
// the multipliers here. Bosses cost more stamina and drop boss trophies + better loot.
const E = (name, icon, level, opts = {}) => ({
  name, icon, level,
  hp: 1, dmg: 1, armor: 1, speed: 1, crit: 0.05, damageType: 'phys',
  drops: [], boss: false, elite: false,
  ...opts,
});

export const ENEMIES = {
  giant_rat: E('Giant Rat', '🐀', 1, { hp: 0.7, dmg: 0.7, drops: [{ res: 'animal_hide', chance: 0.4 }] }),
  bandit: E('Bandit', '🥷', 3, { drops: [{ res: 'old_coin', chance: 0.4 }, { res: 'linen_cloth', chance: 0.2 }] }),

  wolf: E('Wolf', '🐺', 2, { hp: 0.9, speed: 1.2, drops: [{ res: 'wolf_pelt', chance: 0.5 }, { res: 'animal_hide', chance: 0.4 }] }),
  goblin: E('Goblin', '👺', 4, { drops: [{ res: 'monster_essence', chance: 0.35 }, { res: 'copper_ore', chance: 0.3 }] }),
  forest_troll: E('Forest Troll', '🧌', 7, { hp: 2.8, dmg: 1.3, armor: 1.5, boss: true, drops: [{ res: 'troll_tusk', chance: 1 }, { res: 'monster_essence', chance: 1, qty: 3 }] }),

  harpy: E('Harpy', '🦅', 7, { speed: 1.3, hp: 0.9, drops: [{ res: 'monster_essence', chance: 0.4 }] }),
  rock_golem: E('Rock Golem', '🗿', 9, { hp: 1.5, armor: 2.2, speed: 0.7, drops: [{ res: 'golem_core', chance: 0.25 }, { res: 'stone', chance: 0.8, qty: 3 }] }),
  mountain_troll: E('Mountain Troll', '🧌', 11, { hp: 1.6, dmg: 1.3, elite: true, drops: [{ res: 'troll_tusk', chance: 0.4 }, { res: 'iron_ore', chance: 0.5, qty: 2 }] }),
  stone_colossus: E('Stone Colossus', '⛰️', 14, { hp: 3.2, dmg: 1.4, armor: 2.5, speed: 0.7, boss: true, drops: [{ res: 'golem_core', chance: 1, qty: 2 }, { res: 'ruby', chance: 0.3 }] }),

  giant_crab: E('Giant Crab', '🦀', 8, { armor: 2, drops: [{ res: 'pearl', chance: 0.03 }, { res: 'monster_essence', chance: 0.3 }] }),
  pirate: E('Pirate', '🏴‍☠️', 10, { crit: 0.1, drops: [{ res: 'old_coin', chance: 0.7, qty: 3 }] }),
  sea_serpent: E('Sea Serpent', '🐍', 13, { hp: 3, dmg: 1.3, boss: true, drops: [{ res: 'pearl', chance: 0.6 }, { res: 'deep_tuna', chance: 1, qty: 3 }] }),

  swamp_creature: E('Swamp Creature', '🐸', 10, { hp: 1.2, drops: [{ res: 'monster_essence', chance: 0.4 }, { res: 'nightshade', chance: 0.3 }] }),
  giant_spider: E('Giant Spider', '🕷️', 12, { speed: 1.2, drops: [{ res: 'spider_silk', chance: 0.6, qty: 2 }, { res: 'venom_gland', chance: 0.25 }] }),
  risen_dead: E('Risen Dead', '🧟', 13, { hp: 1.4, drops: [{ res: 'bone_dust', chance: 0.6 }] }),
  bog_witch: E('Bog Witch', '🧙‍♀️', 17, { hp: 3, dmg: 1.5, damageType: 'magic', boss: true, drops: [{ res: 'swamp_lotus', chance: 1 }, { res: 'ectoplasm', chance: 0.6 }] }),

  scorpion: E('Giant Scorpion', '🦂', 16, { armor: 1.6, drops: [{ res: 'scorpion_carapace', chance: 0.6 }, { res: 'venom_gland', chance: 0.3 }] }),
  sand_beast: E('Sand Beast', '🦁', 18, { hp: 1.4, dmg: 1.2, drops: [{ res: 'animal_hide', chance: 0.6, qty: 2 }, { res: 'monster_essence', chance: 0.5 }] }),
  sand_wyrm: E('Sand Wyrm', '🐛', 22, { hp: 3.4, dmg: 1.5, boss: true, drops: [{ res: 'gold_ore', chance: 1, qty: 4 }, { res: 'emerald', chance: 0.4 }] }),

  dryad: E('Corrupted Dryad', '🧚', 20, { damageType: 'magic', drops: [{ res: 'moonpetal', chance: 0.5 }] }),
  treant: E('Treant', '🌲', 22, { hp: 1.8, armor: 1.8, speed: 0.7, drops: [{ res: 'ironwood_log', chance: 0.6, qty: 2 }] }),
  elder_treant: E('Elder Treant', '🌳', 26, { hp: 3.6, armor: 2, boss: true, drops: [{ res: 'ancient_heartwood', chance: 1, qty: 2 }] }),

  ice_wolf: E('Ice Wolf', '🐺', 24, { speed: 1.3, drops: [{ res: 'wolf_pelt', chance: 0.6, qty: 2 }, { res: 'frost_crystal', chance: 0.05 }] }),
  yeti: E('Yeti', '🦍', 27, { hp: 1.7, dmg: 1.3, elite: true, drops: [{ res: 'yeti_fur', chance: 0.7, qty: 2 }] }),
  frost_giant: E('Frost Giant', '🥶', 31, { hp: 3.5, dmg: 1.6, boss: true, drops: [{ res: 'frost_crystal', chance: 1, qty: 2 }, { res: 'mithril_ore', chance: 1, qty: 4 }] }),

  drowned_knight: E('Drowned Knight', '🧜', 28, { armor: 2, drops: [{ res: 'relic_shard', chance: 0.5 }, { res: 'bone_dust', chance: 0.5 }] }),
  wraith: E('Wraith', '👻', 30, { damageType: 'magic', speed: 1.2, drops: [{ res: 'ectoplasm', chance: 0.6 }] }),
  lich_king: E('Lich King', '💀', 35, { hp: 3.8, dmg: 1.7, damageType: 'magic', boss: true, drops: [{ res: 'ectoplasm', chance: 1, qty: 3 }, { res: 'ancient_tablet', chance: 0.5 }] }),

  fire_elemental: E('Fire Elemental', '🔥', 34, { damageType: 'magic', drops: [{ res: 'elemental_core', chance: 0.4 }, { res: 'obsidian', chance: 0.5 }] }),
  magma_drake: E('Magma Drake', '🦎', 37, { hp: 1.6, dmg: 1.3, elite: true, drops: [{ res: 'drake_scale', chance: 0.7, qty: 2 }] }),
  ashen_dragon: E('Ashen Dragon', '🐉', 42, { hp: 4.5, dmg: 1.9, armor: 2, boss: true, drops: [{ res: 'dragon_heart', chance: 0.25 }, { res: 'drake_scale', chance: 1, qty: 5 }, { res: 'elemental_core', chance: 1, qty: 2 }] }),
};
