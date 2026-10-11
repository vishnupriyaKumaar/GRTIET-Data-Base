// -----------------------------------------------------------------------------
// AUTH - works on Vercel (many short-lived servers, no shared memory, no disk)
//
// A login is a small SIGNED token kept in a cookie. Any server instance can
// verify it with JWT_SECRET, so no session table is needed.
//
//   Student  : no password -> role "entry"  (can only open Add Student)
//   Admin    : password    -> role "admin"  (full access)
//
// The admin password hash lives in the database (appConfig/config). Until the
// admin changes it inside the app, the first password is ADMIN_PASSWORD from the
// environment (default: grtcse@1234 - change it!). Every token carries the
// "password version"; changing the password makes every older admin login stop
// working on every device.
// -----------------------------------------------------------------------------
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const db = require('./db');

const SESSION_HOURS = 8;
const COOKIE = 'grt_session';
const isProduction = !!process.env.VERCEL || process.env.NODE_ENV === 'production';
const DATA_DIR = process.env.GRT_DATA_DIR || path.join(__dirname, 'data');

// ---- signing secret ----------------------------------------------------------
let localSecret = null;
function getSecret() {
  if (process.env.JWT_SECRET) return process.env.JWT_SECRET;
  if (isProduction) return null; // must be set on Vercel - never use a secret that is written in the code
  if (localSecret) return localSecret;
  // Local development only: a random secret kept in backend/data so restarts keep you logged in.
  const file = path.join(DATA_DIR, '.session-secret');
  try {
    localSecret = fs.readFileSync(file, 'utf8').trim();
  } catch {
    localSecret = crypto.randomBytes(32).toString('hex');
    try { fs.mkdirSync(DATA_DIR, { recursive: true }); fs.writeFileSync(file, localSecret); } catch { /* in-memory only */ }
  }
  return localSecret;
}

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const sign = (body, secret) => crypto.createHmac('sha256', secret).update(body).digest('base64url');

function makeToken(role, pv) {
  const secret = getSecret();
  if (!secret) throw Object.assign(new Error('JWT_SECRET is not set on the server. Add it in the Vercel environment variables and redeploy.'), { status: 500 });
  const body = b64({ role, pv, exp: Date.now() + SESSION_HOURS * 3600 * 1000 });
  return `${body}.${sign(body, secret)}`;
}

function readToken(token) {
  const secret = getSecret();
  if (!secret || typeof token !== 'string') return null;
  const [body, sig] = token.split('.');
  if (!body || !sig) return null;
  const good = sign(body, secret);
  if (sig.length !== good.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(good))) return null;
  try {
    const p = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    return p && p.exp > Date.now() ? p : null;
  } catch { return null; }
}

// ---- admin password ----------------------------------------------------------
function scrypt(password, salt) {
  return crypto.scryptSync(password, salt, 64).toString('hex');
}
const safeEq = (a, b) => {
  const x = Buffer.from(String(a)), y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
};

let cfgCache = { at: 0, value: undefined };
async function loadConfig(force) {
  if (!force && cfgCache.value !== undefined && Date.now() - cfgCache.at < 20000) return cfgCache.value;
  const value = await db.get('appConfig', 'config'); // null until the password is first changed
  cfgCache = { at: Date.now(), value };
  return value;
}
const defaultPassword = () => process.env.ADMIN_PASSWORD || process.env.APP_PASSWORD || 'grtcse@1234';

async function adminLogin(password) {
  if (typeof password !== 'string' || !password) return null;
  const cfg = await loadConfig(true);
  if (cfg && cfg.admin) return safeEq(scrypt(password, cfg.admin.salt), cfg.admin.hash) ? cfg.pv || '0' : null;
  return safeEq(password, defaultPassword()) ? '0' : null;
}

async function setPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const pv = crypto.randomBytes(6).toString('hex');
  await db.set('appConfig', 'config', { admin: { salt, hash: scrypt(password, salt) }, pv });
  cfgCache = { at: 0, value: undefined };
}

// ---- login throttle (per server instance; stops fast password guessing) ------
const fails = new Map();
function throttled(ip) {
  const f = fails.get(ip);
  return !!f && f.n >= 8 && Date.now() - f.t < 10 * 60 * 1000;
}
function noteFail(ip) {
  const f = fails.get(ip);
  fails.set(ip, f && Date.now() - f.t < 10 * 60 * 1000 ? { n: f.n + 1, t: f.t } : { n: 1, t: Date.now() });
}
const noteOk = (ip) => fails.delete(ip);

// ---- cookie + middleware -----------------------------------------------------
function startSession(res, role, pv) {
  const token = makeToken(role, pv);
  res.cookie(COOKIE, token, { httpOnly: true, sameSite: 'strict', secure: isProduction, maxAge: SESSION_HOURS * 3600 * 1000, path: '/' });
  return role;
}
const endSession = (res) => res.clearCookie(COOKIE, { path: '/' });

function tokenFrom(req) {
  const hit = (req.headers.cookie || '').split(';').map((x) => x.trim()).find((x) => x.startsWith(COOKIE + '='));
  return hit ? decodeURIComponent(hit.slice(COOKIE.length + 1)) : null;
}

// Fills req.session when the cookie is valid (and, for admins, still matches the current password).
async function session(req, res, next) {
  try {
    const p = readToken(tokenFrom(req));
    if (p) {
      if (p.role === 'admin') {
        let cfg = await loadConfig(false);
        let current = cfg && cfg.pv ? cfg.pv : '0';
        if (current !== p.pv) { cfg = await loadConfig(true); current = cfg && cfg.pv ? cfg.pv : '0'; }
        if (current === p.pv) req.session = { role: 'admin' };
      } else if (p.role === 'entry') {
        req.session = { role: 'entry' };
      }
    }
  } catch (e) {
    req.sessionError = e; // e.g. database not connected - routes that need it will report it
  }
  next();
}

const requireAuth = (req, res, next) => (req.session ? next() : res.status(401).json({ message: 'Please log in.' }));
const admin = (req, res, next) => (req.session && req.session.role === 'admin' ? next() : res.status(403).json({ message: 'Full access required.' }));

module.exports = {
  getSecret, adminLogin, setPassword, startSession, endSession, session, requireAuth, admin,
  throttled, noteFail, noteOk, SESSION_HOURS,
};
