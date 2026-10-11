// -----------------------------------------------------------------------------
// STUDENT STORE  (replaces the old records.json + uploads folder + students.xlsx)
//
// Vercel has no permanent disk, so everything lives in the database. Layout:
//
//   students/{id}       the student's details, gzip-compressed into one small
//                       blob, plus a few plain fields used for fast search
//   studentImages/{id}_photo      the passport photo   (tiny JPEG)
//   studentImages/{id}_signature  the signature        (tiny JPEG)
//
// 50 KB RULE: every one of those documents is under 50 KB, and the WHOLE
// record of one student (details + photo + signature) is kept under 50 KB too.
// {id} is the Roll No (lower-case) encoded as base64url, so a Roll No can only
// be registered once. The Excel file is no longer stored - it is built fresh
// from the records every time Admin presses "Download Excel".
// -----------------------------------------------------------------------------
const zlib = require('zlib');
const db = require('./db');
const excel = require('./excel');

const MAX_RECORD_BYTES = 50 * 1024; // details + photo + signature of ONE student
const MAX_PHOTO_BYTES = 30 * 1024;
const MAX_SIGNATURE_BYTES = 14 * 1024;

const STUDENTS = 'students';
const IMAGES = 'studentImages';
const LIST_FIELDS = ['rollNo', 'name', 'batch', 'hasPhoto', 'hasSignature', 'imgV'];

const bad = (status, message, code) => Object.assign(new Error(message), { status, code });

const idFor = (rollNo) => Buffer.from(String(rollNo).trim().toLowerCase(), 'utf8').toString('base64url');
const pack = (obj) => zlib.gzipSync(Buffer.from(JSON.stringify(obj), 'utf8'), { level: 9 });
const unpack = (buf) => JSON.parse(zlib.gunzipSync(Buffer.from(buf)).toString('utf8'));

// ---- record upgrade (older records had different transport / scholarship rules)
const SCHOLARSHIP_VALUES = excel.SCHOLARSHIP_VALUES;
const normalizeBatch = excel.normalizeBatch;

function upgradeRecord(s) {
  const r = { ...s };
  r.batch = normalizeBatch(r.batch);
  if (r.residentType === 'Day Scholar' && !r.transportMode) r.transportMode = String(r.transportBoardingPoint || '').trim() ? 'College Bus' : '';
  if (r.residentType !== 'Day Scholar') r.transportMode = '';
  if (r.transportMode !== 'College Bus') r.transportBoardingPoint = '';
  const sch = String(r.scholarship || '').trim();
  if (sch && !SCHOLARSHIP_VALUES.includes(sch)) { r.scholarshipOther = r.scholarshipOther || sch; r.scholarship = 'Other'; }
  if (r.scholarship !== 'Other') r.scholarshipOther = '';
  return r;
}

const imgUrl = (id, kind, v) => `/api/students/image/${id}/${kind}?v=${encodeURIComponent(v || 0)}`;

// Turns a stored student document into the record the app uses.
function toRecord(id, doc) {
  const r = upgradeRecord(unpack(doc.z));
  r.photoPath = doc.hasPhoto ? imgUrl(id, 'photo', doc.imgV) : '';
  r.signaturePath = doc.hasSignature ? imgUrl(id, 'signature', doc.imgV) : '';
  return r;
}

// What gets compressed into the student document (never the image links).
function stripForStorage(record) {
  const { photoPath, signaturePath, _sheet, _row, ...rest } = record;
  return rest;
}

function checkBudget(zLen, photoLen, sigLen) {
  const total = zLen + photoLen + sigLen;
  if (total > MAX_RECORD_BYTES) {
    throw bad(
      400,
      `This student record would use ${Math.ceil(total / 1024)} KB, over the 50 KB-per-student limit ` +
        `(details ${Math.ceil(zLen / 1024)} KB + photo ${Math.ceil(photoLen / 1024)} KB + signature ${Math.ceil(sigLen / 1024)} KB). ` +
        'Please use a smaller photo or signature image.',
      'RECORD_TOO_LARGE'
    );
  }
  return total;
}

function checkImageSizes(photo, signature) {
  if (photo && photo.length > MAX_PHOTO_BYTES) throw bad(400, `The student photo must be ${MAX_PHOTO_BYTES / 1024} KB or smaller (the app shrinks it automatically).`);
  if (signature && signature.length > MAX_SIGNATURE_BYTES) throw bad(400, `The student signature must be ${MAX_SIGNATURE_BYTES / 1024} KB or smaller (the app shrinks it automatically).`);
}

