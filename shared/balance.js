// Global balance knobs. PvP has its own multipliers so PvE tuning never breaks the Arena.
export const BALANCE = {
  maxLevel: 50,
  attributePointsPerLevel: 3,
  staminaMax: 100,
  staminaRegenSeconds: 120, // 1 stamina per 2 minutes
  fightStaminaCost: 10,
  eliteStaminaCost: 15,
  bossStaminaCost: 25,
  offlineCapHours: 12, // gathering/crafting progress beyond this is not credited
  baseInventorySize: 40,
  maxInventorySize: 120,
  inventoryUpgradeSize: 10,
  inventoryUpgradeBaseCost: 500,
  merchantSellRate: 1.0, // multiplier on resource/item base value when selling to NPCs
  combatMaxSeconds: 90,

  pve: {
    critChanceCap: 0.6,
    dodgeCap: 0.35,
    healMult: 1,
    shieldMult: 1,
    lifeStealMult: 1,
    hpMult: 1,
    dmgMult: 1,
  },
  pvp: {
    critChanceCap: 0.4,
    dodgeCap: 0.25,
    healMult: 0.6,
    shieldMult: 0.7,
    lifeStealMult: 0.5,
    hpMult: 2.5, // longer, more tactical fights
    dmgMult: 1,
    openerMult: 0.75, // burst openers are toned down in PvP
    potions: false, // consumables are disabled in PvP
    buffs: false, // timed elixir buffs are disabled in PvP
  },
};
