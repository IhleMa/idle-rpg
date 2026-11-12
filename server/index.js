import { openDb } from './db.js';
import { createApp } from './app.js';

const db = openDb();
const app = createApp();
// Behind a reverse proxy (nginx, Cloudflare, Pterodactyl proxy) so rate limits see real client IPs.
if (process.env.TRUST_PROXY === '1') app.set('trust proxy', 1);

const port = Number(process.env.PORT || process.env.SERVER_PORT) || 3000;
const host = process.env.HOST || '0.0.0.0';
const server = app.listen(port, host, () => {
  console.log(`Realms of Ashenvale running at http://${host}:${port}`);
});

// Clean shutdown (Pterodactyl's stop button sends ^C / SIGINT).
function shutdown(signal) {
  console.log(`Received ${signal}, saving and shutting down...`);
  server.close(() => {
    try { db.exec('PRAGMA wal_checkpoint(TRUNCATE);'); db.close(); } catch { /* already closed */ }
    process.exit(0);
  });
  setTimeout(() => process.exit(0), 5000).unref();
}
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
