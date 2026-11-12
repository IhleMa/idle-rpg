// Professions level independently of the character. Perks unlock at profession levels and
// add stats (applied everywhere via shared/rules.js computeStats).
export const PROFESSION_MAX_LEVEL = 60;

export const PROFESSIONS = {
  woodcutting: {
    name: 'Woodcutting', icon: '🪓', kind: 'gathering', tool: 'tool_axe',
    description: 'Fell trees for logs. Higher levels reach special trees and rare wood.',
    perks: [
      { level: 5, name: 'Clean Cuts', stats: { woodcuttingSpeed: 0.05 } },
      { level: 15, name: 'Timber Sense', stats: { woodcuttingYield: 0.10 } },
      { level: 25, name: 'Heartwood Seeker', stats: { woodcuttingRare: 0.15 } },
      { level: 40, name: 'Lumberlord', stats: { woodcuttingSpeed: 0.10, woodcuttingYield: 0.15 } },
    ],
  },
  mining: {
    name: 'Mining', icon: '⛏️', kind: 'gathering', tool: 'tool_pickaxe',
    description: 'Mine stone, ore and gems. Higher levels open rare deposits and dangerous regions.',
    perks: [
      { level: 5, name: 'Steady Swing', stats: { miningSpeed: 0.05 } },
      { level: 15, name: 'Rich Veins', stats: { miningYield: 0.10 } },
      { level: 25, name: 'Gem Eye', stats: { miningRare: 0.15 } },
      { level: 40, name: 'Deepdelver', stats: { miningSpeed: 0.10, miningYield: 0.15 } },
    ],
  },
  herbalism: {
    name: 'Herbalism', icon: '🌿', kind: 'gathering', tool: 'tool_sickle',
    description: 'Harvest herbs and plants. Higher levels reveal rare flora.',
    perks: [
      { level: 5, name: 'Gentle Hands', stats: { herbalismSpeed: 0.05 } },
      { level: 15, name: 'Full Bloom', stats: { herbalismYield: 0.10 } },
      { level: 25, name: 'Rare Flora', stats: { herbalismRare: 0.15 } },
      { level: 40, name: 'Verdant Master', stats: { herbalismSpeed: 0.10, herbalismYield: 0.15 } },
    ],
  },
  hunting: {
    name: 'Hunting', icon: '🏹', kind: 'gathering', tool: 'tool_bow',
    description: 'Track game for hides, pelts and trophies.',
    perks: [
      { level: 5, name: 'Tracker', stats: { huntingSpeed: 0.05 } },
      { level: 15, name: 'Skinner', stats: { huntingYield: 0.10 } },
      { level: 25, name: 'Trophy Hunter', stats: { huntingRare: 0.15 } },
      { level: 40, name: 'Apex Predator', stats: { huntingSpeed: 0.10, huntingYield: 0.15, critChance: 0.02 } },
    ],
  },
  fishing: {
    name: 'Fishing', icon: '🎣', kind: 'gathering', tool: 'tool_rod',
    description: 'Cast lines in rivers, swamps and seas.',
    perks: [
      { level: 5, name: 'Patient Angler', stats: { fishingSpeed: 0.05 } },
      { level: 15, name: 'Big Catch', stats: { fishingYield: 0.10 } },
      { level: 25, name: 'Pearl Diver', stats: { fishingRare: 0.15 } },
      { level: 40, name: 'Sea Whisperer', stats: { fishingSpeed: 0.10, fishingYield: 0.15 } },
    ],
  },
  blacksmithing: {
    name: 'Blacksmithing', icon: '🔨', kind: 'crafting',
    description: 'Smelt bars and forge metal weapons, plate armor, shields and tools.',
    perks: [
      { level: 10, name: 'Hot Forge', stats: { craftEff: 0.05 } },
      { level: 20, name: 'Tempered Steel', stats: { craftQuality: 0.05 } },
      { level: 35, name: 'Master Smith', stats: { craftQuality: 0.08, craftEff: 0.05 } },
    ],
  },
  crafting: {
    name: 'Crafting', icon: '🧵', kind: 'crafting',
    description: 'Woodcraft, leatherwork, tailoring and jewelry: bows, staves, leather, cloth and trinkets.',
    perks: [
      { level: 10, name: 'Nimble Fingers', stats: { craftEff: 0.05 } },
      { level: 20, name: 'Fine Stitching', stats: { craftQuality: 0.05 } },
      { level: 35, name: 'Artisan', stats: { craftQuality: 0.08, craftEff: 0.05 } },
    ],
  },
  alchemy: {
    name: 'Alchemy', icon: '⚗️', kind: 'crafting',
    description: 'Brew healing potions, stamina tonics and powerful elixirs.',
    perks: [
      { level: 10, name: 'Steady Hand', stats: { craftEff: 0.05 } },
      { level: 25, name: 'Potent Brews', stats: { craftEff: 0.08 } },
    ],
  },
};

export const GATHERING_PROFESSIONS = Object.keys(PROFESSIONS).filter((p) => PROFESSIONS[p].kind === 'gathering');
