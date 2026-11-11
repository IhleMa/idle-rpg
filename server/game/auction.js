// Player-driven Auction House. Every gold/item movement runs inside a DB transaction (the route
// wraps calls in tx()), and the listing row is claimed with a conditional UPDATE so two buyers
// can never both succeed on the same quantity.
import { q, GameError } from '../db.js';
import { BASE_TYPES, RARITIES } from '../../shared/data/items.js';
import { RESOURCES } from '../../shared/data/resources.js';
import { addStack, getItem, slotsUsed } from './inventory.js';
import { addLog, parseItem } from './characters.js';

export const AH = {
  taxRate: 0.05,
  feeRatePerDay: 0.02,
  durations: [12, 24, 48],
  maxPrice: 10_000_000,
  minLevel: 3,
};

export const maxListings = (level) => 5 + Math.floor(level / 5) * 2;

export function categoryOf(item) {
  if (item.kind === 'resource') return RESOURCES[item.base]?.category || 'material';
  if (item.kind === 'consumable') return 'consumable';
  const slot = BASE_TYPES[item.base].slot;
  if (slot === 'weapon') return 'weapon';
  if (slot === 'offhand') return 'offhand';
  if (slot.startsWith('tool_')) return 'tool';
  if (['necklace', 'ring', 'accessory'].includes(slot)) return 'jewelry';
  return 'armor';
}

function itemTypeOf(item) {
  if (item.kind !== 'equipment') return item.base;
  return BASE_TYPES[item.base].slot;
}

function statKeys(item) {
  if (item.kind !== 'equipment') return '';
  const keys = new Set([...Object.keys(item.stats || {}), ...(item.affixes || []).map((a) => a.stat)]);
  return `,${[...keys].join(',')},`;
}

export function listingFee(total, hours) {
  return Math.max(1, Math.round(total * AH.feeRatePerDay * (hours / 24)));
}

/** Return items from expired listings to their sellers. Safe to call often. */
export function expireListings(now = Date.now()) {
  const rows = q("SELECT * FROM listings WHERE status = 'active' AND expires_at <= ?").all(now);
  for (const l of rows) returnListingItem(l, 'expired');
  return rows.length;
}

function returnListingItem(l, status) {
  const item = parseItem(q('SELECT * FROM items WHERE id = ?').get(l.item_id));
  q('UPDATE listings SET status = ? WHERE id = ?').run(status, l.id);
  if (!item) return;
  const owner = { id: l.seller_id, inv_size: 1e9 };
  if (item.kind === 'equipment') {
    const used = new Set(q("SELECT position FROM items WHERE char_id = ? AND location = 'inventory'").all(l.seller_id).map((r) => r.position));
    let p = 0; while (used.has(p)) p++;
    q("UPDATE items SET location = 'inventory', position = ? WHERE id = ?").run(p, item.id);
  } else {
    q('DELETE FROM items WHERE id = ?').run(item.id);
    addStack(owner, item.kind, item.base, item.quantity, { force: true });
  }
  addLog(l.seller_id, 'market', `Listing ${status}: ${l.name}${l.quantity > 1 ? ' x' + l.quantity : ''} returned to your inventory.`);
}

function claimRequestId(userId, requestId) {
  if (!requestId) return;
  if (!/^[A-Za-z0-9_-]{8,64}$/.test(requestId)) throw new GameError('Invalid request id.');
  try {
    q('INSERT INTO request_ids (user_id, request_id, created_at) VALUES (?, ?, ?)').run(userId, requestId, Date.now());
  } catch {
    throw new GameError('This request was already processed.', 409);
  }
}

