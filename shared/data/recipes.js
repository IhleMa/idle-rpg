// Crafting recipes. Equipment recipes are generated from BASE_TYPES x TIERS so new bases or
// tiers automatically get recipes. Output kinds:
//   { resource: id, qty }    - stackable material
//   { consumable: id, qty }  - stackable consumable
//   { base: id, tier }       - random-rolled equipment (rarity influenced by crafting quality)
//   { unique: id }           - fixed legendary/unique item
import { BASE_TYPES, TIERS, TIER_MATERIALS } from './items.js';

const TIER_PROF_LEVEL = [1, 10, 20, 30, 40];

const rec = (id, name, profession, level, seconds, inputs, output, extra = {}) => ({ id, name, profession, level, seconds, inputs, output, category: extra.category || 'material', ...extra });

const STATIC = [
  // Smelting
  rec('copper_bar', 'Smelt Copper Bar', 'blacksmithing', 1, 4, { copper_ore: 2 }, { resource: 'copper_bar', qty: 1 }, { category: 'smelting' }),
  rec('iron_bar', 'Smelt Iron Bar', 'blacksmithing', 5, 5, { iron_ore: 2 }, { resource: 'iron_bar', qty: 1 }, { category: 'smelting' }),
  rec('silver_bar', 'Smelt Silver Bar', 'blacksmithing', 10, 6, { silver_ore: 2 }, { resource: 'silver_bar', qty: 1 }, { category: 'smelting' }),
  rec('steel_bar', 'Forge Steel Bar', 'blacksmithing', 15, 8, { iron_bar: 1, coal: 2 }, { resource: 'steel_bar', qty: 1 }, { category: 'smelting' }),
  rec('gold_bar', 'Smelt Gold Bar', 'blacksmithing', 18, 8, { gold_ore: 2 }, { resource: 'gold_bar', qty: 1 }, { category: 'smelting' }),
  rec('mithril_bar', 'Smelt Mithril Bar', 'blacksmithing', 26, 10, { mithril_ore: 3, coal: 1 }, { resource: 'mithril_bar', qty: 1 }, { category: 'smelting' }),
  rec('adamantite_bar', 'Smelt Adamantite Bar', 'blacksmithing', 36, 12, { adamantite_ore: 3, obsidian: 1, coal: 1 }, { resource: 'adamantite_bar', qty: 1 }, { category: 'smelting' }),

  // Leather & cloth
  rec('cured_leather', 'Cure Leather', 'crafting', 1, 4, { animal_hide: 2 }, { resource: 'cured_leather', qty: 1 }, { category: 'processing' }),
  rec('cured_leather_pelt', 'Cure Wolf Pelts', 'crafting', 5, 5, { wolf_pelt: 1 }, { resource: 'cured_leather', qty: 1 }, { category: 'processing' }),
  rec('linen_cloth', 'Weave Linen', 'crafting', 1, 4, { flax: 3 }, { resource: 'linen_cloth', qty: 1 }, { category: 'processing' }),
  rec('silk_cloth', 'Weave Silk', 'crafting', 12, 6, { spider_silk: 3 }, { resource: 'silk_cloth', qty: 1 }, { category: 'processing' }),
  rec('hardened_leather', 'Harden Leather', 'crafting', 15, 7, { cured_leather: 2, scorpion_carapace: 1 }, { resource: 'hardened_leather', qty: 1 }, { category: 'processing' }),
  rec('frost_leather', 'Tan Frost Leather', 'crafting', 26, 9, { yeti_fur: 2, hardened_leather: 1 }, { resource: 'frost_leather', qty: 1 }, { category: 'processing' }),
  rec('moonsilk', 'Weave Moonsilk', 'crafting', 26, 9, { silk_cloth: 2, moonpetal: 2 }, { resource: 'moonsilk', qty: 1 }, { category: 'processing' }),
  rec('drake_leather', 'Tan Drakeskin', 'crafting', 36, 11, { drake_scale: 2, frost_leather: 1 }, { resource: 'drake_leather', qty: 1 }, { category: 'processing' }),
  rec('emberweave', 'Weave Emberweave', 'crafting', 36, 11, { moonsilk: 2, fire_blossom: 2 }, { resource: 'emberweave', qty: 1 }, { category: 'processing' }),

  // Alchemy
  rec('minor_healing_potion', 'Minor Healing Potion', 'alchemy', 1, 5, { greenleaf: 3, mushroom: 1 }, { consumable: 'minor_healing_potion', qty: 1 }, { category: 'potion' }),
  rec('stamina_tonic', 'Stamina Tonic', 'alchemy', 3, 6, { river_trout: 2, greenleaf: 2 }, { consumable: 'stamina_tonic', qty: 1 }, { category: 'potion' }),
  rec('elixir_gathering', 'Elixir of the Gatherer', 'alchemy', 8, 8, { mushroom: 2, bloodthistle: 2 }, { consumable: 'elixir_gathering', qty: 1 }, { category: 'potion' }),
  rec('healing_potion', 'Healing Potion', 'alchemy', 12, 8, { bloodthistle: 3, nightshade: 1 }, { consumable: 'healing_potion', qty: 1 }, { category: 'potion' }),
  rec('elixir_might', 'Elixir of Might', 'alchemy', 14, 10, { troll_tusk: 1, bloodthistle: 3 }, { consumable: 'elixir_might', qty: 1 }, { category: 'potion' }),
  rec('travelers_draught', "Traveler's Draught", 'alchemy', 16, 10, { salmon: 2, desert_bloom: 2 }, { consumable: 'travelers_draught', qty: 1 }, { category: 'potion' }),
  rec('elixir_fortune', 'Elixir of Fortune', 'alchemy', 20, 12, { swamp_lotus: 1, desert_bloom: 3 }, { consumable: 'elixir_fortune', qty: 1 }, { category: 'potion' }),
  rec('greater_healing_potion', 'Greater Healing Potion', 'alchemy', 28, 12, { frost_lily: 2, moonpetal: 2 }, { consumable: 'greater_healing_potion', qty: 1 }, { category: 'potion' }),

  // Legendary recipes (endgame)
  rec('legend_verdant_reaver', 'Verdant Reaver', 'blacksmithing', 30, 120, { mithril_bar: 6, ancient_heartwood: 3, boss_trophy: 1 }, { unique: 'verdant_reaver' }, { category: 'legendary' }),
  rec('legend_earthshaker', 'Earthshaker Pickaxe', 'blacksmithing', 32, 120, { mithril_bar: 6, star_diamond: 1, golem_core: 2, boss_trophy: 1 }, { unique: 'earthshaker' }, { category: 'legendary' }),
  rec('legend_windrunner', 'Windrunner Longbow', 'crafting', 35, 150, { ironwood_log: 10, ancient_heartwood: 2, golden_antler: 2, boss_trophy: 1 }, { unique: 'windrunner' }, { category: 'legendary' }),
  rec('legend_aegis', 'Dragonscale Aegis', 'blacksmithing', 42, 180, { adamantite_bar: 8, drake_scale: 10, boss_trophy: 2 }, { unique: 'dragonscale_aegis' }, { category: 'legendary' }),
  rec('legend_dragonfang', 'Dragonfang', 'blacksmithing', 45, 240, { adamantite_bar: 10, dragon_heart: 1, champions_sigil: 3 }, { unique: 'dragonfang' }, { category: 'legendary' }),
  rec('legend_dragonheart_staff', 'Heart of the Ashen Dragon', 'crafting', 45, 240, { emberwood_log: 8, dragon_heart: 1, champions_sigil: 3 }, { unique: 'dragonheart_staff' }, { category: 'legendary' }),
];

function buildEquipmentRecipes() {
  const out = [];
  for (const [baseId, base] of Object.entries(BASE_TYPES)) {
    TIERS.forEach((tier, t) => {
      const inputs = {};
      for (const [family, qty] of Object.entries(base.recipe)) {
        const mat = TIER_MATERIALS[family]?.[t];
        if (!mat) continue;
        const scaled = Math.ceil(qty * (1 + t * 0.5));
        inputs[mat] = (inputs[mat] || 0) + (family === 'gem' || family === 'essence' ? Math.ceil(qty * (1 + t * 0.25)) : scaled);
      }
      const matName = tier[base.material] || tier.metal;
      out.push(rec(`${baseId}_t${t}`, `${matName} ${base.name}`, base.profession, TIER_PROF_LEVEL[t], 15 + t * 15, inputs,
        { base: baseId, tier: t }, { category: base.slot.startsWith('tool_') ? 'tool' : base.slot }));
    });
  }
  return out;
}

export const RECIPES = Object.fromEntries([...STATIC, ...buildEquipmentRecipes()].map((r) => [r.id, r]));
