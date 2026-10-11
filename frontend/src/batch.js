// "24-25" / "2024-28" / "24 - 2028" -> "2024-2028". Anything else is returned trimmed.
export function normalizeBatch(value) {
  const raw = String(value ?? "").trim();
  const m = raw.match(/^(\d{2}|\d{4})\s*[-\u2013\u2014/]\s*(\d{2}|\d{4})$/);
  if (!m) return raw;
  const full = (x) => (x.length === 2 ? "20" + x : x);
  return `${full(m[1])}-${full(m[2])}`;
}
