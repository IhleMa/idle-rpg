// Inventory & equipment. Every mutation validates ownership and location server-side.
import { q, GameError } from '../db.js';
import { RESOURCES } from '../../shared/data/resources.js';
import { CONSUMABLES, BASE_TYPES, ALL_SLOTS, RARITIES } from '../../shared/data/items.js';
import { BALANCE } from '../../shared/balance.js';
import { parseItem, addLog } from './characters.js';

export const STACK_MAX = 9999;

export function stackInfo(kind, id) {
  if (kind === 'resource') return RESOURCES[id];
  if (kind === 'consumable') return CONSUMABLES[id];
  return null;
}

export function slotsUsed(charId) {
  return q("SELECT COUNT(*) AS n FROM items WHERE char_id = ? AND location = 'inventory'").get(charId).n;
}

function nextPosition(charId) {
  const used = new Set(q("SELECT position FROM items WHERE char_id = ? AND location = 'inventory'").all(charId).map((r) => r.position));
  let p = 0;
  while (used.has(p)) p++;
  return p;
}

export function getItem(charId, itemId) {
  const it = parseItem(q('SELECT * FROM items WHERE id = ? AND char_id = ?').get(Number(itemId), charId));
  if (!it) throw new GameError('Item not found.', 404);
  return it;
}

export function countStack(charId, base) {
  return q("SELECT COALESCE(SUM(quantity), 0) AS n FROM items WHERE char_id = ? AND location = 'inventory' AND base = ? AND kind != 'equipment'").get(charId, base).n;
}

/** Add a stackable resource/consumable. Returns quantity actually added (0 if no room). */
export function addStack(c, kind, id, qty, { force = false } = {}) {
  qty = Math.floor(qty);
  if (qty <= 0) return 0;
  const info = stackInfo(kind, id);
  if (!info) throw new Error(`Unknown ${kind} ${id}`);
  let remaining = qty;
  const stacks = q("SELECT id, quantity FROM items WHERE char_id = ? AND location = 'inventory' AND kind = ? AND base = ? AND quantity < ? ORDER BY quantity DESC")
    .all(c.id, kind, id, STACK_MAX);
  for (const s of stacks) {
    const add = Math.min(remaining, STACK_MAX - s.quantity);
    q('UPDATE items SET quantity = quantity + ? WHERE id = ?').run(add, s.id);
    remaining -= add;
    if (!remaining) return qty;
  }
  while (remaining > 0) {
    if (!force && slotsUsed(c.id) >= c.inv_size) break;
    const add = Math.min(remaining, STACK_MAX);
    q(`INSERT INTO items (char_id, kind, base, name, rarity, quantity, location, position, created_at)
       VALUES (?, ?, ?, ?, ?, ?, 'inventory', ?, ?)`).run(c.id, kind, id, info.name, info.rare ? 'rare' : 'common', add, nextPosition(c.id), Date.now());
    remaining -= add;
  }
  return qty - remaining;
}

/** Insert a generated equipment item into inventory. Returns new id, or null if full. */
export function addEquipment(c, item, { force = false, craftedBy = null } = {}) {
  if (!force && slotsUsed(c.id) >= c.inv_size) return null;
  const info = q(`INSERT INTO items (char_id, kind, base, name, rarity, ilvl, req_level, tier, stats, affixes, set_id, unique_id, quantity, location, position, bound, crafted_by, created_at)
     VALUES (?, 'equipment', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 'inventory', ?, ?, ?, ?)`)
    .run(c.id, item.base, item.name, item.rarity, item.ilvl, item.req_level, item.tier, JSON.stringify(item.stats), JSON.stringify(item.affixes),
      item.set_id || null, item.unique_id || null, nextPosition(c.id), item.bound ? 1 : 0, craftedBy, Date.now());
  return Number(info.lastInsertRowid);
}

/** Remove quantity of a stackable from inventory; throws if not enough. */
export function removeStack(charId, base, qty) {
  qty = Math.floor(qty);
  if (countStack(charId, base) < qty) throw new GameError(`Not enough ${RESOURCES[base]?.name || CONSUMABLES[base]?.name || base}.`);
  let remaining = qty;
  const stacks = q("SELECT id, quantity FROM items WHERE char_id = ? AND location = 'inventory' AND base = ? AND kind != 'equipment' ORDER BY quantity ASC").all(charId, base);
  for (const s of stacks) {
    if (!remaining) break;
    const take = Math.min(remaining, s.quantity);
    if (take === s.quantity) q('DELETE FROM items WHERE id = ?').run(s.id);
    else q('UPDATE items SET quantity = quantity - ? WHERE id = ?').run(take, s.id);
    remaining -= take;
  }
}

function slotAccepts(slot, base) {
  const bt = BASE_TYPES[base];
  if (!bt) return false;
  if (bt.slot === 'ring') return slot === 'ring1' || slot === 'ring2';
  return bt.slot === slot;
}

