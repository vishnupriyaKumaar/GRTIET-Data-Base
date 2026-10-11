import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api";
import { IconSearch } from "./Icons.jsx";
import {
  CRITERIA_FIELDS,
  OPERATORS,
  emptyCriteria,
  firstIncomplete,
  toPayload,
  describeCriteria,
  encodeCriteria,
} from "../eligibility.js";

const STORE_KEY = "grt_company_search";

function loadSaved() {
  try {
    const saved = JSON.parse(sessionStorage.getItem(STORE_KEY) || "null");
    if (saved && saved.criteria) return saved;
  } catch {}
  return null;
}

// Company section: enter any combination of (optional) criteria, then see which
// students are eligible, batch by batch. Clicking a batch opens its printable list.
export default function CompanyView() {
  const navigate = useNavigate();
  const saved = useRef(loadSaved()).current;
  const [company, setCompany] = useState(saved?.company || "");
  const [criteria, setCriteria] = useState(saved?.criteria || emptyCriteria());
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function runSearch(companyName, crit) {
    const missing = firstIncomplete(crit);
    if (missing) {
      setError(`Please enter the value(s) for "${missing}" or set it to "Not required".`);
      return;
    }
    setError("");
    setLoading(true);
    try {
      const payload = toPayload(crit);
      const res = await api.get("/students/eligible", { params: { c: JSON.stringify(payload) } });
      setResult({ ...res.data.data, payload });
      try {
        sessionStorage.setItem(STORE_KEY, JSON.stringify({ company: companyName, criteria: crit, searched: true }));
      } catch {}
    } catch (err) {
      setResult(null);
      setError(err.response?.data?.message || "Could not find eligible students.");
    } finally {
      setLoading(false);
    }
  }

  // Coming back from a batch printout: show the same results again.
  useEffect(() => {
    if (saved?.searched) runSearch(saved.company || "", saved.criteria);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function setField(key, patch) {
    setCriteria((c) => ({ ...c, [key]: { ...c[key], ...patch } }));
  }

  function handleSubmit(e) {
    e.preventDefault();
    runSearch(company, criteria);
  }

  function handleClear() {
    setCompany("");
    setCriteria(emptyCriteria());
    setResult(null);
    setError("");
    try {
      sessionStorage.removeItem(STORE_KEY);
    } catch {}
  }

  function openBatch(batch) {
    const params = new URLSearchParams();
    params.set("c", JSON.stringify(result.payload));
    if (company.trim()) params.set("company", company.trim());
    navigate(`/company/batch/${encodeURIComponent(batch)}?${params.toString()}`);
  }

  const lines = result ? describeCriteria(result.payload) : [];

  return (
    <div>
      <h2>Company Eligibility</h2>
      <p className="hint-text">
        Every field below is optional. Leave a field as &ldquo;Not required&rdquo; to ignore it. Students who have no
        value for a field you are filtering on (for example no 12th mark) are not counted as eligible.
      </p>

      <form onSubmit={handleSubmit} className="company-form">
        <div className="form-field company-name-field">
          <label htmlFor="companyName">Company Name (optional)</label>
          <input
            id="companyName"
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            placeholder="e.g. Zoho, TCS, Infosys"
            maxLength={120}
          />
        </div>

        <div className="criteria-list">
          {CRITERIA_FIELDS.map((f) => {
            const c = criteria[f.key];
            const between = c.op === "between";
            return (
              <div className="criteria-row" key={f.key}>
                <div className="criteria-label">
                  <span>{f.label}</span>
                  <small>{f.hint}</small>
                </div>

                <select
                  aria-label={`${f.label} condition`}
                  value={c.op}
                  onChange={(e) => setField(f.key, { op: e.target.value, ...(e.target.value ? {} : { a: "", b: "" }) })}
                >
                  {OPERATORS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>

                <div className="criteria-values">
                  {c.op && (
                    <input
                      type="number"
                      inputMode="decimal"
                      aria-label={between ? `${f.label} from` : `${f.label} value`}
                      placeholder={between ? "From" : "Value"}
                      min={f.min}
                      max={f.max}
                      step={f.step}
                      value={c.a}
                      onChange={(e) => setField(f.key, { a: e.target.value })}
                    />
                  )}
                  {between && (
                    <>
                      <span className="criteria-to">to</span>
                      <input
                        type="number"
                        inputMode="decimal"
                        aria-label={`${f.label} to`}
                        placeholder="To"
                        min={f.min}
                        max={f.max}
                        step={f.step}
                        value={c.b}
                        onChange={(e) => setField(f.key, { b: e.target.value })}
                      />
                    </>
                  )}
                  {!c.op && <span className="criteria-off">—</span>}
                </div>

                {f.key === "arrears" && c.op && (
                  <div className="criteria-extra">
                    <label className="criteria-radio">
                      <input
                        type="radio"
                        name="arrearMode"
                        checked={c.mode !== "all"}
                        onChange={() => setField("arrears", { mode: "standing" })}
                      />
                      Standing arrears only (not cleared)
                    </label>
                    <label className="criteria-radio">
                      <input
                        type="radio"
                        name="arrearMode"
                        checked={c.mode === "all"}
                        onChange={() => setField("arrears", { mode: "all" })}
                      />
                      All arrears (including cleared)
                    </label>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {error && <p className="error-text">{error}</p>}

        <div className="company-actions">
          <button type="submit" className="btn-primary" disabled={loading}>
            <IconSearch /> {loading ? "Finding..." : "Find Eligible Students"}
          </button>
          <button type="button" className="btn-secondary" onClick={handleClear}>
            Clear
          </button>
        </div>
      </form>

      {result && (
        <div className="company-results">
          <h3 className="form-section-label">
            {company.trim() ? `${company.trim()} — ` : ""}Eligible students by batch
          </h3>
          <p className="hint-text">
            {lines.length ? `Criteria: ${lines.join("  ·  ")}` : "No criteria set — every student is shown as eligible."}
          </p>
          <p className="company-total">
            <strong>{result.eligibleTotal}</strong> eligible out of {result.studentTotal} student(s)
          </p>

          {result.batches.length === 0 ? (
            <p className="hint-text">No students have been added yet.</p>
          ) : (
            <div className="batch-card-grid">
              {result.batches.map((b) => (
                <button
                  type="button"
                  key={b.batch}
                  className={b.count ? "batch-card" : "batch-card batch-card-empty"}
                  disabled={!b.count}
                  onClick={() => openBatch(b.batch)}
                  title={b.count ? "Open the complete details and print" : "No eligible students in this batch"}
                >
                  <span className="batch-card-name">Batch {b.batch}</span>
                  <span className="batch-card-count">{b.count}</span>
                  <span className="batch-card-sub">
                    {b.count ? `eligible of ${b.total} student(s)` : `No eligible student (of ${b.total})`}
                  </span>
                  {b.count > 0 && <span className="batch-card-open">View details &amp; print →</span>}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
