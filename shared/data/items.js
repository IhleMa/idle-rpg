// Equipment slots, base item types, material tiers, rarities, consumables and sets.
// All item generation is server-side (server/game/loot.js); this file is pure data.

export const EQUIP_SLOTS = ['helmet', 'chest', 'gloves', 'pants', 'boots', 'weapon', 'offhand', 'necklace', 'ring1', 'ring2', 'accessory'];
export const TOOL_SLOTS = ['tool_axe', 'tool_pickaxe', 'tool_sickle', 'tool_bow', 'tool_rod'];
export const ALL_SLOTS = [...EQUIP_SLOTS, ...TOOL_SLOTS];

export const SLOT_LABELS = {
  helmet: 'Helmet', chest: 'Chest', gloves: 'Gloves', pants: 'Pants', boots: 'Boots',
  weapon: 'Weapon', offhand: 'Off-hand', necklace: 'Necklace', ring1: 'Ring', ring2: 'Ring', accessory: 'Accessory',
  tool_axe: 'Axe', tool_pickaxe: 'Pickaxe', tool_sickle: 'Sickle', tool_bow: 'Hunting Bow', tool_rod: 'Fishing Rod',
};

export const RARITIES = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic'];
export const RARITY_INFO = {
  common: { name: 'Common', color: '#c8c8c8', affixes: 0, mult: 1.0, weight: 600 },
  uncommon: { name: 'Uncommon', color: '#4caf50', affixes: 1, mult: 1.08, weight: 260 },
  rare: { name: 'Rare', color: '#3f8cff', affixes: 2, mult: 1.16, weight: 100 },
  epic: { name: 'Epic', color: '#b24bf3', affixes: 3, mult: 1.28, weight: 32 },
  legendary: { name: 'Legendary', color: '#ff9800', affixes: 4, mult: 1.42, weight: 7 },
  mythic: { name: 'Mythic', color: '#ff3d5a', affixes: 5, mult: 1.6, weight: 1 },
};

// Five material tiers. `level` is the item level the tier starts at.
export const TIERS = [
  { level: 1, metal: 'Copper', leather: 'Hide', cloth: 'Linen', wood: 'Oak', tool: 'Crude', jewel: 'Copper' },
  { level: 8, metal: 'Iron', leather: 'Wolfskin', cloth: 'Woolen', wood: 'Maple', tool: 'Iron', jewel: 'Silver' },
  { level: 16, metal: 'Steel', leather: 'Hardened', cloth: 'Silk', wood: 'Yew', tool: 'Steel', jewel: 'Gold' },
  { level: 26, metal: 'Mithril', leather: 'Frostfur', cloth: 'Moonsilk', wood: 'Ironwood', tool: 'Enchanted', jewel: 'Mithril' },
  { level: 36, metal: 'Adamantite', leather: 'Drakeskin', cloth: 'Emberweave', wood: 'Emberwood', tool: 'Adamant', jewel: 'Starforged' },
];

// Crafting materials used by each material family at each tier.
export const TIER_MATERIALS = {
  metal: ['copper_bar', 'iron_bar', 'steel_bar', 'mithril_bar', 'adamantite_bar'],
  wood: ['oak_log', 'maple_log', 'maple_log', 'ironwood_log', 'emberwood_log'],
  leather: ['cured_leather', 'cured_leather', 'hardened_leather', 'frost_leather', 'drake_leather'],
  cloth: ['linen_cloth', 'linen_cloth', 'silk_cloth', 'moonsilk', 'emberweave'],
  jewel: ['copper_bar', 'silver_bar', 'gold_bar', 'mithril_bar', 'adamantite_bar'],
  gem: [null, null, 'ruby', 'sapphire', 'star_diamond'],
  essence: [null, 'monster_essence', 'monster_essence', 'ectoplasm', 'elemental_core'],
};

