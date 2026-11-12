// Random prefixes and suffixes. An affix can roll on an item if the item has ANY of its `tags`
// (item tags come from BASE_TYPES plus its slot) and the item level is >= minIlvl.
// `{prof}` in a stat is replaced by the tool's profession (e.g. miningSpeed on a pickaxe).
// Values: roll in [min, max], then scale by item level (flat: x(1 + ilvl*0.12), pct: x(1 + ilvl*0.025))
// and by rarity multiplier.

const P = (id, name, stat, tags, min, max, opts = {}) => ({ id, name, kind: 'prefix', stat, tags, min, max, minIlvl: 1, weight: 10, ...opts });
const S = (id, name, stat, tags, min, max, opts = {}) => ({ id, name, kind: 'suffix', stat, tags, min, max, minIlvl: 1, weight: 10, ...opts });

export const AFFIXES = [
  // Prefixes - attributes
  P('powerful', 'Powerful', 'str', ['weapon', 'armor', 'jewelry', 'offhand'], 1, 3),
  P('swift', 'Swift', 'dex', ['weapon', 'armor', 'jewelry', 'offhand'], 1, 3),
  P('arcane', 'Arcane', 'int', ['weapon', 'armor', 'jewelry', 'offhand'], 1, 3),
  P('sturdy', 'Sturdy', 'con', ['armor', 'jewelry', 'offhand'], 1, 3),
  P('fortunate', 'Fortunate', 'lck', ['jewelry', 'armor', 'tool'], 1, 3),
  // Prefixes - combat
  P('brutal', 'Brutal', 'physDmg', ['weapon', 'gloves', 'jewelry'], 1, 3),
  P('mystic', 'Mystic', 'magicDmg', ['weapon', 'caster', 'jewelry'], 1, 3),
  P('reinforced', 'Reinforced', 'armor', ['armor', 'offhand'], 2, 4),
  P('vigorous', 'Vigorous', 'health', ['armor', 'jewelry', 'offhand'], 4, 9),
  P('keen', 'Keen', 'critChance', ['weapon', 'gloves', 'jewelry'], 0.01, 0.025, { pct: true }),
  P('quick', 'Quick', 'attackSpeed', ['weapon', 'gloves'], 0.02, 0.05, { pct: true }),
  P('fleet', 'Fleet', 'travelSpeed', ['boots'], 0.03, 0.07, { pct: true }),
  P('vampiric', 'Vampiric', 'lifeSteal', ['weapon'], 0.01, 0.025, { pct: true, minIlvl: 15, weight: 4 }),
  // Prefixes - gathering & crafting
  P('efficient', 'Efficient', 'gatherSpeed', ['gloves', 'accessory', 'tool'], 0.02, 0.05, { pct: true }),
  P('honed', 'Honed', '{prof}Speed', ['tool'], 0.04, 0.09, { pct: true, weight: 16 }),
  P('bountiful', 'Bountiful', '{prof}Yield', ['tool'], 0.03, 0.08, { pct: true, weight: 14 }),
  P('masterwork', 'Masterwork', 'craftEff', ['gloves', 'accessory', 'necklace'], 0.02, 0.05, { pct: true }),

  // Suffixes
  S('of_the_forest', 'of the Forest', 'woodcuttingYield', ['gloves', 'accessory', 'helmet'], 0.03, 0.07, { pct: true }),
  S('of_the_miner', 'of the Miner', 'miningSpeed', ['gloves', 'helmet', 'accessory'], 0.03, 0.07, { pct: true }),
  S('of_the_herbalist', 'of the Herbalist', 'herbalismYield', ['gloves', 'accessory', 'chest'], 0.03, 0.07, { pct: true }),
  S('of_the_hunter', 'of the Hunter', 'huntingYield', ['ranged', 'accessory', 'gloves'], 0.03, 0.07, { pct: true }),
  S('of_the_angler', 'of the Angler', 'fishingYield', ['accessory', 'pants'], 0.03, 0.07, { pct: true }),
  S('of_the_prospector', 'of the Prospector', 'miningRare', ['helmet', 'accessory'], 0.04, 0.09, { pct: true }),
  S('of_discovery', 'of Discovery', '{prof}Rare', ['tool'], 0.04, 0.10, { pct: true, weight: 12 }),
  S('of_fortune', 'of Fortune', 'rareFind', ['jewelry', 'accessory', 'tool'], 0.03, 0.07, { pct: true }),
  S('of_destruction', 'of Destruction', 'critDmg', ['weapon', 'jewelry'], 0.06, 0.14, { pct: true }),
  S('of_the_bear', 'of the Bear', 'con', ['armor', 'jewelry'], 1, 3),
  S('of_the_titan', 'of the Titan', 'str', ['weapon', 'armor'], 1, 3),
  S('of_the_fox', 'of the Fox', 'dex', ['weapon', 'armor'], 1, 3),
  S('of_the_sage', 'of the Sage', 'int', ['weapon', 'armor'], 1, 3),
  S('of_the_wanderer', 'of the Wanderer', 'travelSpeed', ['boots', 'pants', 'accessory'], 0.03, 0.06, { pct: true }),
  S('of_wisdom', 'of Wisdom', 'xpGain', ['helmet', 'jewelry'], 0.02, 0.05, { pct: true }),
  S('of_greed', 'of Greed', 'goldFind', ['jewelry', 'gloves'], 0.03, 0.08, { pct: true }),
  S('of_plunder', 'of Plunder', 'lootFind', ['jewelry', 'helmet'], 0.03, 0.08, { pct: true }),
  S('of_evasion', 'of Evasion', 'dodge', ['boots', 'pants', 'chest', 'offhand'], 0.01, 0.025, { pct: true }),
  S('of_the_artisan', 'of the Artisan', 'craftQuality', ['gloves', 'necklace'], 0.02, 0.05, { pct: true, minIlvl: 10 }),
  S('of_the_colossus', 'of the Colossus', 'healthPct', ['chest', 'offhand', 'necklace'], 0.02, 0.05, { pct: true, minIlvl: 12, weight: 6 }),
];