export function equip(c, itemId, slot) {
  const item = getItem(c.id, itemId);
  if (item.location !== 'inventory') throw new GameError('That item is not in your inventory.');
  if (item.kind !== 'equipment') throw new GameError('That item cannot be equipped.');
  const bt = BASE_TYPES[item.base];
  if (!slot) {
    slot = bt.slot === 'ring'
      ? (q("SELECT 1 FROM items WHERE char_id = ? AND location = 'equipped' AND slot = 'ring1'").get(c.id) ? 'ring2' : 'ring1')
      : bt.slot;
  }
  if (!ALL_SLOTS.includes(slot) || !slotAccepts(slot, item.base)) throw new GameError(`${item.name} cannot go in that slot.`);
  if (item.req_level > c.level) throw new GameError(`Requires character level ${item.req_level}.`);
  if (c.activity?.type === 'gather' && slot.startsWith('tool_')) {
    // allowed: tool changes apply to future gathering cycles
  }
  const current = q("SELECT id FROM items WHERE char_id = ? AND location = 'equipped' AND slot = ?").get(c.id, slot);
  if (current) q("UPDATE items SET location = 'inventory', slot = NULL, position = ? WHERE id = ?").run(item.position, current.id);
  q("UPDATE items SET location = 'equipped', slot = ? WHERE id = ?").run(slot, item.id);
  return slot;
}

export function unequip(c, slot, position) {
  const current = q("SELECT id FROM items WHERE char_id = ? AND location = 'equipped' AND slot = ?").get(c.id, slot);
  if (!current) throw new GameError('Nothing equipped there.');
  if (slotsUsed(c.id) >= c.inv_size) throw new GameError('Your inventory is full.');
  let pos = Number.isInteger(position) ? position : nextPosition(c.id);
  if (pos < 0 || pos >= c.inv_size || q("SELECT 1 FROM items WHERE char_id = ? AND location = 'inventory' AND position = ?").get(c.id, pos)) pos = nextPosition(c.id);
  q("UPDATE items SET location = 'inventory', slot = NULL, position = ? WHERE id = ?").run(pos, current.id);
}

export function moveItem(c, itemId, position) {
  position = Math.floor(Number(position));
  if (!(position >= 0 && position < c.inv_size)) throw new GameError('Invalid position.');
  const item = getItem(c.id, itemId);
  if (item.location !== 'inventory') throw new GameError('Item is not in your inventory.');
  const other = q("SELECT id FROM items WHERE char_id = ? AND location = 'inventory' AND position = ? AND id != ?").get(c.id, position, item.id);
  if (other) q('UPDATE items SET position = ? WHERE id = ?').run(item.position, other.id);
  q('UPDATE items SET position = ? WHERE id = ?').run(position, item.id);
}

export function itemValue(item) {
  if (item.kind === 'equipment') return Math.round((4 + item.ilvl * 3) * (1 + RARITIES.indexOf(item.rarity) * 0.9));
  return stackInfo(item.kind, item.base)?.value || 1;
}

export function sellToMerchant(c, itemId, qty) {
  const item = getItem(c.id, itemId);
  if (item.location !== 'inventory') throw new GameError('You can only sell items from your inventory.');
  qty = item.kind === 'equipment' ? 1 : Math.max(1, Math.min(item.quantity, Math.floor(Number(qty) || item.quantity)));
  const gold = Math.max(1, Math.floor(itemValue(item) * BALANCE.merchantSellRate * 0.5)) * qty;
  if (qty >= item.quantity) q('DELETE FROM items WHERE id = ?').run(item.id);
  else q('UPDATE items SET quantity = quantity - ? WHERE id = ?').run(qty, item.id);
  c.gold += gold;
  return gold;
}

export function useConsumable(c, itemId) {
  const item = getItem(c.id, itemId);
  if (item.kind !== 'consumable' || item.location !== 'inventory') throw new GameError('That cannot be used.');
  const def = CONSUMABLES[item.base];
  const eff = def.effect;
  if (eff.type === 'combat_heal') throw new GameError('Healing potions are used automatically in PvE combat.');
  if (eff.type === 'stamina') {
    if (c.stamina >= BALANCE.staminaMax) throw new GameError('Your stamina is already full.');
    c.stamina = Math.min(BALANCE.staminaMax, c.stamina + eff.amount);
  } else if (eff.type === 'buff') {
    const now = Date.now();
    c.buffs = c.buffs.filter((b) => b.until > now && b.id !== item.base);
    c.buffs.push({ id: item.base, name: def.name, stats: eff.stats, until: now + eff.minutes * 60000 });
  }
  removeStack(c.id, item.base, 1);
  addLog(c.id, 'item', `Used ${def.name}.`);
  return def.name;
}

export function potionsForCombat(charId) {
  return q("SELECT base, SUM(quantity) AS qty FROM items WHERE char_id = ? AND location = 'inventory' AND kind = 'consumable' GROUP BY base").all(charId)
    .filter((r) => CONSUMABLES[r.base]?.effect.type === 'combat_heal')
    .map((r) => ({ id: r.base, name: CONSUMABLES[r.base].name, pct: CONSUMABLES[r.base].effect.pct, qty: r.qty }));
}