// Base item types. `implicit` stats scale with item level: value = base + perLevel * ilvl.
// `material` picks the tier name family; `recipe` lists material families and quantities.
// `tags` decide which affixes may roll. `classes` (optional) gives a class synergy bonus.
export const BASE_TYPES = {
  // Weapons
  sword: { name: 'Sword', slot: 'weapon', icon: '🗡️', material: 'metal', tags: ['weapon', 'melee'], implicit: { physDmg: [5, 1.3] }, recipe: { metal: 4, wood: 1 }, profession: 'blacksmithing', classes: ['warrior', 'rogue', 'paladin'] },
  axe_weapon: { name: 'Battleaxe', slot: 'weapon', icon: '🪓', material: 'metal', tags: ['weapon', 'melee'], implicit: { physDmg: [7, 1.55], attackSpeed: [-0.08, 0] }, recipe: { metal: 5, wood: 2 }, profession: 'blacksmithing', classes: ['warrior'] },
  mace: { name: 'Mace', slot: 'weapon', icon: '🔨', material: 'metal', tags: ['weapon', 'melee'], implicit: { physDmg: [5, 1.2], armor: [2, 0.4] }, recipe: { metal: 5, wood: 1 }, profession: 'blacksmithing', classes: ['paladin', 'warrior'] },
  dagger: { name: 'Dagger', slot: 'weapon', icon: '🔪', material: 'metal', tags: ['weapon', 'melee'], implicit: { physDmg: [3, 0.95], attackSpeed: [0.10, 0], critChance: [0.02, 0] }, recipe: { metal: 3, leather: 1 }, profession: 'blacksmithing', classes: ['rogue'] },
  bow: { name: 'Longbow', slot: 'weapon', icon: '🏹', material: 'wood', tags: ['weapon', 'ranged'], implicit: { physDmg: [5, 1.25], critChance: [0.02, 0] }, recipe: { wood: 4, leather: 1 }, profession: 'crafting', classes: ['ranger'] },
  staff: { name: 'Staff', slot: 'weapon', icon: '🪄', material: 'wood', tags: ['weapon', 'caster'], implicit: { magicDmg: [6, 1.4], int: [1, 0.15] }, recipe: { wood: 4, cloth: 1 }, profession: 'crafting', classes: ['mage'] },
  wand: { name: 'Wand', slot: 'weapon', icon: '✨', material: 'wood', tags: ['weapon', 'caster'], implicit: { magicDmg: [4, 1.15], critChance: [0.03, 0] }, recipe: { wood: 2, jewel: 1 }, profession: 'crafting', classes: ['mage'] },

  // Off-hand
  shield: { name: 'Shield', slot: 'offhand', icon: '🛡️', material: 'metal', tags: ['offhand', 'defense'], implicit: { armor: [6, 1.4], health: [5, 1] }, recipe: { metal: 3, wood: 2 }, profession: 'blacksmithing', classes: ['warrior', 'paladin'] },
  tome: { name: 'Tome', slot: 'offhand', icon: '📖', material: 'cloth', tags: ['offhand', 'caster'], implicit: { magicDmg: [2, 0.5], int: [1, 0.2] }, recipe: { cloth: 3, leather: 1 }, profession: 'crafting', classes: ['mage'] },
  quiver: { name: 'Quiver', slot: 'offhand', icon: '🎯', material: 'leather', tags: ['offhand'], implicit: { critChance: [0.02, 0.001], dex: [1, 0.2] }, recipe: { leather: 3 }, profession: 'crafting', classes: ['ranger', 'rogue'] },

  // Armor (three weights per slot)
  plate_helm: { name: 'Helm', slot: 'helmet', icon: '⛑️', material: 'metal', tags: ['armor', 'helmet', 'heavy'], implicit: { armor: [4, 0.9], con: [1, 0.1] }, recipe: { metal: 3 }, profession: 'blacksmithing', classes: ['warrior', 'paladin'] },
  leather_cap: { name: 'Cap', slot: 'helmet', icon: '🧢', material: 'leather', tags: ['armor', 'helmet', 'medium'], implicit: { armor: [2, 0.55], dex: [1, 0.12] }, recipe: { leather: 3 }, profession: 'crafting', classes: ['ranger', 'rogue'] },
  cloth_hood: { name: 'Hood', slot: 'helmet', icon: '🎩', material: 'cloth', tags: ['armor', 'helmet', 'light'], implicit: { armor: [1, 0.3], int: [1, 0.15] }, recipe: { cloth: 3 }, profession: 'crafting', classes: ['mage'] },
  plate_chest: { name: 'Breastplate', slot: 'chest', icon: '🦺', material: 'metal', tags: ['armor', 'chest', 'heavy'], implicit: { armor: [7, 1.5], health: [6, 1.4] }, recipe: { metal: 6 }, profession: 'blacksmithing', classes: ['warrior', 'paladin'] },
  leather_vest: { name: 'Jerkin', slot: 'chest', icon: '🧥', material: 'leather', tags: ['armor', 'chest', 'medium'], implicit: { armor: [4, 0.9], dex: [1, 0.2] }, recipe: { leather: 5 }, profession: 'crafting', classes: ['ranger', 'rogue'] },
  cloth_robe: { name: 'Robe', slot: 'chest', icon: '👘', material: 'cloth', tags: ['armor', 'chest', 'light'], implicit: { armor: [2, 0.5], int: [2, 0.25] }, recipe: { cloth: 5 }, profession: 'crafting', classes: ['mage'] },
  plate_gloves: { name: 'Gauntlets', slot: 'gloves', icon: '🧤', material: 'metal', tags: ['armor', 'gloves', 'heavy'], implicit: { armor: [3, 0.7], str: [1, 0.1] }, recipe: { metal: 2 }, profession: 'blacksmithing' },
  leather_gloves: { name: 'Gloves', slot: 'gloves', icon: '🧤', material: 'leather', tags: ['armor', 'gloves', 'medium'], implicit: { armor: [1, 0.4], gatherSpeed: [0.02, 0.0008] }, recipe: { leather: 2 }, profession: 'crafting' },
  cloth_gloves: { name: 'Handwraps', slot: 'gloves', icon: '🧤', material: 'cloth', tags: ['armor', 'gloves', 'light'], implicit: { armor: [1, 0.25], craftEff: [0.02, 0.0008] }, recipe: { cloth: 2 }, profession: 'crafting' },
  plate_legs: { name: 'Greaves', slot: 'pants', icon: '👖', material: 'metal', tags: ['armor', 'pants', 'heavy'], implicit: { armor: [5, 1.1], con: [1, 0.12] }, recipe: { metal: 4 }, profession: 'blacksmithing', classes: ['warrior', 'paladin'] },
  leather_pants: { name: 'Leggings', slot: 'pants', icon: '👖', material: 'leather', tags: ['armor', 'pants', 'medium'], implicit: { armor: [3, 0.7], dex: [1, 0.12] }, recipe: { leather: 4 }, profession: 'crafting', classes: ['ranger', 'rogue'] },
  cloth_pants: { name: 'Trousers', slot: 'pants', icon: '👖', material: 'cloth', tags: ['armor', 'pants', 'light'], implicit: { armor: [1, 0.4], int: [1, 0.12] }, recipe: { cloth: 4 }, profession: 'crafting', classes: ['mage'] },
  plate_boots: { name: 'Sabatons', slot: 'boots', icon: '🥾', material: 'metal', tags: ['armor', 'boots', 'heavy'], implicit: { armor: [3, 0.8] }, recipe: { metal: 3 }, profession: 'blacksmithing' },
  leather_boots: { name: 'Boots', slot: 'boots', icon: '👢', material: 'leather', tags: ['armor', 'boots', 'medium'], implicit: { armor: [2, 0.5], travelSpeed: [0.03, 0.001] }, recipe: { leather: 3 }, profession: 'crafting' },
  cloth_shoes: { name: 'Slippers', slot: 'boots', icon: '🥿', material: 'cloth', tags: ['armor', 'boots', 'light'], implicit: { armor: [1, 0.3], travelSpeed: [0.02, 0.001] }, recipe: { cloth: 3 }, profession: 'crafting' },

  // Jewelry
  amulet: { name: 'Amulet', slot: 'necklace', icon: '📿', material: 'jewel', tags: ['jewelry', 'necklace'], implicit: { health: [4, 0.8] }, recipe: { jewel: 2, gem: 1 }, profession: 'crafting' },
  ring: { name: 'Ring', slot: 'ring', icon: '💍', material: 'jewel', tags: ['jewelry', 'ring'], implicit: { lck: [1, 0.15] }, recipe: { jewel: 2, gem: 1 }, profession: 'crafting' },
  charm: { name: 'Charm', slot: 'accessory', icon: '🧿', material: 'jewel', tags: ['jewelry', 'accessory'], implicit: { rareFind: [0.02, 0.001] }, recipe: { jewel: 1, essence: 2 }, profession: 'crafting' },

  // Gathering tools (own slots, never replace combat gear)
  axe: { name: 'Woodcutting Axe', slot: 'tool_axe', icon: '🪓', material: 'tool', tags: ['tool'], profession_tool: 'woodcutting', implicit: { woodcuttingSpeed: [0.05, 0.006] }, recipe: { metal: 2, wood: 2 }, profession: 'blacksmithing' },
  pickaxe: { name: 'Pickaxe', slot: 'tool_pickaxe', icon: '⛏️', material: 'tool', tags: ['tool'], profession_tool: 'mining', implicit: { miningSpeed: [0.05, 0.006] }, recipe: { metal: 3, wood: 1 }, profession: 'blacksmithing' },
  sickle: { name: 'Sickle', slot: 'tool_sickle', icon: '🌙', material: 'tool', tags: ['tool'], profession_tool: 'herbalism', implicit: { herbalismSpeed: [0.05, 0.006] }, recipe: { metal: 2, wood: 1 }, profession: 'blacksmithing' },
  hunting_bow: { name: 'Hunting Bow', slot: 'tool_bow', icon: '🏹', material: 'tool', tags: ['tool'], profession_tool: 'hunting', implicit: { huntingSpeed: [0.05, 0.006] }, recipe: { wood: 3, leather: 1 }, profession: 'crafting' },
  fishing_rod: { name: 'Fishing Rod', slot: 'tool_rod', icon: '🎣', material: 'tool', tags: ['tool'], profession_tool: 'fishing', implicit: { fishingSpeed: [0.05, 0.006] }, recipe: { wood: 3, cloth: 1 }, profession: 'crafting' },
};

