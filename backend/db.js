// -----------------------------------------------------------------------------
// DATABASE LAYER
//
// Every piece of data in the database is a small "document", and NO document
// may be larger than 50 KB (MAX_DOC_BYTES). This is enforced here, on every
// write, so it is impossible to store a bigger one by accident. Keeping every
// document tiny is what lets the free Firestore plan hold many more students.
//
// Two storage drivers, same interface:
//   * Firestore  - used on Vercel (and locally if you provide a key).
//   * Local file - used ONLY when you run on your own PC with no Firebase key,
//                  so the app still works in VS Code for testing
//                  (data goes to backend/data/local-db.json).
//
// Credentials (first one found wins):
//   1. FIREBASE_SERVICE_ACCOUNT_JSON   whole key as ONE line  (use on Vercel)
//   2. FIREBASE_SERVICE_ACCOUNT        same (older name, JSON or base64)
//   3. FIREBASE_SERVICE_ACCOUNT_BASE64 key, base64-encoded
//   4. backend/serviceAccountKey.json  (or backend/firebase-key.json) on your PC
// -----------------------------------------------------------------------------
const fs = require('fs');
const path = require('path');

const MAX_DOC_BYTES = 50 * 1024; // 50 KB per stored document
const DATA_DIR = process.env.GRT_DATA_DIR || path.join(__dirname, 'data');
const isVercel = !!process.env.VERCEL;

function httpError(status, message, code) {
  return Object.assign(new Error(message), { status, code });
}

// Size of a document as we count it: field names + values (Buffers = raw bytes).
function docBytes(data) {
  let n = 0;
  for (const [k, v] of Object.entries(data)) {
    n += Buffer.byteLength(k);
    n += Buffer.isBuffer(v) ? v.length : Buffer.byteLength(JSON.stringify(v === undefined ? null : v));
  }
  return n;
}

function assertDocSize(col, id, data) {
  const size = docBytes(data);
  if (size > MAX_DOC_BYTES) {
    throw httpError(
      413,
      `Each stored item must be under 50 KB, but this one (${col}) would be ${Math.ceil(size / 1024)} KB. ` +
        'Please use a smaller photo / signature image.',
      'DOC_TOO_LARGE'
    );
  }
  return size;
}

// ---------------------------------------------------------------- credentials
const LOCAL_KEYS = [
  process.env.FIREBASE_KEY_FILE,
  process.env.GOOGLE_APPLICATION_CREDENTIALS,
  path.join(__dirname, 'serviceAccountKey.json'),
  path.join(__dirname, 'firebase-key.json'),
].filter(Boolean);

function fixPrivateKey(sa) {
  // Pasted into an environment-variable box, line breaks in private_key can
  // arrive as the two characters "\" + "n".
  if (sa && typeof sa.private_key === 'string') sa.private_key = sa.private_key.replace(/\\n/g, '\n');
  return sa;
}

function readServiceAccount() {
  let raw = (process.env.FIREBASE_SERVICE_ACCOUNT_JSON || process.env.FIREBASE_SERVICE_ACCOUNT || '').trim();
  if (raw) {
    try {
      if (!raw.startsWith('{')) raw = Buffer.from(raw, 'base64').toString('utf8');
      return fixPrivateKey(JSON.parse(raw));
    } catch {
      throw httpError(
        500,
        'FIREBASE_SERVICE_ACCOUNT_JSON is set but is not valid JSON. Paste the ENTIRE key file as ONE line ' +
          '(run "npm run firebase-env" to print it correctly).',
        'FIREBASE_BAD_KEY'
      );
    }
  }
  const b64 = (process.env.FIREBASE_SERVICE_ACCOUNT_BASE64 || '').trim();
  if (b64) {
    try {
      return fixPrivateKey(JSON.parse(Buffer.from(b64, 'base64').toString('utf8')));
    } catch {
      throw httpError(500, 'FIREBASE_SERVICE_ACCOUNT_BASE64 could not be decoded into valid JSON.', 'FIREBASE_BAD_KEY');
    }
  }
  const file = LOCAL_KEYS.find((f) => fs.existsSync(f));
  return file ? fixPrivateKey(JSON.parse(fs.readFileSync(file, 'utf8'))) : null;
}

function isFirebaseConfigured() {
  return !!(
    (process.env.FIREBASE_SERVICE_ACCOUNT_JSON || '').trim() ||
    (process.env.FIREBASE_SERVICE_ACCOUNT || '').trim() ||
    (process.env.FIREBASE_SERVICE_ACCOUNT_BASE64 || '').trim() ||
    LOCAL_KEYS.some((f) => fs.existsSync(f))
  );
}