const imageDoc = (buf, contentType, v) => ({ data: buf, ct: contentType || 'image/jpeg', v });

// ------------------------------------------------------------------------ reads
async function readDoc(rollNo) {
  const id = idFor(rollNo);
  const doc = await db.get(STUDENTS, id);
  return doc ? { id, doc } : null;
}

async function findByRollNo(rollNo) {
  const found = await readDoc(rollNo);
  return found ? toRecord(found.id, found.doc) : undefined;
}

async function getAllStudents() {
  const rows = await db.list(STUDENTS);
  return rows.map(({ id, data }) => toRecord(id, data));
}

async function getBatchList() {
  const rows = await db.list(STUDENTS, ['batch']);
  return [...new Set(rows.map((r) => normalizeBatch(r.data.batch)).filter(Boolean))].sort();
}

// Lightweight list for suggestions / the batch grid - reads only the small
// plain fields, never the compressed blobs or the images.
async function searchStudents({ q = '', batch = '' } = {}) {
  const query = String(q).trim().toLowerCase();
  let list = (await db.list(STUDENTS, LIST_FIELDS)).map(({ id, data }) => ({ id, ...data, batch: normalizeBatch(data.batch) }));
  if (batch) list = list.filter((s) => s.batch === normalizeBatch(batch));
  if (query) {
    const rank = (s) => {
      const name = String(s.name || '').toLowerCase();
      const roll = String(s.rollNo || '').toLowerCase();
      if (name.startsWith(query) || roll.startsWith(query)) return 0;
      if (name.split(/\s+/).some((w) => w.startsWith(query))) return 1;
      if (name.includes(query) || roll.includes(query)) return 2;
      return -1;
    };
    list = list.map((s) => ({ s, r: rank(s) })).filter((x) => x.r >= 0)
      .sort((a, b) => a.r - b.r || String(a.s.name).localeCompare(String(b.s.name))).map((x) => x.s);
  } else {
    list = [...list].sort((a, b) => excel.compareRollNo(a.rollNo, b.rollNo));
  }
  return list.map((s) => ({
    rollNo: s.rollNo, name: s.name, batch: s.batch,
    photoPath: s.hasPhoto ? imgUrl(s.id, 'photo', s.imgV) : '',
  }));
}

async function getImage(id, kind) {
  if (!['photo', 'signature'].includes(kind)) return null;
  const doc = await db.get(IMAGES, `${id}_${kind}`);
  return doc ? { data: Buffer.from(doc.data), contentType: doc.ct || 'image/jpeg' } : null;
}

// ----------------------------------------------------------------------- writes
// photo / signature: { buffer, contentType } or undefined
async function addStudent(record, photo, signature) {
  checkImageSizes(photo && photo.buffer, signature && signature.buffer);
  const id = idFor(record.rollNo);
  const now = new Date().toISOString();
  const saved = { ...stripForStorage(record), createdAt: record.createdAt || now, updatedAt: record.updatedAt || '' };
  const z = pack(saved);
  const photoLen = photo ? photo.buffer.length : 0;
  const sigLen = signature ? signature.buffer.length : 0;
  checkBudget(z.length, photoLen, sigLen);

  const v = Date.now();
  const wrote = [];
  try {
    if (photo) { await db.set(IMAGES, `${id}_photo`, imageDoc(photo.buffer, photo.contentType, v)); wrote.push(`${id}_photo`); }
    if (signature) { await db.set(IMAGES, `${id}_signature`, imageDoc(signature.buffer, signature.contentType, v)); wrote.push(`${id}_signature`); }
    try {
      await db.create(STUDENTS, id, {
        rollNo: saved.rollNo, name: saved.name, batch: saved.batch,
        hasPhoto: !!photo, hasSignature: !!signature, imgV: v,
        photoBytes: photoLen, signatureBytes: sigLen, z,
      });
    } catch (e) {
      if (e.code === 'EXISTS') throw Object.assign(new Error('Roll No is already registered.'), { code: 'DUPLICATE', status: 409 });
      throw e;
    }
  } catch (e) {
    for (const k of wrote) await db.del(IMAGES, k).catch(() => {}); // leave nothing half-saved
    throw e;
  }
  return toRecord(id, await db.get(STUDENTS, id));
}