// Consumables. `effect` is interpreted by server/game/consumables.js and the combat engine.
export const CONSUMABLES = {
  minor_healing_potion: { name: 'Minor Healing Potion', icon: '🧪', value: 8, effect: { type: 'combat_heal', pct: 0.25 }, description: 'Auto-used in PvE fights below 35% HP. Heals 25%.' },
  healing_potion: { name: 'Healing Potion', icon: '🧪', value: 25, effect: { type: 'combat_heal', pct: 0.4 }, description: 'Auto-used in PvE fights below 35% HP. Heals 40%.' },
  greater_healing_potion: { name: 'Greater Healing Potion', icon: '⚗️', value: 70, effect: { type: 'combat_heal', pct: 0.6 }, description: 'Auto-used in PvE fights below 35% HP. Heals 60%.' },
  stamina_tonic: { name: 'Stamina Tonic', icon: '🥤', value: 20, effect: { type: 'stamina', amount: 40 }, description: 'Restores 40 stamina.' },
  elixir_gathering: { name: 'Elixir of the Gatherer', icon: '🍵', value: 40, effect: { type: 'buff', stats: { gatherSpeed: 0.2, gatherYield: 0.1 }, minutes: 60 }, description: '+20% gathering speed, +10% yield for 60 min.' },
  elixir_might: { name: 'Elixir of Might', icon: '🍷', value: 50, effect: { type: 'buff', stats: { physDmgPct: 0.12, magicDmgPct: 0.12 }, minutes: 60 }, description: '+12% physical and magic damage for 60 min (PvE only).' },
  elixir_fortune: { name: 'Elixir of Fortune', icon: '🍀', value: 80, effect: { type: 'buff', stats: { rareFind: 0.25, lootFind: 0.2 }, minutes: 60 }, description: '+25% rare discovery, +20% loot discovery for 60 min.' },
  travelers_draught: { name: "Traveler's Draught", icon: '🧉', value: 30, effect: { type: 'buff', stats: { travelSpeed: 0.3 }, minutes: 60 }, description: '+30% travel speed for 60 min.' },
};