// ------------------------------------------------------------ Firestore driver
function firestoreDriver() {
  const sa = readServiceAccount();
  const admin = require('firebase-admin'); // loaded lazily - never at start-up
  if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(sa) });
  const db = admin.firestore();

  async function withRetry(fn, tries = 3) {
    let last;
    for (let i = 1; i <= tries; i++) {
      try {
        return await fn();
      } catch (e) {
        last = e;
        if (i < tries) await new Promise((r) => setTimeout(r, 250 * i));
      }
    }
    throw httpError(502, 'Could not reach the database: ' + (last && last.message), 'DB_UNREACHABLE');
  }

  return {
    name: 'firestore',
    async get(col, id) {
      const snap = await withRetry(() => db.collection(col).doc(id).get());
      return snap.exists ? snap.data() : null;
    },
    async create(col, id, data) {
      try {
        await db.collection(col).doc(id).create(data);
      } catch (e) {
        if (e && (e.code === 6 || /ALREADY_EXISTS/i.test(String(e.message)))) throw httpError(409, 'Already exists.', 'EXISTS');
        throw httpError(502, 'Could not reach the database: ' + e.message, 'DB_UNREACHABLE');
      }
    },
    async set(col, id, data) {
      await withRetry(() => db.collection(col).doc(id).set(data));
    },
    async del(col, id) {
      await withRetry(() => db.collection(col).doc(id).delete());
    },
    async list(col, fields) {
      const snap = await withRetry(() => {
        let q = db.collection(col);
        if (fields && fields.length) q = q.select(...fields);
        return q.get();
      });
      return snap.docs.map((d) => ({ id: d.id, data: d.data() }));
    },
  };
}

// ----------------------------------------------------------- local-file driver
function localDriver() {
  const file = path.join(DATA_DIR, 'local-db.json');
  const enc = (k, v) => (v && v.type === 'Buffer' && Array.isArray(v.data) ? { $b64: Buffer.from(v.data).toString('base64') } : v);
  const dec = (k, v) => (v && typeof v === 'object' && typeof v.$b64 === 'string' ? Buffer.from(v.$b64, 'base64') : v);
  let cache = null;

  function load() {
    if (cache) return cache;
    try {
      cache = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8'), dec) : {};
    } catch {
      cache = {};
    }
    return cache;
  }
  function save() {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    const tmp = file + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(cache, enc));
    fs.renameSync(tmp, file);
  }
  const clone = (d) => JSON.parse(JSON.stringify(d, enc), dec);

  return {
    name: 'local-file',
    async get(col, id) {
      const d = (load()[col] || {})[id];
      return d ? clone(d) : null;
    },
    async create(col, id, data) {
      const all = load();
      all[col] = all[col] || {};
      if (all[col][id]) throw httpError(409, 'Already exists.', 'EXISTS');
      all[col][id] = clone(data);
      save();
    },
    async set(col, id, data) {
      const all = load();
      all[col] = all[col] || {};
      all[col][id] = clone(data);
      save();
    },
    async del(col, id) {
      const all = load();
      if (all[col]) delete all[col][id];
      save();
    },
    async list(col, fields) {
      return Object.entries(load()[col] || {}).map(([id, d]) => {
        const data = clone(d);
        if (fields && fields.length) for (const k of Object.keys(data)) if (!fields.includes(k)) delete data[k];
        return { id, data };
      });
    },
  };
}

// ------------------------------------------------------------------ public API
let driver = null;
function getDriver() {
  if (driver) return driver;
  if (isFirebaseConfigured()) {
    driver = firestoreDriver();
  } else if (isVercel || process.env.NODE_ENV === 'production') {
    throw httpError(
      503,
      'The database is not connected. Add FIREBASE_SERVICE_ACCOUNT_JSON in the Vercel environment variables and redeploy.',
      'DB_NOT_CONFIGURED'
    );
  } else {
    console.warn('[db] No Firebase key found - using a local file (backend/data/local-db.json). Fine for testing on your PC.');
    driver = localDriver();
  }
  return driver;
}

module.exports = {
  MAX_DOC_BYTES,
  docBytes,
  isFirebaseConfigured,
  driverName: () => (isFirebaseConfigured() ? 'firestore' : isVercel ? 'none' : 'local-file'),
  get: (col, id) => getDriver().get(col, id),
  create: async (col, id, data) => { assertDocSize(col, id, data); return getDriver().create(col, id, data); },
  set: async (col, id, data) => { assertDocSize(col, id, data); return getDriver().set(col, id, data); },
  del: (col, id) => getDriver().del(col, id),
  list: (col, fields) => getDriver().list(col, fields),
};
