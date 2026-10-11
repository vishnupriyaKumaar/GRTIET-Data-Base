import React, { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate, useSearchParams, useLocation } from "react-router-dom";
import api from "../api";
import { IconPrinter } from "./Icons.jsx";
import StudentSheet from "./StudentSheet.jsx";
import { describeCriteria, decodeCriteria, arrearCount } from "../eligibility.js";

// Printable list for one batch: a summary page followed by the complete record of every eligible student.
export default function CompanyBatch() {
  const { batch } = useParams();
  const [query] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const criteriaText = query.get("c") || "{}";
  const company = query.get("company") || "";
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [fullRecords, setFullRecords] = useState(true);

  useEffect(() => {
    let alive = true;
    setData(null);
    setError("");
    api
      .get("/students/eligible", { params: { c: criteriaText, batch } })
      .then((res) => {
        if (!alive) return;
        const found = res.data.data.batches.find((b) => b.batch === batch);
        setData({ criteria: res.data.data.criteria, students: found ? found.students : [], total: found ? found.total : 0 });
      })
      .catch((err) => alive && setError(err.response?.data?.message || "Could not load this batch."));
    return () => {
      alive = false;
    };
  }, [batch, criteriaText]);

  const arrearMode = useMemo(() => decodeCriteria(criteriaText).arrears?.mode || "standing", [criteriaText]);
  const goBack = () => (location.key === "default" ? navigate("/") : navigate(-1));

  async function printAll() {
    await Promise.all(Array.from(document.images).map((img) => img.decode().catch(() => {})));
    window.print();
  }

  if (error) {
    return (
      <div className="print-error">
        <p>{error}</p>
        <button onClick={goBack} className="btn-secondary no-print">
          Go Back
        </button>
      </div>
    );
  }
  if (!data) return <div className="print-loading">Loading eligible students...</div>;

  const lines = describeCriteria(data.criteria);

  return (
    <div className="print-page">
      <div className="no-print print-toolbar">
        <button onClick={goBack} className="btn-secondary">
          ← Back
        </button>
        <label className="batch-toggle">
          <input type="checkbox" checked={fullRecords} onChange={(e) => setFullRecords(e.target.checked)} />
          Include complete record of every student
        </label>
        <button onClick={printAll} className="btn-primary print-btn-right" disabled={!data.students.length}>
          <IconPrinter /> Print / Save PDF (A4)
        </button>
      </div>

      <div className="print-sheet company-summary-sheet">
        <header className="print-header">
          <img src="/logo.png" alt="GRT Institute of Engineering and Technology, Tiruttani" className="print-logo" />
          <h2 className="print-header-title">
            {company ? `${company} — ` : ""}Eligible Students · Batch {batch}
          </h2>
        </header>

        <table className="print-table company-meta-table">
          <tbody>
            {company && (
              <tr>
                <th>Company</th>
                <td>{company}</td>
              </tr>
            )}
            <tr>
              <th>Batch</th>
              <td>{batch}</td>
            </tr>
            <tr>
              <th>Criteria</th>
              <td>{lines.length ? lines.map((l) => <div key={l}>{l}</div>) : "None (all students)"}</td>
            </tr>
            <tr>
              <th>Eligible students</th>
              <td>
                {data.students.length} of {data.total}
              </td>
            </tr>
          </tbody>
        </table>

        {data.students.length === 0 ? (
          <p className="hint-text">No student in this batch matches the criteria.</p>
        ) : (
          <table className="print-table company-list-table">
            <thead>
              <tr>
                <th>S.No</th>
                <th>Roll No</th>
                <th>Name</th>
                <th>10th %</th>
                <th>12th %</th>
                <th>Cut-Off</th>
                <th>CGPA</th>
                <th>Arrears</th>
                <th>Mobile</th>
              </tr>
            </thead>
            <tbody>
              {data.students.map((s, i) => (
                <tr key={s.rollNo}>
                  <td>{i + 1}</td>
                  <td>{s.rollNo}</td>
                  <td className="company-list-name">{s.name}</td>
                  <td>{s.sslc || "—"}</td>
                  <td>{s.hsc || "—"}</td>
                  <td>{s.cutOff || "—"}</td>
                  <td>{s.cgpa === "" || s.cgpa == null ? "—" : s.cgpa}</td>
                  <td>{arrearCount(s, arrearMode)}</td>
                  <td>{s.studentMobile || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <p className="company-list-note">
          Arrears column counts {arrearMode === "all" ? "all arrear subjects (including cleared)" : "standing (not cleared) arrear subjects"}.
        </p>
      </div>

      {fullRecords &&
        data.students.map((s) => (
          <div className="batch-sheet" key={s.rollNo}>
            <StudentSheet student={s} />
          </div>
        ))}
    </div>
  );
}