export function createListing(c, userId, { itemId, quantity, unitPrice, hours, requestId }) {
  claimRequestId(userId, requestId);
  if (c.level < AH.minLevel) throw new GameError(`The Auction House opens at level ${AH.minLevel}.`);
  const item = getItem(c.id, itemId);
  if (item.location === 'equipped') throw new GameError('Unequip the item before selling it.');
  if (item.location !== 'inventory') throw new GameError('That item is not in your inventory.');
  if (item.bound) throw new GameError('Bound items cannot be traded.');
  quantity = item.kind === 'equipment' ? 1 : Math.floor(Number(quantity));
  if (!(quantity >= 1 && quantity <= item.quantity)) throw new GameError('Invalid quantity.');
  unitPrice = Math.floor(Number(unitPrice));
  if (!(unitPrice >= 1 && unitPrice <= AH.maxPrice)) throw new GameError(`Price must be between 1 and ${AH.maxPrice.toLocaleString()}.`);
  hours = Number(hours);
  if (!AH.durations.includes(hours)) throw new GameError('Invalid listing duration.');
  const active = q("SELECT COUNT(*) AS n FROM listings WHERE seller_id = ? AND status = 'active'").get(c.id).n;
  if (active >= maxListings(c.level)) throw new GameError(`Listing limit reached (${maxListings(c.level)} at your level).`);
  const fee = listingFee(unitPrice * quantity, hours);
  if (c.gold < fee) throw new GameError(`Not enough gold for the listing fee (${fee}).`);

  let listedId = item.id;
  if (quantity < item.quantity) {
    q('UPDATE items SET quantity = quantity - ? WHERE id = ?').run(quantity, item.id);
    const info = q(`INSERT INTO items (char_id, kind, base, name, rarity, quantity, location, position, created_at)
      VALUES (?, ?, ?, ?, ?, ?, 'listed', 0, ?)`).run(c.id, item.kind, item.base, item.name, item.rarity, quantity, Date.now());
    listedId = Number(info.lastInsertRowid);
  } else {
    q("UPDATE items SET location = 'listed' WHERE id = ? AND location = 'inventory'").run(item.id);
  }
  c.gold -= fee;
  const now = Date.now();
  const info = q(`INSERT INTO listings (seller_id, item_id, market_key, category, item_type, rarity, ilvl, req_level, name, stat_keys, unit_price, quantity, original_qty, fee, created_at, expires_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(c.id, listedId, item.base, categoryOf(item), itemTypeOf(item), item.rarity, item.ilvl, item.req_level, item.name, statKeys(item),
      unitPrice, quantity, quantity, fee, now, now + hours * 3600000);
  addLog(c.id, 'market', `Listed ${item.name}${quantity > 1 ? ' x' + quantity : ''} for ${unitPrice.toLocaleString()} gold${quantity > 1 ? ' each' : ''} (fee ${fee}).`);
  return Number(info.lastInsertRowid);
}

export function cancelListing(c, listingId) {
  const l = q("SELECT * FROM listings WHERE id = ? AND seller_id = ? AND status = 'active'").get(Number(listingId), c.id);
  if (!l) throw new GameError('Listing not found or no longer active.');
  returnListingItem(l, 'cancelled');
}

export function buyListing(c, userId, { listingId, quantity, requestId }) {
  claimRequestId(userId, requestId);
  const now = Date.now();
  const l = q("SELECT * FROM listings WHERE id = ? AND status = 'active'").get(Number(listingId));
  if (!l || l.expires_at <= now) throw new GameError('This listing is no longer available.', 409);
  if (l.seller_id === c.id) throw new GameError('You cannot buy your own listing.');
  if (c.level < AH.minLevel) throw new GameError(`The Auction House opens at level ${AH.minLevel}.`);
  const item = parseItem(q('SELECT * FROM items WHERE id = ?').get(l.item_id));
  quantity = item.kind === 'equipment' ? 1 : Math.floor(Number(quantity) || l.quantity);
  if (!(quantity >= 1 && quantity <= l.quantity)) throw new GameError('Invalid quantity.');
  const total = l.unit_price * quantity;
  if (c.gold < total) throw new GameError('Not enough gold.');
  const hasStack = item.kind !== 'equipment' && q("SELECT 1 FROM items WHERE char_id = ? AND location = 'inventory' AND base = ? AND kind = ?").get(c.id, item.base, item.kind);
  if (!hasStack && slotsUsed(c.id) >= c.inv_size) throw new GameError('Your inventory is full.');

  // Atomically claim the quantity. If another purchase got there first, changes === 0.
  const claim = q(`UPDATE listings SET quantity = quantity - ?, status = CASE WHEN quantity - ? = 0 THEN 'sold' ELSE status END
    WHERE id = ? AND status = 'active' AND quantity >= ?`).run(quantity, quantity, l.id, quantity);
  if (Number(claim.changes) !== 1) throw new GameError('This listing was just bought by someone else.', 409);

  // Transfer the item
  if (item.kind === 'equipment') {
    const used = new Set(q("SELECT position FROM items WHERE char_id = ? AND location = 'inventory'").all(c.id).map((r) => r.position));
    let p = 0; while (used.has(p)) p++;
    q("UPDATE items SET char_id = ?, location = 'inventory', position = ? WHERE id = ? AND location = 'listed'").run(c.id, p, item.id);
  } else {
    if (quantity === item.quantity) q('DELETE FROM items WHERE id = ?').run(item.id);
    else q('UPDATE items SET quantity = quantity - ? WHERE id = ?').run(quantity, item.id);
    addStack(c, item.kind, item.base, quantity, { force: true });
  }

  // Gold: buyer pays now; seller receives proceeds minus tax as a collectable payout.
  const tax = Math.max(1, Math.round(total * AH.taxRate));
  c.gold -= total;
  const txInfo = q(`INSERT INTO transactions (listing_id, buyer_id, seller_id, market_key, item_name, rarity, quantity, unit_price, total, tax, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(l.id, c.id, l.seller_id, l.market_key, l.name, l.rarity, quantity, l.unit_price, total, tax, now);
  if (total - tax > 0) {
    q('INSERT INTO payouts (char_id, amount, source, ref_id, created_at) VALUES (?, ?, ?, ?, ?)').run(l.seller_id, total - tax, 'auction', Number(txInfo.lastInsertRowid), now);
  }
  addLog(c.id, 'market', `Bought ${l.name}${quantity > 1 ? ' x' + quantity : ''} for ${total.toLocaleString()} gold.`);
  addLog(l.seller_id, 'market', `Sold ${l.name}${quantity > 1 ? ' x' + quantity : ''} for ${total.toLocaleString()} gold (${tax} tax). Collect your gold at the Auction House.`);
  return { total, tax, quantity };
}

export function collectPayouts(c) {
  const sum = q('SELECT COALESCE(SUM(amount), 0) AS n FROM payouts WHERE char_id = ? AND collected = 0').get(c.id).n;
  if (!sum) throw new GameError('Nothing to collect.');
  q('UPDATE payouts SET collected = 1 WHERE char_id = ? AND collected = 0').run(c.id);
  c.gold += sum;
  return sum;
}

export function pendingPayout(charId) {
  return q('SELECT COALESCE(SUM(amount), 0) AS n FROM payouts WHERE char_id = ? AND collected = 0').get(charId).n;
}

const SORTS = {
  price_asc: 'l.unit_price ASC',
  price_desc: 'l.unit_price DESC',
  ilvl_desc: 'l.ilvl DESC, l.unit_price ASC',
  ilvl_asc: 'l.ilvl ASC, l.unit_price ASC',
  rarity_desc: `CASE l.rarity ${RARITIES.map((r, i) => `WHEN '${r}' THEN ${i}`).join(' ')} END DESC, l.unit_price ASC`,
  newest: 'l.created_at DESC',
  ending: 'l.expires_at ASC',
};

export function browse(filters = {}) {
  const where = ["l.status = 'active'", 'l.expires_at > ?'];
  const args = [Date.now()];
  if (filters.search) { where.push('l.name LIKE ?'); args.push(`%${String(filters.search).slice(0, 40)}%`); }
  if (filters.category) { where.push('l.category = ?'); args.push(String(filters.category)); }
  if (filters.itemType) { where.push('l.item_type = ?'); args.push(String(filters.itemType)); }
  if (filters.rarity) { where.push('l.rarity = ?'); args.push(String(filters.rarity)); }
  if (filters.minRarity && RARITIES.includes(filters.minRarity)) {
    where.push(`l.rarity IN (${RARITIES.slice(RARITIES.indexOf(filters.minRarity)).map(() => '?').join(',')})`);
    args.push(...RARITIES.slice(RARITIES.indexOf(filters.minRarity)));
  }
  if (filters.minLevel) { where.push('l.req_level >= ?'); args.push(Number(filters.minLevel)); }
  if (filters.maxLevel) { where.push('l.req_level <= ?'); args.push(Number(filters.maxLevel)); }
  if (filters.stat) { where.push('l.stat_keys LIKE ?'); args.push(`%,${String(filters.stat).replace(/[^A-Za-z]/g, '')},%`); }
  if (filters.marketKey) { where.push('l.market_key = ?'); args.push(String(filters.marketKey)); }
  const order = SORTS[filters.sort] || SORTS.price_asc;
  const page = Math.max(0, Math.floor(Number(filters.page) || 0));
  const rows = q(`SELECT l.*, c.name AS seller_name, i.stats, i.affixes, i.kind, i.base, i.set_id, i.unique_id, i.bound, i.tier, i.crafted_by
    FROM listings l JOIN characters c ON c.id = l.seller_id JOIN items i ON i.id = l.item_id
    WHERE ${where.join(' AND ')} ORDER BY ${order} LIMIT 51 OFFSET ?`).all(...args, page * 50);
  return {
    hasMore: rows.length > 50,
    listings: rows.slice(0, 50).map((r) => ({
      id: r.id, seller: r.seller_name, sellerId: r.seller_id, name: r.name, rarity: r.rarity, ilvl: r.ilvl, req_level: r.req_level,
      category: r.category, itemType: r.item_type, unitPrice: r.unit_price, quantity: r.quantity, expiresAt: r.expires_at, createdAt: r.created_at,
      marketKey: r.market_key,
      item: { kind: r.kind, base: r.base, name: r.name, rarity: r.rarity, ilvl: r.ilvl, req_level: r.req_level, tier: r.tier, stats: JSON.parse(r.stats), affixes: JSON.parse(r.affixes), set_id: r.set_id, unique_id: r.unique_id, quantity: r.quantity, crafted_by: r.crafted_by },
    })),
  };
}

export function marketStats(marketKey) {
  const now = Date.now();
  const day = 86400000;
  const lowest = q("SELECT MIN(unit_price) AS p, COALESCE(SUM(quantity),0) AS qty, COUNT(*) AS n FROM listings WHERE market_key = ? AND status = 'active' AND expires_at > ?").get(marketKey, now);
  const avg7 = q('SELECT SUM(total) * 1.0 / NULLIF(SUM(quantity), 0) AS avg, SUM(quantity) AS vol FROM transactions WHERE market_key = ? AND created_at > ?').get(marketKey, now - 7 * day);
  const recent = q('SELECT item_name, rarity, quantity, unit_price, created_at FROM transactions WHERE market_key = ? ORDER BY id DESC LIMIT 10').all(marketKey);
  const trend = q(`SELECT CAST((created_at - ?) / ${day} AS INTEGER) AS d, SUM(total) * 1.0 / SUM(quantity) AS avg, SUM(quantity) AS vol
    FROM transactions WHERE market_key = ? AND created_at > ? GROUP BY d ORDER BY d`).all(now - 14 * day, marketKey, now - 14 * day);
  return {
    marketKey,
    lowestPrice: lowest.p, activeQuantity: lowest.qty, activeListings: lowest.n,
    avgPrice7d: avg7.avg ? Math.round(avg7.avg * 10) / 10 : null, volume7d: avg7.vol || 0,
    recentSales: recent,
    trend: trend.map((t) => ({ daysAgo: 13 - t.d, avg: Math.round(t.avg * 10) / 10, volume: t.vol })),
  };
}

export function myListings(charId) {
  return q(`SELECT l.*, i.stats, i.affixes, i.kind, i.base FROM listings l JOIN items i ON i.id = l.item_id
    WHERE l.seller_id = ? AND l.status = 'active' ORDER BY l.created_at DESC`).all(charId).map((r) => ({
    id: r.id, name: r.name, rarity: r.rarity, unitPrice: r.unit_price, quantity: r.quantity, originalQty: r.original_qty,
    expiresAt: r.expires_at, createdAt: r.created_at, fee: r.fee,
    item: { kind: r.kind, base: r.base, name: r.name, rarity: r.rarity, ilvl: r.ilvl, req_level: r.req_level, stats: JSON.parse(r.stats), affixes: JSON.parse(r.affixes), quantity: r.quantity },
  }));
}

export function history(charId) {
  return q(`SELECT t.*, b.name AS buyer_name, s.name AS seller_name FROM transactions t
    JOIN characters b ON b.id = t.buyer_id JOIN characters s ON s.id = t.seller_id
    WHERE t.buyer_id = ? OR t.seller_id = ? ORDER BY t.id DESC LIMIT 100`).all(charId, charId).map((t) => ({
    id: t.id, side: t.buyer_id === charId ? 'bought' : 'sold', itemName: t.item_name, rarity: t.rarity, quantity: t.quantity,
    unitPrice: t.unit_price, total: t.total, tax: t.tax, counterparty: t.buyer_id === charId ? t.seller_name : t.buyer_name, createdAt: t.created_at,
  }));
}
