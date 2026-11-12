// Every stat in the game. `pct` stats are stored as fractions (0.05 = 5%).
// Shared by server (authoritative maths) and client (display only).

export const ATTRIBUTES = ['str', 'dex', 'int', 'con', 'lck'];

export const STATS = {
  // Core attributes
  str: { label: 'Strength', short: 'STR' },
  dex: { label: 'Dexterity', short: 'DEX' },
  int: { label: 'Intelligence', short: 'INT' },
  con: { label: 'Constitution', short: 'CON' },
  lck: { label: 'Luck', short: 'LCK' },

  // Combat
  health: { label: 'Health' },
  healthPct: { label: 'Health', pct: true },
  physDmg: { label: 'Physical Damage' },
  physDmgPct: { label: 'Physical Damage', pct: true },
  magicDmg: { label: 'Magic Damage' },
  magicDmgPct: { label: 'Magic Damage', pct: true },
  armor: { label: 'Armor' },
  armorPct: { label: 'Armor', pct: true },
  critChance: { label: 'Critical Hit Chance', pct: true },
  critDmg: { label: 'Critical Hit Damage', pct: true },
  attackSpeed: { label: 'Attack Speed', pct: true },
  dodge: { label: 'Dodge Chance', pct: true },
  lifeSteal: { label: 'Life Steal', pct: true },

  // Utility
  xpGain: { label: 'Experience Gain', pct: true },
  lootFind: { label: 'Loot Discovery', pct: true },
  goldFind: { label: 'Gold Found', pct: true },
  travelSpeed: { label: 'Travel Speed', pct: true },
  craftEff: { label: 'Crafting Efficiency', pct: true },
  craftQuality: { label: 'Crafting Quality', pct: true },

  // Gathering (global)
  gatherSpeed: { label: 'Gathering Speed', pct: true },
  gatherYield: { label: 'Resource Yield', pct: true },
  rareFind: { label: 'Rare Resource Discovery', pct: true },

  // Gathering (per profession)
  woodcuttingSpeed: { label: 'Woodcutting Speed', pct: true },
  woodcuttingYield: { label: 'Woodcutting Yield', pct: true },
  woodcuttingRare: { label: 'Rare Wood Discovery', pct: true },
  miningSpeed: { label: 'Mining Speed', pct: true },
  miningYield: { label: 'Ore Yield', pct: true },
  miningRare: { label: 'Rare Ore Discovery', pct: true },
  herbalismSpeed: { label: 'Herbalism Speed', pct: true },
  herbalismYield: { label: 'Herb Yield', pct: true },
  herbalismRare: { label: 'Rare Herb Discovery', pct: true },
  huntingSpeed: { label: 'Hunting Speed', pct: true },
  huntingYield: { label: 'Hunting Rewards', pct: true },
  huntingRare: { label: 'Rare Trophy Discovery', pct: true },
  fishingSpeed: { label: 'Fishing Speed', pct: true },
  fishingYield: { label: 'Fishing Yield', pct: true },
  fishingRare: { label: 'Rare Catch Discovery', pct: true },
};

export function formatStat(key, value) {
  const def = STATS[key] || { label: key };
  if (def.pct) {
    const v = Math.round(value * 1000) / 10;
    return `${v >= 0 ? '+' : ''}${v}% ${def.label}`;
  }
  const v = Math.round(value);
  return `${v >= 0 ? '+' : ''}${v} ${def.label}`;
}
