// Quest templates. The server generates three quest offers per character from the current area's
// enemies. At completion the character fights the quest target; winning grants full rewards.
export const QUEST_DIFFICULTIES = {
  easy: { name: 'Easy', minutes: 2, levelOffset: -1, reward: 0.8, itemChance: 0.15 },
  normal: { name: 'Normal', minutes: 5, levelOffset: 0, reward: 1.0, itemChance: 0.25 },
  hard: { name: 'Hard', minutes: 10, levelOffset: 2, reward: 1.6, itemChance: 0.4 },
  elite: { name: 'Elite', minutes: 20, levelOffset: 4, reward: 2.6, itemChance: 0.65, minLevel: 8 },
};

export const QUEST_TEMPLATES = [
  { title: 'Bounty: {enemy}', text: 'The village board offers coin for anyone who can deal with a troublesome {enemy} near {area}.' },
  { title: 'Escort the Merchant', text: 'A merchant needs safe passage through {area}. Rumour says a {enemy} stalks the road.' },
  { title: 'Lost Heirloom', text: 'A family heirloom was dropped somewhere in {area}. A {enemy} was last seen nearby.' },
  { title: 'Clear the Path', text: 'Travelers report a {enemy} blocking the trail through {area}.' },
  { title: 'Gather Intelligence', text: 'Scout {area} and report back. Expect resistance from a {enemy}.' },
  { title: 'The Hunt', text: 'A hunter seeks help tracking a dangerous {enemy} in {area}.' },
];
