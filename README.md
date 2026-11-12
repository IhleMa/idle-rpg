# Realms of Ashenvale

A persistent, browser-based multiplayer fantasy idle RPG: explore a connected world, gather and craft, fight monsters and bosses, trade on a player-driven Auction House, and climb the PvP Arena — with progress that continues while you are offline.

## Quick start

Requires **Node.js 22.5+** (uses the built-in `node:sqlite`; no native modules to compile).

```bash
npm install
npm run seed     # optional: 10 demo players so the Arena and Auction House have activity
npm start        # http://localhost:3000
npm test         # end-to-end API tests (in-memory database)
```

Demo accounts created by `npm run seed` log in as `demo_<name>` (e.g. `demo_kael`) with password `demo-password`.

Environment variables: `PORT` (default 3000), `DB_FILE` (default `data/game.db`), `COOKIE_SECURE=1` when served over HTTPS.

## Hosting on Pterodactyl

1. In the admin panel go to **Nests → Import Egg** and upload `pterodactyl/egg-realms-of-ashenvale.json` (pick or create a nest, e.g. "Games").
2. Create a server with that egg. Give it one allocation (port), about 512 MB RAM and 1 GB disk.
3. Start it. The console shows `Realms of Ashenvale running at …` when ready; players open `http://<your-node-address>:<port>` in a browser.

Egg variables: **Auto Update** pulls the latest code on every start; **Seed Demo Players** adds 10 demo players; **Secure Cookies** and **Behind Reverse Proxy** are for serving it over HTTPS through nginx/Cloudflare. **Git Username/Access Token** are only needed if the repository is private. All player data lives in `data/game.db` and survives updates and reinstalls (back that file up).

## What's in the game

| Phase | Systems |
| --- | --- |
| **1 – Core** | Character creation (5 races, 5 classes), attributes + free attribute points, levelling to 50; a 10-region world map with real routes, discovery, level-gated unlocks and timed travel; 7 gathering activities across 5 gathering professions with their own tools and tool slots; drag-and-drop inventory and 11 equipment slots + 5 tool slots; 6 rarities and ~37 random prefixes/suffixes (including rare "perfect" rolls); offline progress from timestamps (12h cap) |
| **2 – RPG** | 195 crafting recipes across Blacksmithing, Crafting and Alchemy (smelting, leather, cloth, gear in 5 material tiers, tools, potions, elixirs); auto-battle combat with class abilities, crits, dodge, shields, heals, bleeds and life steal; 31 enemies incl. elites and 9 bosses; timed quests that end in a battle; stamina; village merchant |
| **3 – Economy** | Accounts with hashed passwords and sessions; shared Auction House with search, category/slot/rarity/level/affix filters, partial stack buys, listing fees, 5% sales tax, collectable proceeds, listing limits by level, transaction history, price stats (lowest, 7-day average, recent sales, 14-day trend) |
| **4 – Competitive** | PvP Arena with Elo rating, 7 tiers (Bronze → Champion), matchmaking by rating and level, opponent inspection, 5 free fights/day + purchasable extras, anti-farming (no rating gain after 2 fights vs the same opponent per day), daily win bonus, weekly tier rewards, 14-day seasons with soft reset, season rewards and titles, token shop, match replays, leaderboards |
| **5 – Endgame (foundation)** | Endgame regions (Frostspire, Sunken Ruins, Emberdeep), 6 legendary recipes needing boss and arena materials, two equipment sets with set bonuses. Guilds, tournaments and buy/sell orders are not built yet — the schema and modules are laid out so they can be added without rewrites |

## Architecture

```
shared/            Pure, data-driven rules used by both server and client
  data/            races, classes, areas, resources, professions, items, affixes, recipes, enemies, quests, arena
  rules.js         stat computation, gathering rates, XP curves, enemy scaling
  combat.js        seeded auto-battle engine (PvE + separately balanced PvP)
  balance.js       global and PvP-specific balance knobs
server/
  db.js            SQLite schema, prepared statements, transactions
  auth.js          scrypt password hashing, hashed session tokens
  app.js           JSON API; every action = one transaction: load → tick → validate → save
  game/            characters, inventory, loot, activities (travel/gather/craft/quests + offline tick),
                   combat, shop, auction, arena
client/            Vanilla JS modules, no build step
  js/views/        hero, map, gathering, professions, crafting, quests, combat, arena, market, rankings, journal
scripts/seed.js    demo players
test/              end-to-end tests against the real HTTP API
```

**Server-authoritative.** The client only renders state and sends intents. All stats, combat, loot, gathering yields, prices and gold/item transfers are computed and validated on the server.

**Offline progress.** Activities store timestamps. On every request the server "ticks" the character forward from the stored timestamps, so travel, gathering, crafting and quests progress without any browser timer.

**Exploit protection.** Gold can never go negative (DB `CHECK`); every gold/item mutation runs in a single `BEGIN IMMEDIATE` transaction; Auction House purchases claim a listing with a conditional `UPDATE … WHERE status='active' AND quantity >= ?` so simultaneous buyers cannot both succeed (covered by a test); list/buy requests accept idempotency keys to reject replays; per-user rate limits; CSRF protection via a required header + `SameSite` cookies; bound items can't be traded; equipped items can't be listed.

**Adding content.** New areas, items, affixes, enemies, recipes, races, classes or professions are entries in `shared/data/*.js` — no UI changes needed. Equipment recipes are generated automatically for every base type × material tier.

## Balance notes

Combat balance was tuned with simulated fights across all classes and levels; the PvP class matrix currently sits roughly between 40% and 60% win rate for most matchups. Tuning knobs live in `shared/balance.js` and `shared/data/classes.js`.
