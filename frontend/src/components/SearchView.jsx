import StudentDetails from "./StudentDetails.jsx";
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api";
import { IconSearch, IconPrinter } from "./Icons.jsx";
import SuggestSearch from "./SuggestSearch.jsx";

export default function SearchView() {
  const [rollNo, setRollNo] = useState("");
  const [student, setStudent] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  async function handleSearch(e) {
    if (e) e.preventDefault();
    await loadStudent(rollNo.trim());
  }

  async function loadStudent(value) {
    setError("");
    setStudent(null);
    if (!value) return;
    setLoading(true);
    try {
      const res = await api.get(`/students/${encodeURIComponent(value)}`);
      setStudent(res.data.data);
    } catch (err) {
      setError(err.response?.data?.message || "No student found with this Roll No.");
    } finally {
      setLoading(false);
    }
  }

  function handlePrint() {
    if (student) {
      navigate(`/print/${encodeURIComponent(student.rollNo)}`);
    }
  }

  return (
    <div>
      <h2>Search Student</h2>
      <form onSubmit={handleSearch} className="search-form">
        <SuggestSearch
          value={rollNo}
          onChange={setRollNo}
          onPick={loadStudent}
          placeholder="Enter Roll No or Name (e.g. 24CS101 / Vishnu)"
          autoFocus
        />
        <button type="submit" className="btn-primary" disabled={loading}>
          <IconSearch /> {loading ? "Searching..." : "Search"}
        </button>
      </form>

      {error && <p className="error-text">{error}</p>}

      {student && (
        <div className="student-details">
          <StudentDetails student={student} />
          <button className="btn-primary" onClick={handlePrint}>
            <IconPrinter /> Print (A4)
          </button>
        </div>
      )}
    </div>
  );
}
