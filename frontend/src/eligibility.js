// Shared helpers for the Company eligibility screens.

// Every criterion is optional. `fields` drives both the form and the text shown on the printout.
export const CRITERIA_FIELDS = [
  { key: "tenth", label: "10th Mark (%)", min: 0, max: 100, step: "any", hint: "SSLC percentage" },
  { key: "twelfth", label: "12th Mark (%)", min: 0, max: 100, step: "any", hint: "HSC percentage" },
  { key: "cutOff", label: "Cut-Off Mark", min: 0, max: 200, step: "any", hint: "out of 200" },
  { key: "cgpa", label: "CGPA", min: 0, max: 10, step: "any", hint: "latest CGPA, out of 10" },
  { key: "arrears", label: "No. of Arrears", min: 0, max: 60, step: 1, hint: "number of subjects" },
];

export const OPERATORS = [
  { value: "", label: "Not required" },
  { value: "gt", label: "Greater than ( > )", symbol: ">" },
  { value: "gte", label: "Greater than or equal ( ≥ )", symbol: "≥" },
  { value: "lt", label: "Less than ( < )", symbol: "<" },
  { value: "lte", label: "Less than or equal ( ≤ )", symbol: "≤" },
  { value: "eq", label: "Equal to ( = )", symbol: "=" },
  { value: "between", label: "Between ( from – to )", symbol: "between" },
];

export const emptyCriteria = () => ({
  tenth: { op: "", a: "", b: "" },
  twelfth: { op: "", a: "", b: "" },
  cutOff: { op: "", a: "", b: "" },
  cgpa: { op: "", a: "", b: "" },
  arrears: { op: "", a: "", b: "", mode: "standing" },
});

const filled = (v) => v !== "" && v !== null && v !== undefined && Number.isFinite(Number(v));

// True when the row has an operator and all the numbers that operator needs.
export function criterionIsComplete(c) {
  if (!c || !c.op) return false;
  return c.op === "between" ? filled(c.a) && filled(c.b) : filled(c.a);
}

// Operator chosen but a number is missing -> returns the label of the first such field.
export function firstIncomplete(criteria) {
  for (const f of CRITERIA_FIELDS) {
    const c = criteria[f.key];
    if (c && c.op && !criterionIsComplete(c)) return f.label;
  }
  return "";
}

// Only the complete criteria, in the shape the server expects.
export function toPayload(criteria) {
  const out = {};
  for (const f of CRITERIA_FIELDS) {
    const c = criteria[f.key];
    if (!criterionIsComplete(c)) continue;
    out[f.key] = c.op === "between" ? { op: c.op, a: Number(c.a), b: Number(c.b) } : { op: c.op, a: Number(c.a) };
    if (f.key === "arrears") out[f.key].mode = c.mode === "all" ? "all" : "standing";
  }
  return out;
}

// Human readable lines for a normalized criteria object ({ tenth: {op,a,b}, ... }).
export function describeCriteria(payload) {
  const lines = [];
  for (const f of CRITERIA_FIELDS) {
    const c = payload && payload[f.key];
    if (!c) continue;
    const symbol = OPERATORS.find((o) => o.value === c.op)?.symbol || c.op;
    const value = c.op === "between" ? `${c.a} to ${c.b}` : `${symbol} ${c.a}`;
    const label = f.key === "arrears" ? `No. of Arrears (${c.mode === "all" ? "all, incl. cleared" : "standing"})` : f.label;
    lines.push(`${label}: ${value}`);
  }
  return lines;
}

export function encodeCriteria(payload) {
  return encodeURIComponent(JSON.stringify(payload || {}));
}

export function decodeCriteria(text) {
  try {
    const v = JSON.parse(text || "{}");
    return v && typeof v === "object" ? v : {};
  } catch {
    return {};
  }
}

// Arrear subjects for one student, matching the server's rule.
export function arrearCount(student, mode) {
  const records = Array.isArray(student.arrears) ? student.arrears : [];
  if (student.arrearStatus === "NA" || !records.length) return 0;
  const n = (r) => (Array.isArray(r.subjects) ? r.subjects.length : 0);
  if (student.arrearStatus === "Current" || mode === "all") return records.reduce((t, r) => t + n(r), 0);
  return records.filter((r) => r.clearedSem === "Not Cleared").reduce((t, r) => t + n(r), 0);
}
