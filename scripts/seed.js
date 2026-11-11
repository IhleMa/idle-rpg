// Optional: populate a fresh server with a few demo players (real accounts with real,
// server-side characters) so the Arena and Auction House have activity from day one.
// Usage: npm run seed   (password for every demo account: demo-password)
import { openDb, tx, q } from '../server/db.js';
import * as auth from '../server/auth.js';
import { createCharacter, loadChar, saveChar, grantXp } from '../server/game/characters.js';
import { giveStarterKit } from '../server/game/shop.js';
import { addEquipment, addStack, equip } from '../server/game/inventory.js';
import { generateEquipment, rollRarity } from '../server/game/loot.js';
import { createListing } from '../server/game/auction.js';
import { getProfile } from '../server/game/arena.js';
import { charXpForLevel } from '../shared/rules.js';

openDb();

const DEMO = [
  ['Brannoc', 'dwarf', 'warrior', 12], ['Sylwen', 'elf', 'ranger', 9], ['Mordak', 'orc', 'warrior', 15],
  ['Tinkerbolt', 'gnome', 'mage', 11], ['Elara', 'human', 'paladin', 14], ['Vex', 'human', 'rogue', 8],
  ['Kael', 'elf', 'mage', 18], ['Grukk', 'orc', 'rogue', 6], ['Hilda', 'dwarf', 'paladin', 20], ['Faelin', 'elf', 'rogue', 13],
];
const GEAR = {
  warrior: ['sword', 'plate_chest', 'plate_helm', 'plate_legs', 'plate_boots', 'plate_gloves', 'shield', 'amulet', 'ring'],
  paladin: ['mace', 'plate_chest', 'plate_helm', 'plate_legs', 'plate_boots', 'plate_gloves', 'shield', 'amulet', 'ring'],
  mage: ['staff', 'cloth_robe', 'cloth_hood', 'cloth_pants', 'cloth_shoes', 'cloth_gloves', 'tome', 'amulet', 'ring'],
  ranger: ['bow', 'leather_vest', 'leather_cap', 'leather_pants', 'leather_boots', 'leather_gloves', 'quiver', 'amulet', 'ring'],
  rogue: ['dagger', 'leather_vest', 'leather_cap', 'leather_pants', 'leather_boots', 'leather_gloves', 'quiver', 'amulet', 'ring'],
};
const WARES = [['iron_ore', 40, 9], ['oak_log', 80, 3], ['greenleaf', 60, 3], ['wolf_pelt', 20, 12], ['copper_bar', 25, 11], ['spider_silk', 15, 19], ['coal', 30, 7]];

let made = 0;
for (const [name, race, cls, level] of DEMO) {
  if (q('SELECT 1 FROM characters WHERE name = ?').get(name)) continue;
  tx(() => {
    const username = `demo_${name.toLowerCase()}`;
    const { userId } = auth.register(username, 'demo-password');
    const c = loadChar(createCharacter(userId, { name, race, cls }));
    giveStarterKit(c);
    let total = 0;
    for (let l = 1; l < level; l++) total += charXpForLevel(l);
    grantXp(c, total);
    for (const k of Object.keys(c.professions)) c.professions[k].level = 1 + Math.floor(Math.random() * level);
    c.gold = 500 + level * 120;
    for (const base of GEAR[cls]) {
      const id = addEquipment(c, generateEquipment({ base, ilvl: level, rarity: rollRarity(0.6, { max: 'epic' }) }), { force: true });
      equip(c, id);
    }
    // a couple of spare items and resources to sell
    const [res, qty, price] = WARES[made % WARES.length];
    addStack(c, 'resource', res, qty, { force: true });
    const spare = addEquipment(c, generateEquipment({ base: ['leather_boots', 'pickaxe', 'axe', 'ring', 'sword'][made % 5], ilvl: level, rarity: rollRarity(1.5, { min: 'uncommon', max: 'epic' }) }), { force: true });
    saveChar(c);
    const inv = q("SELECT id FROM items WHERE char_id = ? AND base = ? AND location = 'inventory'").get(c.id, res);
    createListing(c, userId, { itemId: inv.id, quantity: Math.floor(qty / 2), unitPrice: price, hours: 48 });
    createListing(c, userId, { itemId: spare, quantity: 1, unitPrice: 80 + level * 25, hours: 48 });
    const p = getProfile(c.id);
    q('UPDATE arena_profiles SET rating = ?, best_rating = ?, wins = ?, losses = ? WHERE char_id = ?')
      .run(p.rating + Math.round((Math.random() - 0.3) * 250), p.rating + 100, 3 + made, 2 + (made % 4), c.id);
    saveChar(c);
  });
  made++;
}
console.log(`Seeded ${made} demo players. (Login: demo_<name> / demo-password)`);
