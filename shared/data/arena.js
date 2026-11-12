// PvP Arena configuration: tiers, rewards, shop. Balance knobs for PvP live in shared/balance.js.
export const ARENA_TIERS = [
  { id: 'bronze', name: 'Bronze', min: 0, color: '#b87333', weeklyTokens: 10, weeklyGold: 100, seasonTokens: 20 },
  { id: 'silver', name: 'Silver', min: 1100, color: '#c0c0c0', weeklyTokens: 18, weeklyGold: 200, seasonTokens: 40 },
  { id: 'gold', name: 'Gold', min: 1250, color: '#ffd54f', weeklyTokens: 28, weeklyGold: 400, seasonTokens: 70 },
  { id: 'platinum', name: 'Platinum', min: 1400, color: '#7fe3d6', weeklyTokens: 40, weeklyGold: 700, seasonTokens: 110 },
  { id: 'diamond', name: 'Diamond', min: 1550, color: '#8ab4ff', weeklyTokens: 55, weeklyGold: 1100, seasonTokens: 160, title: 'Diamond Duelist' },
  { id: 'master', name: 'Master', min: 1700, color: '#d26cff', weeklyTokens: 75, weeklyGold: 1600, seasonTokens: 230, title: 'Arena Master' },
  { id: 'champion', name: 'Champion', min: 1850, color: '#ff5252', weeklyTokens: 100, weeklyGold: 2500, seasonTokens: 320, title: 'Champion of Ashenvale' },
];

export const ARENA_CONFIG = {
  startRating: 1000,
  kFactor: 32,
  freeFightsPerDay: 5,
  extraFightBaseCost: 50, // gold, x level, escalates per purchase that day
  maxExtraFightsPerDay: 10,
  sameOpponentDailyLimit: 2, // after this, no rating is gained vs that opponent today
  minLevelToEnter: 5,
  seasonDays: 14,
  softResetFactor: 0.5, // new = start + (old - start) * factor
  win: { tokens: 3, goldPerLevel: 6 },
  loss: { tokens: 1, goldPerLevel: 2 },
  dailyWinBonus: { wins: 3, tokens: 6, goldPerLevel: 15 }, // after N wins in a day
  levelWindow: 6, // matchmaking prefers opponents within +/- this many levels
};

export const ARENA_SHOP = [
  { id: 'gladiator_helm', name: "Gladiator's Helm", cost: 120, unique: 'gladiator_helm', minLevel: 10 },
  { id: 'gladiator_chest', name: "Gladiator's Chestguard", cost: 180, unique: 'gladiator_chest', minLevel: 10 },
  { id: 'gladiator_gloves', name: "Gladiator's Grips", cost: 100, unique: 'gladiator_gloves', minLevel: 10 },
  { id: 'gladiator_boots', name: "Gladiator's Treads", cost: 100, unique: 'gladiator_boots', minLevel: 10 },
  { id: 'champions_sigil', name: "Champion's Sigil", cost: 60, resource: 'champions_sigil', qty: 1 },
  { id: 'stamina_tonic', name: 'Stamina Tonic x3', cost: 15, consumable: 'stamina_tonic', qty: 3 },
  { id: 'arena_ticket', name: 'Extra Arena Fight', cost: 8, ticket: true },
  { id: 'title_gladiator', name: 'Title: Gladiator', cost: 150, title: 'Gladiator' },
  { id: 'title_bloodied', name: 'Title: the Bloodied', cost: 300, title: 'the Bloodied' },
];

export function tierForRating(rating) {
  let tier = ARENA_TIERS[0];
  for (const t of ARENA_TIERS) if (rating >= t.min) tier = t;
  return tier;
}
