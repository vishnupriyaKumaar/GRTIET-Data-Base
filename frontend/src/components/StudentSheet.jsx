import React from "react";
import { AcademicSummary } from "./AcademicFields.jsx";

// One A4 "Student Information Record" sheet. Used by the single-student print page
// and by the Company batch printout (one sheet per student).
export default function StudentSheet({ student }) {
  const rows = [
    ["Roll No", student.rollNo],
    ["Name", student.name],
    ["Father Name", student.fatherName],
    ["Date of Birth", student.dob],
    ["Age", student.age],
    ["Address", student.address],
    ["Religion", student.religion || "—"],
    ["Community", student.community || "—"],
    ["Father Mobile Number", student.fatherMobile],
    ["Student Mobile Number", student.studentMobile],
    ["Aadhar Card Number", student.aadharCardNumber || "—"],
    ["SSLC (%)", student.sslc],
    ["HSC (%)", student.hsc || "—"],
    ["DIPLOMA (%)", student.diploma || "—"],
    ["Cut-Off Mark", student.cutOff || "—"],
    ["School Name", student.schoolName || "—"],
    ["CGPA", student.cgpa ?? "—"],
    ["GPA", student.gpa ?? "—"],
    ["Student Mail ID", student.email],
    ["Batch", student.batch],
    ["Day Scholar / Hostler", student.residentType || "—"],
    ["College Bus / Out Bus", student.residentType === "Day Scholar" ? student.transportMode || "—" : "—"],
    [
      "Transport Boarding Point",
      student.residentType === "Day Scholar" && student.transportMode === "College Bus"
        ? student.transportBoardingPoint || "—"
        : "—",
    ],
    ["Counselling / Management", student.admissionType || "—"],
    ["Counselor Name", student.counselorName || "—"],
    [
      "Scholarship",
      student.scholarship === "Other" ? `Other - ${student.scholarshipOther || "—"}` : student.scholarship || "—",
    ],
    ["Registered On", student.createdAt],
    ["Last Updated", student.updatedAt || "—"],
  ];

  return (
    <div className="print-sheet">
      <div className="print-photo-box">
        {student.photoPath ? (
          <img src={student.photoPath} alt="Student" className="print-photo-img" />
        ) : (
          <div className="print-photo-placeholder">Photo</div>
        )}
      </div>

      <header className="print-header">
        <img
          src="/logo.png"
          alt="GRT Institute of Engineering and Technology, Tiruttani"
          className="print-logo"
        />
        <h2 className="print-header-title">Student Information Record</h2>
      </header>

      <table className="print-table">
        <tbody>
          {rows.map(([label, value]) => (
            <tr key={label}>
              <th>{label}</th>
              <td>{value ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <AcademicSummary student={student} />
      <div className="print-signature-row">
        <div className="signature-block">
          {student.signaturePath ? (
            <img src={student.signaturePath} alt="Student Signature" className="signature-img" />
          ) : (
            <div className="signature-line" />
          )}
          <p>Student Signature</p>
        </div>
        <div className="signature-block">
          <div className="signature-line" />
          <p>Authorized Signature</p>
        </div>
      </div>

      <footer className="print-footer">
        <p>&copy; CopyRight - Department of Computer Science (Batch 2024-2028)</p>
        <p className="print-made-by">Made By The Team OTC</p>
      </footer>
    </div>
  );
}
