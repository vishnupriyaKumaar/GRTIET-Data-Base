import React, { useEffect, useState } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import api from "../api";
import { IconPrinter, IconPencil, IconArrowLeft } from "./Icons.jsx";
import StudentDetails from "./StudentDetails.jsx";

// Separate page that shows only one student's details (opened from Update > View).
export default function StudentView() {
  const { rollNo } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [student, setStudent] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    setStudent(null);
    setError("");
    window.scrollTo(0, 0);
    api
      .get(`/students/${encodeURIComponent(rollNo)}`)
      .then((res) => alive && setStudent(res.data.data))
      .catch((err) => alive && setError(err.response?.data?.message || "Student not found."));
    return () => {
      alive = false;
    };
  }, [rollNo]);

  // location.key is "default" when this page was opened directly (no page to go back to).
  const goBack = () => (location.key === "default" ? navigate("/") : navigate(-1));

  return (
    <div className="card dashboard-card student-view-card">
      <div className="student-view-actions">
        <button type="button" className="btn-secondary" onClick={goBack}>
          <IconArrowLeft /> Back
        </button>
        {student && (
          <div className="student-view-actions-right">
            <button
              type="button"
              className="btn-secondary"
              onClick={() => navigate("/", { state: { editRoll: student.rollNo } })}
            >
              <IconPencil /> Edit
            </button>
            <button
              type="button"
              className="btn-primary"
              onClick={() => navigate(`/print/${encodeURIComponent(student.rollNo)}`)}
            >
              <IconPrinter /> Print (A4)
            </button>
          </div>
        )}
      </div>

      <h2>Student Details</h2>
      {error && <p className="error-text">{error}</p>}
      {!student && !error && <p className="hint-text">Loading student record...</p>}
      {student && <StudentDetails student={student} />}
    </div>
  );
}