// updates: fields to change (may include a new rollNo). photo / signature: new files or undefined.
async function updateStudent(rollNo, updates, photo, signature) {
  checkImageSizes(photo && photo.buffer, signature && signature.buffer);
  const found = await readDoc(rollNo);
  if (!found) throw Object.assign(new Error('Student not found.'), { code: 'NOT_FOUND', status: 404 });
  const { id: oldId, doc: oldDoc } = found;
  const existing = upgradeRecord(unpack(oldDoc.z));

  const desired = updates.rollNo ? String(updates.rollNo).trim() : existing.rollNo;
  if (!desired) throw Object.assign(new Error('Roll No is required.'), { code: 'VALIDATION', status: 400 });
  const newId = idFor(desired);
  const renamed = newId !== oldId;

  const merged = { ...existing, ...updates, rollNo: desired, updatedAt: new Date().toISOString() };
  const z = pack(stripForStorage(merged));
  const photoLen = photo ? photo.buffer.length : oldDoc.hasPhoto ? oldDoc.photoBytes || 0 : 0;
  const sigLen = signature ? signature.buffer.length : oldDoc.hasSignature ? oldDoc.signatureBytes || 0 : 0;
  checkBudget(z.length, photoLen, sigLen);

  const imagesChanged = !!(photo || signature);
  const v = imagesChanged || renamed ? Date.now() : oldDoc.imgV;

  // Images first (so a student never points at a missing image) ...
  const carry = async (kind, fresh) => {
    if (fresh) return db.set(IMAGES, `${newId}_${kind}`, imageDoc(fresh.buffer, fresh.contentType, v));
    const had = kind === 'photo' ? oldDoc.hasPhoto : oldDoc.hasSignature;
    if (!had) return;
    if (!renamed && !imagesChanged) return; // nothing to rewrite
    const old = await db.get(IMAGES, `${oldId}_${kind}`);
    if (old) await db.set(IMAGES, `${newId}_${kind}`, { ...old, v });
  };
  await carry('photo', photo);
  await carry('signature', signature);

  // ... then the student document.
  const body = {
    rollNo: merged.rollNo, name: merged.name, batch: normalizeBatch(merged.batch),
    hasPhoto: !!photo || !!oldDoc.hasPhoto, hasSignature: !!signature || !!oldDoc.hasSignature, imgV: v,
    photoBytes: photoLen, signatureBytes: sigLen, z,
  };
  if (renamed) {
    try {
      await db.create(STUDENTS, newId, body);
    } catch (e) {
      if (e.code === 'EXISTS') throw Object.assign(new Error('Roll No is already registered.'), { code: 'DUPLICATE', status: 409 });
      throw e;
    }
    await db.del(STUDENTS, oldId);
    await db.del(IMAGES, `${oldId}_photo`).catch(() => {});
    await db.del(IMAGES, `${oldId}_signature`).catch(() => {});
  } else {
    await db.set(STUDENTS, newId, body);
  }
  return toRecord(newId, await db.get(STUDENTS, newId));
}

async function deleteStudent(rollNo) {
  const found = await readDoc(rollNo);
  if (!found) throw Object.assign(new Error('Student not found.'), { code: 'NOT_FOUND', status: 404 });
  await db.del(STUDENTS, found.id);
  await db.del(IMAGES, `${found.id}_photo`).catch(() => {});
  await db.del(IMAGES, `${found.id}_signature`).catch(() => {});
}

// -------------------------------------------------------------------- Excel
// Builds the workbook in memory from the database. Photos / signatures are
// fetched only for the batches that were selected.
async function buildCustomExcel(selections) {
  const wanted = new Set((selections || []).map((s) => String(s.batch)));
  const all = (await getAllStudents()).filter((s) => wanted.has(String(s.batch)));
  const withImages = [];
  for (const s of all) {
    const id = idFor(s.rollNo);
    const [p, g] = await Promise.all([
      s.photoPath ? getImage(id, 'photo') : null,
      s.signaturePath ? getImage(id, 'signature') : null,
    ]);
    withImages.push({ ...s, _photo: p, _signature: g });
  }
  return excel.buildCustomWorkbook(selections, withImages);
}

module.exports = {
  MAX_RECORD_BYTES, MAX_PHOTO_BYTES, MAX_SIGNATURE_BYTES,
  SCHOLARSHIP_VALUES, FIELD_KEYS: excel.FIELD_KEYS, COLUMN_META: excel.COLUMN_META,
  compareRollNo: excel.compareRollNo, normalizeBatch,
  idFor, findByRollNo, getAllStudents, getBatchList, searchStudents, getImage,
  addStudent, updateStudent, deleteStudent, buildCustomExcel,
};
