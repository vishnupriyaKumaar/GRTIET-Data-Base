// Company eligibility filter.
//
// Every criterion is optional. A criterion looks like:
//   { op: "gt" | "gte" | "lt" | "lte" | "eq" | "between", a: <number>, b: <number> }
// "between" is inclusive (a <= value <= b). `b` is only used by "between".
// A criterion with no operator, or with no usable number, is ignored.
//
// Fields:  tenth (SSLC %), twelfth (HSC %), cutOff, cgpa, arrears
// Arrears take an extra `mode`:
//   "standing" (default) - subjects that are still pending (Current arrears, or past arrears "Still Not Cleared")
//   "all"                - every arrear subject ever recorded, cleared or not
//
// A student who has no value for a field that is being filtered (for example a
// diploma student with no HSC mark) is NOT eligible for that criterion, because
// the condition cannot be verified.

const OPS = ["gt", "gte", "lt", "lte", "eq", "between"];
const FIELDS = ["tenth", "twelfth", "cutOff", "cgpa", "arrears"];

function toNumber(v) {
  if (v === null || v === undefined) return null;
  if (typeof v === "string" && v.trim() === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

// Cleans whatever the browser sent into { field: { op, a, b, mode? } } keeping only usable criteria.
function normalizeCriteria(raw) {
  let input = raw;
  if (typeof input === "string") {
    try { input = JSON.parse(input); } catch { input = {}; }
  }
  if (!input || typeof input !== "object") input = {};
  const out = {};
  for (const field of FIELDS) {
    const c = input[field];
    if (!c || !OPS.includes(c.op)) continue;
    const a = toNumber(c.a);
    const b = toNumber(c.b);
    if (a === null) continue;
    if (c.op === "between") {
      if (b === null) continue;
      out[field] = { op: "between", a: Math.min(a, b), b: Math.max(a, b) };
    } else {
      out[field] = { op: c.op, a };
    }
    if (field === "arrears") out[field].mode = c.mode === "all" ? "all" : "standing";
  }
  return out;
}

function matches(value, { op, a, b }) {
  switch (op) {
    case "gt": return value > a;
    case "gte": return value >= a;
    case "lt": return value < a;
    case "lte": return value <= a;
    case "eq": return value === a;
    case "between": return value >= a && value <= b;
    default: return true;
  }
}

// Number of arrear subjects for a student.
function countArrears(student, mode) {
  const records = Array.isArray(student.arrears) ? student.arrears : [];
  if (student.arrearStatus === "NA" || !records.length) return 0;
  const subjectCount = (r) => (Array.isArray(r.subjects) ? r.subjects.length : 0);
  if (student.arrearStatus === "Current") return records.reduce((n, r) => n + subjectCount(r), 0);
  if (mode === "all") return records.reduce((n, r) => n + subjectCount(r), 0);
  return records.filter((r) => r.clearedSem === "Not Cleared").reduce((n, r) => n + subjectCount(r), 0);
}

// The value of each filterable field for one student (null when not available).
function valueFor(student, field, criterion) {
  switch (field) {
    case "tenth": return toNumber(student.sslc);
    case "twelfth": return toNumber(student.hsc);
    case "cutOff": return toNumber(student.cutOff);
    case "cgpa": return toNumber(student.cgpa);
    case "arrears": return countArrears(student, criterion && criterion.mode);
    default: return null;
  }
}

function isEligible(student, criteria) {
  for (const field of Object.keys(criteria)) {
    const value = valueFor(student, field, criteria[field]);
    if (value === null) return false;
    if (!matches(value, criteria[field])) return false;
  }
  return true;
}

// Returns [{ batch, count, total, students }] ordered by batch, students ordered by roll number.
function findEligible(students, rawCriteria, { batch = "", compareRollNo } = {}) {
  const criteria = normalizeCriteria(rawCriteria);
  const sortRoll = compareRollNo || ((x, y) => String(x).localeCompare(String(y), undefined, { numeric: true }));
  const byBatch = new Map();
  const totals = new Map();
  for (const s of students) {
    const key = s.batch || "Unknown";
    if (batch && key !== batch) continue;
    totals.set(key, (totals.get(key) || 0) + 1);
    if (!isEligible(s, criteria)) continue;
    if (!byBatch.has(key)) byBatch.set(key, []);
    byBatch.get(key).push(s);
  }
  return {
    criteria,
    batches: [...totals.keys()]
      .sort()
      .map((key) => ({
        batch: key,
        total: totals.get(key),
        count: (byBatch.get(key) || []).length,
        students: (byBatch.get(key) || []).sort((x, y) => sortRoll(x.rollNo, y.rollNo)),
      })),
  };
}

module.exports = { normalizeCriteria, isEligible, countArrears, findEligible, OPS, FIELDS };
