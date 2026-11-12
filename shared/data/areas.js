// The world map. Coordinates are on a 1000 x 700 canvas.
// Activities: `drops` are weighted common rolls (one per cycle, filtered by profession level);
// `rares` roll independently each cycle with `chance` (boosted by rare-find stats).
export const START_AREA = 'greenhollow';
export const TRAVEL_SECONDS_PER_UNIT = 0.6; // 100 map units = 60s base travel

export const ACTIVITIES = {
  woodcutting: { name: 'Woodcutting', profession: 'woodcutting', tool: 'tool_axe', baseSeconds: 6, icon: '🪓' },
  mining: { name: 'Mining', profession: 'mining', tool: 'tool_pickaxe', baseSeconds: 7, icon: '⛏️' },
  prospecting: { name: 'Prospecting', profession: 'mining', tool: 'tool_pickaxe', baseSeconds: 12, icon: '🔍', description: 'Slow, but far better odds of gems and precious ore.' },
  herbalism: { name: 'Herbalism', profession: 'herbalism', tool: 'tool_sickle', baseSeconds: 5, icon: '🌿' },
  hunting: { name: 'Hunting', profession: 'hunting', tool: 'tool_bow', baseSeconds: 8, icon: '🏹' },
  fishing: { name: 'Fishing', profession: 'fishing', tool: 'tool_rod', baseSeconds: 7, icon: '🎣' },
  scavenging: { name: 'Scavenging', profession: 'mining', tool: null, baseSeconds: 9, icon: '🏺', description: 'Sift through sand and ruins. No tool required.' },
};

