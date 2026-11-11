// NPC merchant (village only) and the new-character starter kit.
import { GameError } from '../db.js';
import { AREAS } from '../../shared/data/areas.js';
import { CLASSES } from '../../shared/data/classes.js';
import { BALANCE } from '../../shared/balance.js';
import { inventoryUpgradeCost } from '../../shared/rules.js';
import { generateEquipment } from './loot.js';
import { addEquipment, addStack, equip } from './inventory.js';
import { addLog } from './characters.js';

export const SHOP_STOCK = [
  { id: 'axe_t0', name: 'Crude Woodcutting Axe', price: 30, equipment: { base: 'axe', ilvl: 1 } },
  { id: 'pickaxe_t0', name: 'Crude Pickaxe', price: 30, equipment: { base: 'pickaxe', ilvl: 1 } },
  { id: 'sickle_t0', name: 'Crude Sickle', price: 30, equipment: { base: 'sickle', ilvl: 1 } },
  { id: 'hunting_bow_t0', name: 'Crude Hunting Bow', price: 30, equipment: { base: 'hunting_bow', ilvl: 1 } },
  { id: 'fishing_rod_t0', name: 'Crude Fishing Rod', price: 30, equipment: { base: 'fishing_rod', ilvl: 1 } },
  { id: 'pickaxe_t1', name: 'Iron Pickaxe', price: 220, equipment: { base: 'pickaxe', ilvl: 8 }, minLevel: 5 },
  { id: 'axe_t1', name: 'Iron Woodcutting Axe', price: 220, equipment: { base: 'axe', ilvl: 8 }, minLevel: 5 },
  { id: 'sickle_t1', name: 'Iron Sickle', price: 220, equipment: { base: 'sickle', ilvl: 8 }, minLevel: 5 },
  { id: 'minor_healing_potion', name: 'Minor Healing Potion', price: 18, consumable: 'minor_healing_potion' },
  { id: 'stamina_tonic', name: 'Stamina Tonic', price: 90, consumable: 'stamina_tonic' },
];

export function buyFromShop(c, stockId, qty = 1) {
  if (!AREAS[c.location].shop || c.activity.type === 'travel') throw new GameError('The merchant is only in Greenhollow Village.');
  const s = SHOP_STOCK.find((x) => x.id === stockId);
  if (!s) throw new GameError('Unknown item.');
  if (s.minLevel && c.level < s.minLevel) throw new GameError(`Requires level ${s.minLevel}.`);
  qty = s.equipment ? 1 : Math.max(1, Math.min(50, Math.floor(Number(qty) || 1)));
  const cost = s.price * qty;
  if (c.gold < cost) throw new GameError('Not enough gold.');
  if (s.equipment) {
    if (!addEquipment(c, generateEquipment({ ...s.equipment, rarity: 'common' }))) throw new GameError('Your inventory is full.');
  } else if (addStack(c, 'consumable', s.consumable, qty) < qty) throw new GameError('Your inventory is full.');
  c.gold -= cost;
  return cost;
}

export function upgradeInventory(c) {
  if (c.inv_size >= BALANCE.maxInventorySize) throw new GameError('Your bags are already as large as they get.');
  const cost = inventoryUpgradeCost(c.inv_size);
  if (c.gold < cost) throw new GameError(`Not enough gold (${cost} needed).`);
  c.gold -= cost;
  c.inv_size += BALANCE.inventoryUpgradeSize;
  addLog(c.id, 'item', `Expanded inventory to ${c.inv_size} slots.`);
  return cost;
}

const STARTER_WEAPON = { warrior: 'sword', mage: 'staff', ranger: 'bow', rogue: 'dagger', paladin: 'mace' };
const STARTER_ARMOR = { warrior: 'plate_chest', mage: 'cloth_robe', ranger: 'leather_vest', rogue: 'leather_vest', paladin: 'plate_chest' };

export function giveStarterKit(c) {
  const items = [
    STARTER_WEAPON[c.class], STARTER_ARMOR[c.class], 'leather_boots',
    'axe', 'pickaxe', 'sickle', 'hunting_bow', 'fishing_rod',
  ];
  for (const base of items) {
    const id = addEquipment(c, generateEquipment({ base, ilvl: 1, rarity: 'common' }), { force: true });
    equip(c, id);
  }
  if (c.class === 'warrior' || c.class === 'paladin') equip(c, addEquipment(c, generateEquipment({ base: 'shield', ilvl: 1, rarity: 'common' }), { force: true }));
  addStack(c, 'consumable', 'minor_healing_potion', 5, { force: true });
  addLog(c.id, 'system', `Welcome to Ashenvale, ${c.name} the ${CLASSES[c.class].name}! Your journey begins in Greenhollow Village.`);
}
