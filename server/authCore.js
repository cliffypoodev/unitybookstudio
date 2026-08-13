/**
 * server/authCore.js — AUTH-1
 *
 * Pure-node authentication + per-user data-scoping core for the local server
 * store. No vite, no browser, no external deps — raw-node batteries import
 * this file directly.
 *
 * Design:
 * - Users live in <dataDir>/_auth/users.json. Passwords are scrypt-hashed
 *   (node:crypto, per-user random salt). Plaintext is never stored.
 * - Sessions are stateless HMAC-signed tokens (base64url payload + signature)
 *   keyed by a server secret persisted at <dataDir>/_auth/secret.key. The
 *   token carries { uid, exp }. Tampering or expiry fails verification.
 * - Each user's entity stores live in <dataDir>/users/<uid>/<Entity>.json —
 *   HARD separation: the store layer resolves paths from the session user,
 *   so a filtering bug cannot leak another user's records.
 * - First-run migration: when the FIRST account is created, any legacy
 *   top-level <dataDir>/<Entity>.json files are MOVED (fs.renameSync — atomic
 *   on the same volume) into that user's directory, and a manifest is written
 *   to <dataDir>/_auth/migration.json. Idempotent: a second call is a no-op.
 * - Registration rule: creating a user requires either (a) zero users exist
 *   (first-run setup) or (b) an authenticated existing user (invite model).
 *   This is enforced by the HTTP layer via usersExist() + session checks.
 *
 * HONESTY NOTE (by design, documented for the operator): this protects the
 * app over HTTP. Data at rest stays plaintext JSON on disk — anyone with
 * filesystem access to the machine can read every book. Disk privacy is the
 * OS's job (FileVault), not this module's.
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
export const SESSION_COOKIE = 'ubs_session';

function authDir(dataDir) { return path.join(dataDir, '_auth'); }
function usersFile(dataDir) { return path.join(authDir(dataDir), 'users.json'); }
function secretFile(dataDir) { return path.join(authDir(dataDir), 'secret.key'); }
function migrationFile(dataDir) { return path.join(authDir(dataDir), 'migration.json'); }

function ensureAuthDir(dataDir) {
  if (!fs.existsSync(authDir(dataDir))) fs.mkdirSync(authDir(dataDir), { recursive: true });
}

export function loadUsers(dataDir) {
  ensureAuthDir(dataDir);
  const f = usersFile(dataDir);
  if (!fs.existsSync(f)) return [];
  try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return []; }
}

function saveUsers(dataDir, users) {
  ensureAuthDir(dataDir);
  const f = usersFile(dataDir);
  const tmp = f + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(users, null, 2), 'utf8');
  fs.renameSync(tmp, f);
}

export function usersExist(dataDir) {
  return loadUsers(dataDir).length > 0;
}

export function getSecret(dataDir) {
  ensureAuthDir(dataDir);
  const f = secretFile(dataDir);
  if (fs.existsSync(f)) return fs.readFileSync(f, 'utf8').trim();
  const secret = crypto.randomBytes(32).toString('hex');
  fs.writeFileSync(f, secret, { encoding: 'utf8', mode: 0o600 });
  return secret;
}

// ── Passwords (scrypt) ──────────────────────────────────────────────────

export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(String(password), salt, 64).toString('hex');
  return { salt, hash };
}

export function verifyPassword(password, salt, hash) {
  try {
    const candidate = crypto.scryptSync(String(password), String(salt), 64);
    const stored = Buffer.from(String(hash), 'hex');
    return candidate.length === stored.length && crypto.timingSafeEqual(candidate, stored);
  } catch {
    return false;
  }
}

// ── Users ───────────────────────────────────────────────────────────────

export function normalizeUsername(username) {
  return String(username || '').trim().toLowerCase().replace(/[^a-z0-9._-]/g, '');
}

export function createUser(dataDir, { username, password, displayName }) {
  const uname = normalizeUsername(username);
  if (uname.length < 2) throw new Error('Username must be at least 2 characters (letters, numbers, . _ -).');
  if (String(password || '').length < 8) throw new Error('Password must be at least 8 characters.');
  const users = loadUsers(dataDir);
  if (users.some((u) => u.username === uname)) throw new Error('That username is taken.');
  const { salt, hash } = hashPassword(password);
  const user = {
    id: 'u-' + crypto.randomBytes(6).toString('hex'),
    username: uname,
    display_name: String(displayName || username || '').trim() || uname,
    salt,
    hash,
    created_date: new Date().toISOString(),
  };
  users.push(user);
  saveUsers(dataDir, users);
  fs.mkdirSync(userDataDir(dataDir, user.id), { recursive: true });
  return publicUser(user);
}

export function authenticate(dataDir, username, password) {
  const uname = normalizeUsername(username);
  const user = loadUsers(dataDir).find((u) => u.username === uname);
  if (!user) return null;
  return verifyPassword(password, user.salt, user.hash) ? publicUser(user) : null;
}

export function getUserById(dataDir, uid) {
  const user = loadUsers(dataDir).find((u) => u.id === uid);
  return user ? publicUser(user) : null;
}

export function publicUser(user) {
  return { id: user.id, username: user.username, display_name: user.display_name, created_date: user.created_date };
}

// ── Sessions (stateless HMAC tokens) ────────────────────────────────────

function b64url(buf) { return Buffer.from(buf).toString('base64url'); }

export function createSessionToken(uid, secret, ttlMs = SESSION_TTL_MS) {
  const payload = b64url(JSON.stringify({ uid, exp: Date.now() + ttlMs }));
  const sig = crypto.createHmac('sha256', secret).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

export function verifySessionToken(token, secret) {
  try {
    const [payload, sig] = String(token || '').split('.');
    if (!payload || !sig) return null;
    const expected = crypto.createHmac('sha256', secret).update(payload).digest('base64url');
    const a = Buffer.from(sig); const b = Buffer.from(expected);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (!data.uid || !data.exp || Date.now() > data.exp) return null;
    return { uid: data.uid };
  } catch {
    return null;
  }
}

export function parseCookies(cookieHeader) {
  const out = {};
  String(cookieHeader || '').split(';').forEach((pair) => {
    const i = pair.indexOf('=');
    if (i > 0) out[pair.slice(0, i).trim()] = decodeURIComponent(pair.slice(i + 1).trim());
  });
  return out;
}

// ── Per-user data scoping ───────────────────────────────────────────────

export function userDataDir(dataDir, uid) {
  // uid comes only from a verified session token, but belt-and-suspenders:
  // refuse anything that could traverse out of the users directory.
  const safe = String(uid || '').replace(/[^a-zA-Z0-9_-]/g, '');
  if (!safe || safe !== String(uid)) throw new Error('Invalid user id.');
  return path.join(dataDir, 'users', safe);
}

// ── Legacy migration ────────────────────────────────────────────────────

/**
 * Move legacy top-level entity files into the given user's directory.
 * Runs exactly once (manifest-guarded). fs.renameSync is atomic on the same
 * volume, so even the ~100MB stores move instantly and safely.
 */
export function migrateLegacyData(dataDir, uid, entityNames) {
  ensureAuthDir(dataDir);
  const mf = migrationFile(dataDir);
  if (fs.existsSync(mf)) return { migrated: [], skipped: 'already-migrated' };
  const destDir = userDataDir(dataDir, uid);
  fs.mkdirSync(destDir, { recursive: true });
  const migrated = [];
  for (const entity of entityNames) {
    const src = path.join(dataDir, `${entity}.json`);
    if (fs.existsSync(src)) {
      fs.renameSync(src, path.join(destDir, `${entity}.json`));
      migrated.push(entity);
    }
  }
  const manifest = { migrated_to: uid, migrated, at: new Date().toISOString() };
  fs.writeFileSync(mf, JSON.stringify(manifest, null, 2), 'utf8');
  return { migrated };
}