export const AREAS = {
  greenhollow: {
    name: 'Greenhollow Village', theme: 'village', color: '#7cb35a', x: 150, y: 380, level: 1,
    description: 'A peaceful farming village by the river. Every adventure starts here.',
    unlock: { level: 1 },
    connections: { whisperwood: 190, azure_coast: 240 },
    activities: {
      fishing: { drops: [{ res: 'river_trout', w: 80 }, { res: 'salmon', w: 20, lvl: 8 }], rares: [{ res: 'pearl', chance: 0.002 }] },
      herbalism: { drops: [{ res: 'flax', w: 55 }, { res: 'greenleaf', w: 45 }], rares: [] },
    },
    enemies: ['giant_rat', 'bandit'],
    shop: true,
  },
  whisperwood: {
    name: 'Whisperwood Forest', theme: 'forest', color: '#2e7d32', x: 320, y: 270, level: 1,
    description: 'Dense old woods full of game, herbs and lurking goblins.',
    unlock: { level: 1 },
    connections: { greenhollow: 190, ironpeak: 240, mirefen: 270, ancient_grove: 200 },
    activities: {
      woodcutting: { drops: [{ res: 'oak_log', w: 75 }, { res: 'maple_log', w: 25, lvl: 10 }], rares: [{ res: 'ancient_heartwood', chance: 0.004, lvl: 15 }] },
      herbalism: { drops: [{ res: 'greenleaf', w: 50 }, { res: 'mushroom', w: 35 }, { res: 'bloodthistle', w: 15, lvl: 8 }], rares: [{ res: 'swamp_lotus', chance: 0.003 }] },
      hunting: { drops: [{ res: 'animal_hide', w: 70 }, { res: 'wolf_pelt', w: 30, lvl: 5 }], rares: [{ res: 'golden_antler', chance: 0.003, lvl: 10 }] },
    },
    enemies: ['wolf', 'goblin', 'forest_troll'],
  },
  ironpeak: {
    name: 'Ironpeak Mountains', theme: 'mountains', color: '#8d8d8d', x: 520, y: 150, level: 6,
    description: 'Wind-scoured peaks threaded with copper, iron and silver veins.',
    unlock: { level: 5 },
    connections: { whisperwood: 240, frostspire: 230, mirefen: 300 },
    activities: {
      mining: { drops: [{ res: 'stone', w: 35 }, { res: 'copper_ore', w: 30 }, { res: 'iron_ore', w: 25, lvl: 5 }, { res: 'coal', w: 15, lvl: 8 }, { res: 'silver_ore', w: 10, lvl: 14 }], rares: [{ res: 'ruby', chance: 0.004 }, { res: 'sapphire', chance: 0.004 }] },
      prospecting: { drops: [{ res: 'silver_ore', w: 40, lvl: 10 }, { res: 'iron_ore', w: 40 }, { res: 'gold_ore', w: 20, lvl: 18 }], rares: [{ res: 'ruby', chance: 0.02 }, { res: 'sapphire', chance: 0.02 }, { res: 'emerald', chance: 0.01, lvl: 15 }] },
    },
    enemies: ['harpy', 'rock_golem', 'mountain_troll', 'stone_colossus'],
  },
  azure_coast: {
    name: 'Azure Coast', theme: 'coast', color: '#29b6f6', x: 130, y: 600, level: 8,
    description: 'White cliffs and tide pools. Pirates prowl the coves.',
    unlock: { level: 6 },
    connections: { greenhollow: 240, mirefen: 300 },
    activities: {
      fishing: { drops: [{ res: 'river_trout', w: 30 }, { res: 'salmon', w: 40 }, { res: 'deep_tuna', w: 30, lvl: 12 }], rares: [{ res: 'pearl', chance: 0.012 }] },
      scavenging: { drops: [{ res: 'driftwood', w: 50 }, { res: 'old_coin', w: 40 }, { res: 'relic_shard', w: 10, lvl: 12 }], rares: [{ res: 'pearl', chance: 0.006 }] },
    },
    enemies: ['giant_crab', 'pirate', 'sea_serpent'],
  },
  mirefen: {
    name: 'Mirefen Swamp', theme: 'swamp', color: '#556b2f', x: 420, y: 500, level: 10,
    description: 'A fog-choked marsh of rare herbs, giant spiders and restless dead.',
    unlock: { level: 9 },
    connections: { whisperwood: 270, azure_coast: 300, sunscorch: 330, ironpeak: 300 },
    activities: {
      herbalism: { drops: [{ res: 'mushroom', w: 35 }, { res: 'bloodthistle', w: 35 }, { res: 'nightshade', w: 30, lvl: 10 }], rares: [{ res: 'swamp_lotus', chance: 0.015 }] },
      hunting: { drops: [{ res: 'animal_hide', w: 30 }, { res: 'spider_silk', w: 45, lvl: 8 }, { res: 'venom_gland', w: 25, lvl: 12 }], rares: [{ res: 'golden_antler', chance: 0.002 }] },
      fishing: { drops: [{ res: 'bog_eel', w: 70, lvl: 6 }, { res: 'river_trout', w: 30 }], rares: [{ res: 'pearl', chance: 0.004 }] },
    },
    enemies: ['swamp_creature', 'giant_spider', 'risen_dead', 'bog_witch'],
  },
  sunscorch: {
    name: 'Sunscorch Desert', theme: 'desert', color: '#e0b04a', x: 690, y: 560, level: 16,
    description: 'Endless dunes hiding gold, gems and the bones of old empires.',
    unlock: { level: 15 },
    connections: { mirefen: 330, sunken_ruins: 240 },
    activities: {
      mining: { drops: [{ res: 'sandstone', w: 45 }, { res: 'gold_ore', w: 35, lvl: 15 }, { res: 'iron_ore', w: 20 }], rares: [{ res: 'ruby', chance: 0.008 }, { res: 'emerald', chance: 0.006 }] },
      scavenging: { drops: [{ res: 'old_coin', w: 40 }, { res: 'relic_shard', w: 40 }, { res: 'desert_bloom', w: 20, lvl: 12 }], rares: [{ res: 'ancient_tablet', chance: 0.006 }] },
      herbalism: { drops: [{ res: 'desert_bloom', w: 100, lvl: 15 }], rares: [{ res: 'phoenix_orchid', chance: 0.001 }] },
      hunting: { drops: [{ res: 'scorpion_carapace', w: 70, lvl: 15 }, { res: 'animal_hide', w: 30 }], rares: [] },
    },
    enemies: ['scorpion', 'sand_beast', 'sand_wyrm'],
  },
  ancient_grove: {
    name: 'Ancient Grove', theme: 'ancient_forest', color: '#1b5e20', x: 170, y: 120, level: 20,
    description: 'Primeval trees older than kingdoms, guarded by living wood.',
    unlock: { level: 19 },
    connections: { whisperwood: 200 },
    activities: {
      woodcutting: { drops: [{ res: 'maple_log', w: 40 }, { res: 'ironwood_log', w: 60, lvl: 22 }], rares: [{ res: 'ancient_heartwood', chance: 0.02 }] },
      herbalism: { drops: [{ res: 'moonpetal', w: 60, lvl: 22 }, { res: 'mushroom', w: 40 }], rares: [{ res: 'emerald', chance: 0.004 }] },
    },
    enemies: ['dryad', 'treant', 'elder_treant'],
  },
  frostspire: {
    name: 'Frostspire Peaks', theme: 'snow', color: '#cfe8f3', x: 720, y: 90, level: 24,
    description: 'Frozen summits where mithril glints beneath the ice.',
    unlock: { level: 23 },
    connections: { ironpeak: 230, emberdeep: 220, sunken_ruins: 300 },
    activities: {
      mining: { drops: [{ res: 'mithril_ore', w: 50, lvl: 25 }, { res: 'silver_ore', w: 30 }, { res: 'stone', w: 20 }], rares: [{ res: 'frost_crystal', chance: 0.012 }, { res: 'sapphire', chance: 0.008 }] },
      herbalism: { drops: [{ res: 'frost_lily', w: 100, lvl: 24 }], rares: [{ res: 'frost_crystal', chance: 0.006 }] },
      hunting: { drops: [{ res: 'yeti_fur', w: 70, lvl: 24 }, { res: 'wolf_pelt', w: 30 }], rares: [{ res: 'golden_antler', chance: 0.006 }] },
    },
    enemies: ['ice_wolf', 'yeti', 'frost_giant'],
  },
  sunken_ruins: {
    name: 'Sunken Ruins', theme: 'ruins', color: '#7e57c2', x: 880, y: 380, level: 28,
    description: 'A drowned city of a forgotten empire, haunted by its former guardians.',
    unlock: { level: 27 },
    connections: { sunscorch: 240, frostspire: 300, emberdeep: 280 },
    activities: {
      scavenging: { drops: [{ res: 'relic_shard', w: 60 }, { res: 'old_coin', w: 40 }], rares: [{ res: 'ancient_tablet', chance: 0.02 }, { res: 'star_diamond', chance: 0.001 }] },
      fishing: { drops: [{ res: 'ghostfin', w: 60, lvl: 28 }, { res: 'deep_tuna', w: 40 }], rares: [{ res: 'pearl', chance: 0.02 }] },
    },
    enemies: ['drowned_knight', 'wraith', 'lich_king'],
  },
  emberdeep: {
    name: 'Emberdeep Caverns', theme: 'volcanic', color: '#e64a19', x: 900, y: 170, level: 34,
    description: 'Volcanic tunnels of obsidian and adamantite, ruled by an ashen dragon.',
    unlock: { level: 33 },
    connections: { frostspire: 220, sunken_ruins: 280 },
    activities: {
      mining: { drops: [{ res: 'obsidian', w: 40 }, { res: 'adamantite_ore', w: 45, lvl: 35 }, { res: 'coal', w: 15 }], rares: [{ res: 'star_diamond', chance: 0.004 }, { res: 'ruby', chance: 0.01 }] },
      woodcutting: { drops: [{ res: 'emberwood_log', w: 100, lvl: 32 }], rares: [] },
      herbalism: { drops: [{ res: 'fire_blossom', w: 100, lvl: 34 }], rares: [{ res: 'phoenix_orchid', chance: 0.005 }] },
      hunting: { drops: [{ res: 'drake_scale', w: 100, lvl: 35 }], rares: [{ res: 'dragon_heart', chance: 0.0005 }] },
    },
    enemies: ['fire_elemental', 'magma_drake', 'ashen_dragon'],
  },
};
