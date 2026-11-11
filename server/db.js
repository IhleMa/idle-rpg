// SQLite persistence (Node's built-in node:sqlite). All writes that move gold or items run
// inside `tx()` (BEGIN IMMEDIATE) so they are atomic and serialised.
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';

let db;

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY,
  username TEXT NOT NULL UNIQUE COLLATE NOCASE,
  pass_hash TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS characters (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL UNIQUE COLLATE NOCASE,
  race TEXT NOT NULL,
  class TEXT NOT NULL,
  level INTEGER NOT NULL DEFAULT 1,
  xp INTEGER NOT NULL DEFAULT 0,
  attr_points INTEGER NOT NULL DEFAULT 0,
  alloc TEXT NOT NULL DEFAULT '{}',
  gold INTEGER NOT NULL DEFAULT 0 CHECK (gold >= 0),
  arena_tokens INTEGER NOT NULL DEFAULT 0 CHECK (arena_tokens >= 0),
  location TEXT NOT NULL,
  discovered TEXT NOT NULL DEFAULT '[]',
  visited TEXT NOT NULL DEFAULT '[]',
  stamina REAL NOT NULL DEFAULT 100,
  stamina_at INTEGER NOT NULL,
  activity TEXT NOT NULL DEFAULT '{"type":"idle"}',
  professions TEXT NOT NULL DEFAULT '{}',
  quest_offers TEXT NOT NULL DEFAULT '[]',
  buffs TEXT NOT NULL DEFAULT '[]',
  inv_size INTEGER NOT NULL DEFAULT 40,
  titles TEXT NOT NULL DEFAULT '[]',
  title TEXT,
  stats_cache TEXT NOT NULL DEFAULT '{}',
  bosses_defeated TEXT NOT NULL DEFAULT '[]',
  created_at INTEGER NOT NULL,
  last_seen INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS items (
  id INTEGER PRIMARY KEY,
  char_id INTEGER NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,              -- equipment | resource | consumable
  base TEXT NOT NULL,              -- BASE_TYPES key / resource id / consumable id
  name TEXT NOT NULL,
  rarity TEXT NOT NULL DEFAULT 'common',
  ilvl INTEGER NOT NULL DEFAULT 1,
  req_level INTEGER NOT NULL DEFAULT 1,
  tier INTEGER NOT NULL DEFAULT 0,
  stats TEXT NOT NULL DEFAULT '{}',
  affixes TEXT NOT NULL DEFAULT '[]',
  set_id TEXT,
  unique_id TEXT,
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
  location TEXT NOT NULL DEFAULT 'inventory', -- inventory | equipped | listed
  slot TEXT,
  position INTEGER NOT NULL DEFAULT 0,
  bound INTEGER NOT NULL DEFAULT 0,
  crafted_by TEXT,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_items_char ON items(char_id, location);
CREATE UNIQUE INDEX IF NOT EXISTS idx_items_equipped_slot ON items(char_id, slot) WHERE location = 'equipped';

CREATE TABLE IF NOT EXISTS char_log (
  id INTEGER PRIMARY KEY,
  char_id INTEGER NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  text TEXT NOT NULL,
  data TEXT,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_log_char ON char_log(char_id, id);

-- Auction House
CREATE TABLE IF NOT EXISTS listings (
  id INTEGER PRIMARY KEY,
  seller_id INTEGER NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  item_id INTEGER NOT NULL UNIQUE,
  market_key TEXT NOT NULL,
  category TEXT NOT NULL,
  item_type TEXT NOT NULL,
  rarity TEXT NOT NULL,
  ilvl INTEGER NOT NULL,
  req_level INTEGER NOT NULL,
  name TEXT NOT NULL,
  stat_keys TEXT NOT NULL DEFAULT '',  -- ",str,miningSpeed," for affix/stat filtering
  unit_price INTEGER NOT NULL CHECK (unit_price > 0),
  quantity INTEGER NOT NULL CHECK (quantity >= 0),
  original_qty INTEGER NOT NULL,
  fee INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'active', -- active | sold | expired | cancelled
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_listings_active ON listings(status, market_key, unit_price);
CREATE INDEX IF NOT EXISTS idx_listings_seller ON listings(seller_id, status);

CREATE TABLE IF NOT EXISTS transactions (
  id INTEGER PRIMARY KEY,
  listing_id INTEGER NOT NULL REFERENCES listings(id),
  buyer_id INTEGER NOT NULL REFERENCES characters(id),
  seller_id INTEGER NOT NULL REFERENCES characters(id),
  market_key TEXT NOT NULL,
  item_name TEXT NOT NULL,
  rarity TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  unit_price INTEGER NOT NULL,
  total INTEGER NOT NULL,
  tax INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_tx_key ON transactions(market_key, created_at);
CREATE INDEX IF NOT EXISTS idx_tx_buyer ON transactions(buyer_id, created_at);
CREATE INDEX IF NOT EXISTS idx_tx_seller ON transactions(seller_id, created_at);

CREATE TABLE IF NOT EXISTS payouts (
  id INTEGER PRIMARY KEY,
  char_id INTEGER NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL CHECK (amount > 0),
  source TEXT NOT NULL,
  ref_id INTEGER,
  collected INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_payouts ON payouts(char_id, collected);

-- Idempotency keys: a repeated request id for a gold/item action is rejected.
CREATE TABLE IF NOT EXISTS request_ids (
  user_id INTEGER NOT NULL,
  request_id TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, request_id)
);

-- PvP Arena
CREATE TABLE IF NOT EXISTS arena_seasons (
  id INTEGER PRIMARY KEY,
  started_at INTEGER NOT NULL,
  ends_at INTEGER NOT NULL,
  finalized INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS arena_profiles (
  char_id INTEGER PRIMARY KEY REFERENCES characters(id) ON DELETE CASCADE,
  season_id INTEGER NOT NULL,
  rating INTEGER NOT NULL,
  best_rating INTEGER NOT NULL,
  wins INTEGER NOT NULL DEFAULT 0,
  losses INTEGER NOT NULL DEFAULT 0,
  day TEXT NOT NULL DEFAULT '',
  fights_today INTEGER NOT NULL DEFAULT 0,
  wins_today INTEGER NOT NULL DEFAULT 0,
  extra_fights INTEGER NOT NULL DEFAULT 0,
  extra_bought_today INTEGER NOT NULL DEFAULT 0,
  daily_bonus_claimed TEXT NOT NULL DEFAULT '',
  weekly_claimed TEXT NOT NULL DEFAULT '',
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_arena_rating ON arena_profiles(season_id, rating DESC);
CREATE TABLE IF NOT EXISTS arena_matches (
  id INTEGER PRIMARY KEY,
  season_id INTEGER NOT NULL,
  attacker_id INTEGER NOT NULL REFERENCES characters(id),
  defender_id INTEGER NOT NULL REFERENCES characters(id),
  winner_id INTEGER NOT NULL,
  attacker_delta INTEGER NOT NULL,
  defender_delta INTEGER NOT NULL,
  attacker_rating INTEGER NOT NULL,
  defender_rating INTEGER NOT NULL,
  log TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_matches_att ON arena_matches(attacker_id, created_at);
CREATE INDEX IF NOT EXISTS idx_matches_def ON arena_matches(defender_id, created_at);
CREATE TABLE IF NOT EXISTS arena_rewards (
  id INTEGER PRIMARY KEY,
  char_id INTEGER NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  season_id INTEGER NOT NULL,
  tier TEXT NOT NULL,
  rating INTEGER NOT NULL,
  rank INTEGER,
  tokens INTEGER NOT NULL,
  gold INTEGER NOT NULL,
  title TEXT,
  claimed INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  UNIQUE (char_id, season_id)
);
`;

export function openDb(file = process.env.DB_FILE || path.resolve('data/game.db')) {
  if (file !== ':memory:') fs.mkdirSync(path.dirname(file), { recursive: true });
  db = new DatabaseSync(file);
  db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');
  db.exec(SCHEMA);
  return db;
}

export function getDb() {
  if (!db) openDb();
  return db;
}

const stmtCache = new Map();
export function q(sql) {
  const d = getDb();
  let s = stmtCache.get(sql);
  if (!s || s.__db !== d) {
    s = d.prepare(sql);
    s.__db = d;
    stmtCache.set(sql, s);
  }
  return s;
}

let depth = 0;
/** Run fn atomically. Nested calls join the outer transaction. */
export function tx(fn) {
  const d = getDb();
  if (depth > 0) return fn();
  d.exec('BEGIN IMMEDIATE');
  depth++;
  try {
    const result = fn();
    depth--;
    d.exec('COMMIT');
    return result;
  } catch (err) {
    depth--;
    try { d.exec('ROLLBACK'); } catch { /* ignore */ }
    throw err;
  }
}

export class GameError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}
