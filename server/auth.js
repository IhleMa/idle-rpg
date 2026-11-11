// Account authentication: scrypt password hashes, random session tokens stored hashed.
import crypto from 'node:crypto';
import { q, GameError } from './db.js';

const SESSION_DAYS = 30;
export const COOKIE = 'sid';

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  const [salt, hash] = stored.split(':');
  const test = crypto.scryptSync(password, salt, 64);
  return crypto.timingSafeEqual(test, Buffer.from(hash, 'hex'));
}

const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');

function validate(username, password) {
  if (typeof username !== 'string' || !/^[A-Za-z0-9_]{3,20}$/.test(username)) throw new GameError('Username must be 3-20 letters, numbers or underscores.');
  if (typeof password !== 'string' || password.length < 8 || password.length > 128) throw new GameError('Password must be 8-128 characters.');
}

export function register(username, password) {
  validate(username, password);
  if (q('SELECT 1 FROM users WHERE username = ?').get(username)) throw new GameError('That username is taken.');
  const info = q('INSERT INTO users (username, pass_hash, created_at) VALUES (?, ?, ?)').run(username, hashPassword(password), Date.now());
  return createSession(Number(info.lastInsertRowid));
}

export function login(username, password) {
  if (typeof username !== 'string' || typeof password !== 'string') throw new GameError('Invalid credentials.', 401);
  const u = q('SELECT * FROM users WHERE username = ?').get(username);
  if (!u || !verifyPassword(password, u.pass_hash)) throw new GameError('Invalid username or password.', 401);
  return createSession(u.id);
}

function createSession(userId) {
  const token = crypto.randomBytes(32).toString('hex');
  const now = Date.now();
  q('INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)').run(sha(token), userId, now, now + SESSION_DAYS * 86400000);
  q('DELETE FROM sessions WHERE expires_at < ?').run(now);
  return { token, userId, maxAge: SESSION_DAYS * 86400000 };
}

export function userFromToken(token) {
  if (!token || typeof token !== 'string') return null;
  const s = q('SELECT s.user_id, u.username FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ? AND s.expires_at > ?').get(sha(token), Date.now());
  return s ? { id: s.user_id, username: s.username } : null;
}

export function logout(token) {
  if (token) q('DELETE FROM sessions WHERE token_hash = ?').run(sha(token));
}

export function parseCookies(header = '') {
  const out = {};
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}
