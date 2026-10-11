import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../api";
import { IconPrinter } from "./Icons.jsx";
import StudentSheet from "./StudentSheet.jsx";

export default function PrintView() {
  const { rollNo } = useParams();
  const navigate = useNavigate();
  const [student, setStudent] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const res = await api.get(`/students/${encodeURIComponent(rollNo)}`);
        setStudent(res.data.data);
      } catch (err) {
        setError(err.response?.data?.message || "Student not found.");
      }
    }
    load();
  }, [rollNo]);

  async function printAll() {
    await Promise.all(Array.from(document.images).map((img) => img.decode().catch(() => {})));
    window.print();
  }

  if (error) {
    return (
      <div className="print-error">
        <p>{error}</p>
        <button onClick={() => navigate(-1)} className="btn-secondary no-print">
          Go Back
        </button>
      </div>
    );
  }

  if (!student) {
    return <div className="print-loading">Loading student record...</div>;
  }

  return (
    <div className="print-page">
      <div className="no-print print-toolbar">
        <button onClick={() => navigate(-1)} className="btn-secondary">
          ← Back
        </button>
        <button onClick={printAll} className="btn-primary print-btn-right">
          <IconPrinter /> Print / Save PDF (A4)
        </button>
      </div>

      <StudentSheet student={student} />
    </div>
  );
}
