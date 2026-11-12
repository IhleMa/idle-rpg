// Stackable materials. `value` is only the NPC merchant floor price (players set real prices
// on the Auction House). `category` drives Auction House filters.
const R = (name, icon, category, value, extra = {}) => ({ name, icon, category, value, ...extra });

export const RESOURCES = {
  // Wood
  oak_log: R('Oak Log', '🪵', 'wood', 2),
  maple_log: R('Maple Log', '🪵', 'wood', 6),
  ironwood_log: R('Ironwood Log', '🪵', 'wood', 18),
  ancient_heartwood: R('Ancient Heartwood', '🌳', 'wood', 60, { rare: true }),
  emberwood_log: R('Emberwood Log', '🔥', 'wood', 40),

  // Stone, ore, bars, gems
  stone: R('Stone', '🪨', 'ore', 1),
  copper_ore: R('Copper Ore', '🟠', 'ore', 3),
  iron_ore: R('Iron Ore', '⚙️', 'ore', 6),
  coal: R('Coal', '⚫', 'ore', 5),
  silver_ore: R('Silver Ore', '⚪', 'ore', 12),
  sandstone: R('Sandstone', '🟫', 'ore', 4),
  gold_ore: R('Gold Ore', '🟡', 'ore', 25),
  mithril_ore: R('Mithril Ore', '🔷', 'ore', 35),
  obsidian: R('Obsidian', '⬛', 'ore', 30),
  adamantite_ore: R('Adamantite Ore', '🟥', 'ore', 60),
  ruby: R('Ruby', '♦️', 'gem', 80, { rare: true }),
  sapphire: R('Sapphire', '🔹', 'gem', 80, { rare: true }),
  emerald: R('Emerald', '💚', 'gem', 90, { rare: true }),
  frost_crystal: R('Frost Crystal', '❄️', 'gem', 70, { rare: true }),
  star_diamond: R('Star Diamond', '💎', 'gem', 400, { rare: true }),

  copper_bar: R('Copper Bar', '🟧', 'material', 8),
  iron_bar: R('Iron Bar', '🔩', 'material', 16),
  steel_bar: R('Steel Bar', '🔗', 'material', 35),
  silver_bar: R('Silver Bar', '🥈', 'material', 30),
  gold_bar: R('Gold Bar', '🥇', 'material', 60),
  mithril_bar: R('Mithril Bar', '💠', 'material', 85),
  adamantite_bar: R('Adamantite Bar', '🟥', 'material', 150),

  // Herbs & plants
  flax: R('Flax', '🌾', 'herb', 2),
  greenleaf: R('Greenleaf', '🌿', 'herb', 2),
  mushroom: R('Forest Mushroom', '🍄', 'herb', 3),
  bloodthistle: R('Bloodthistle', '🥀', 'herb', 9),
  nightshade: R('Nightshade', '🫐', 'herb', 14),
  swamp_lotus: R('Swamp Lotus', '🪷', 'herb', 30, { rare: true }),
  desert_bloom: R('Desert Bloom', '🌵', 'herb', 22),
  moonpetal: R('Moonpetal', '🌙', 'herb', 40),
  frost_lily: R('Frost Lily', '💮', 'herb', 38),
  fire_blossom: R('Fire Blossom', '🌺', 'herb', 55),
  phoenix_orchid: R('Phoenix Orchid', '🏵️', 'herb', 300, { rare: true }),

  // Hunting
  animal_hide: R('Animal Hide', '🟤', 'hide', 3),
  wolf_pelt: R('Wolf Pelt', '🐺', 'hide', 8),
  spider_silk: R('Spider Silk', '🕸️', 'hide', 14),
  venom_gland: R('Venom Gland', '🧪', 'hide', 20),
  scorpion_carapace: R('Scorpion Carapace', '🦂', 'hide', 24),
  yeti_fur: R('Yeti Fur', '🦣', 'hide', 40),
  drake_scale: R('Drake Scale', '🐉', 'hide', 70),
  golden_antler: R('Golden Antler', '🦌', 'hide', 120, { rare: true }),

  // Fishing
  river_trout: R('River Trout', '🐟', 'fish', 3),
  salmon: R('Silver Salmon', '🐠', 'fish', 8),
  bog_eel: R('Bog Eel', '🐍', 'fish', 14),
  deep_tuna: R('Deep Tuna', '🐟', 'fish', 20),
  ghostfin: R('Ghostfin', '👻', 'fish', 45),
  pearl: R('Pearl', '🦪', 'gem', 110, { rare: true }),

  // Scavenging
  old_coin: R('Old Coin', '🪙', 'relic', 10),
  relic_shard: R('Relic Shard', '🏺', 'relic', 30),
  ancient_tablet: R('Ancient Tablet', '📜', 'relic', 200, { rare: true }),
  driftwood: R('Driftwood', '🪵', 'wood', 3),

  // Processed materials
  cured_leather: R('Cured Leather', '🟫', 'material', 9),
  hardened_leather: R('Hardened Leather', '🛡️', 'material', 30),
  frost_leather: R('Frost Leather', '🧊', 'material', 70),
  drake_leather: R('Drakeskin', '🐲', 'material', 130),
  linen_cloth: R('Linen Cloth', '🧵', 'material', 7),
  silk_cloth: R('Silk Cloth', '🎀', 'material', 32),
  moonsilk: R('Moonsilk', '🌌', 'material', 75),
  emberweave: R('Emberweave', '🧶', 'material', 130),

  // Monster drops
  monster_essence: R('Monster Essence', '✨', 'essence', 6),
  troll_tusk: R('Troll Tusk', '🦷', 'essence', 25),
  golem_core: R('Golem Core', '🔶', 'essence', 45),
  bone_dust: R('Bone Dust', '💀', 'essence', 12),
  ectoplasm: R('Ectoplasm', '🫧', 'essence', 50),
  elemental_core: R('Elemental Core', '🔥', 'essence', 90),
  boss_trophy: R('Boss Trophy', '🏆', 'essence', 150, { rare: true }),
  dragon_heart: R('Dragon Heart', '❤️‍🔥', 'essence', 2000, { rare: true }),

  // Arena
  champions_sigil: R("Champion's Sigil", '🎖️', 'essence', 250, { rare: true }),
};
