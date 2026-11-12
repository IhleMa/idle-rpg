// Races: base attribute modifiers + passive bonuses affecting combat AND non-combat play.
export const RACES = {
  human: {
    name: 'Human',
    icon: '🧑',
    description: 'Adaptable and ambitious. Balanced attributes and faster learning in every field.',
    attributes: { str: 1, dex: 1, int: 1, con: 1, lck: 1 },
    bonuses: { xpGain: 0.10, goldFind: 0.05, craftEff: 0.03, gatherSpeed: 0.03 },
  },
  elf: {
    name: 'Elf',
    icon: '🧝',
    description: 'At home in the woods. Superior woodcutters and herbalists with nimble hands.',
    attributes: { dex: 3, int: 1, con: -1 },
    bonuses: { woodcuttingYield: 0.15, woodcuttingSpeed: 0.10, herbalismSpeed: 0.15, herbalismRare: 0.10, critChance: 0.02 },
  },
  dwarf: {
    name: 'Dwarf',
    icon: '🧔',
    description: 'Born beneath the mountains. Expert miners with a nose for rare ore and stout bodies.',
    attributes: { con: 3, str: 1, dex: -1 },
    bonuses: { miningSpeed: 0.15, miningRare: 0.15, miningYield: 0.05, armorPct: 0.05, travelSpeed: -0.05 },
  },
  orc: {
    name: 'Orc',
    icon: '👹',
    description: 'Fierce warriors. Raw strength, heavy blows and tough hides; strong hunters.',
    attributes: { str: 3, con: 1, int: -1 },
    bonuses: { physDmgPct: 0.08, healthPct: 0.08, huntingYield: 0.10 },
  },
  gnome: {
    name: 'Gnome',
    icon: '🧙',
    description: 'Tinkerers and scholars. Gifted crafters who spot what others overlook.',
    attributes: { int: 3, lck: 1, str: -1 },
    bonuses: { craftEff: 0.15, craftQuality: 0.08, rareFind: 0.08, magicDmgPct: 0.03 },
  },
};