// Equipment sets (Phase 5 foundation). Bonuses apply when N pieces are equipped.
export const SETS = {
  gladiator: {
    name: "Gladiator's Regalia",
    bonuses: [
      { pieces: 2, stats: { critChance: 0.03, healthPct: 0.05 } },
      { pieces: 4, stats: { physDmgPct: 0.08, magicDmgPct: 0.08, armorPct: 0.10 } },
    ],
  },
  dragonforged: {
    name: 'Dragonforged Arms',
    bonuses: [
      { pieces: 2, stats: { lifeSteal: 0.04, critDmg: 0.25 } },
      { pieces: 3, stats: { physDmgPct: 0.10, magicDmgPct: 0.10, healthPct: 0.10 } },
    ],
  },
};

// Unique items with fixed special affixes (legendary recipes, arena shop).
// `base` is a BASE_TYPES key; `rarity` is fixed; `affixes` are guaranteed in addition to rolls.
export const UNIQUES = {
  gladiator_helm: { name: "Gladiator's Helm", base: 'plate_helm', rarity: 'epic', set: 'gladiator', bound: true, special: [{ stat: 'healthPct', value: 0.04 }] },
  gladiator_chest: { name: "Gladiator's Chestguard", base: 'plate_chest', rarity: 'epic', set: 'gladiator', bound: true, special: [{ stat: 'armorPct', value: 0.05 }] },
  gladiator_gloves: { name: "Gladiator's Grips", base: 'leather_gloves', rarity: 'epic', set: 'gladiator', bound: true, special: [{ stat: 'attackSpeed', value: 0.05 }] },
  gladiator_boots: { name: "Gladiator's Treads", base: 'leather_boots', rarity: 'epic', set: 'gladiator', bound: true, special: [{ stat: 'dodge', value: 0.03 }] },
  dragonfang: { name: 'Dragonfang', base: 'sword', rarity: 'legendary', set: 'dragonforged', special: [{ stat: 'lifeSteal', value: 0.05 }, { stat: 'critDmg', value: 0.3 }] },
  dragonheart_staff: { name: 'Heart of the Ashen Dragon', base: 'staff', rarity: 'legendary', set: 'dragonforged', special: [{ stat: 'magicDmgPct', value: 0.15 }, { stat: 'lifeSteal', value: 0.04 }] },
  dragonscale_aegis: { name: 'Dragonscale Aegis', base: 'shield', rarity: 'legendary', set: 'dragonforged', special: [{ stat: 'healthPct', value: 0.12 }, { stat: 'armorPct', value: 0.1 }] },
  windrunner: { name: 'Windrunner Longbow', base: 'bow', rarity: 'legendary', special: [{ stat: 'attackSpeed', value: 0.15 }, { stat: 'critChance', value: 0.06 }] },
  earthshaker: { name: 'Earthshaker Pickaxe', base: 'pickaxe', rarity: 'legendary', special: [{ stat: 'miningYield', value: 0.3 }, { stat: 'miningRare', value: 0.25 }] },
  verdant_reaver: { name: 'Verdant Reaver', base: 'axe', rarity: 'legendary', special: [{ stat: 'woodcuttingYield', value: 0.3 }, { stat: 'woodcuttingRare', value: 0.25 }] },
};
