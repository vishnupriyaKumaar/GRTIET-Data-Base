// One-time helper: converts records saved by the OLD version of this app
// (plain Firestore documents + big base64 images) into the new format where
// every document is under 50 KB.
//
//   npm run migrate-legacy            (reads your Firebase key like the app does)
//
// - Student details are always converted.
// - A photo / signature is copied only if it already fits the new limits
//   (photo 30 KB, signature 14 KB). Bigger ones are listed at the end:
//   re-upload them from Admin -> Update (the app shrinks them automatically).
// - Old documents are left untouched; delete them later in the Firebase console.
require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') });
const db = require('../db');
const store = require('../store');

const legacyUploadId = (rel) => Buffer.from(String(rel), 'utf8').toString('base64url');

(async () => {
  if (!db.isFirebaseConfigured()) { console.error('No Firebase key found. See .env.example.'); process.exit(1); }
  const rows = await db.list('students');
  const old = rows.filter((r) => !r.data.z && r.data.rollNo);
  console.log(`Found ${rows.length} documents, ${old.length} in the old format.`);
  let ok = 0, skipped = 0; const needImages = [];
  for (const { data } of old) {
    const { photoPath, signaturePath, ...record } = data;
    const grab = async (p, max) => {
      if (!p) return undefined;
      const up = await db.get('uploads', legacyUploadId(String(p).replace(/^[\\/]+/, '')));
      if (!up || !up.data) return undefined;
      const buffer = Buffer.from(up.data, 'base64');
      if (buffer.length > max) { needImages.push(`${record.rollNo} (${p.includes('signature') ? 'signature' : 'photo'}, ${Math.ceil(buffer.length / 1024)} KB)`); return undefined; }
      return { buffer, contentType: up.contentType || 'image/jpeg' };
    };
    try {
      const photo = await grab(photoPath, store.MAX_PHOTO_BYTES);
      const signature = await grab(signaturePath, store.MAX_SIGNATURE_BYTES);
      await store.addStudent(record, photo, signature);
      ok++;
    } catch (e) {
      if (e.code === 'DUPLICATE') { skipped++; continue; }
      console.error(`  ${record.rollNo}: ${e.message}`);
    }
  }
  console.log(`Converted ${ok}, already converted ${skipped}.`);
  if (needImages.length) console.log('Re-upload these images from Admin -> Update:\n  ' + needImages.join('\n  '));
  console.log('Your Admin password carries over unchanged.');
  process.exit(0);
})().catch((e) => { console.error(e.message); process.exit(1); });
