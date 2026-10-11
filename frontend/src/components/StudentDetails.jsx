import React from "react";
import { AcademicSummary } from "./AcademicFields.jsx";

export function DetailRow({ label, value, full }) {
  return (
    <div className={full ? "detail-row detail-row-full" : "detail-row"}>
      <span className="detail-label">{label}</span>
      <span className="detail-value">{value === "" || value == null ? "—" : value}</span>
    </div>
  );
}

// Complete read-only record of one student (photo, signature, every field, academic history).
export default function StudentDetails({ student }) {
  return (
    <>
      <div className="student-summary-row">
        <div className="student-photo-stack">
          <div className="student-photo-box">
            {student.photoPath ? (
              <img src={student.photoPath} alt="Student" className="student-photo-img" />
            ) : (
              <div className="student-photo-placeholder">No Photo</div>
            )}
          </div>
          <div className="student-signature-box">
            {student.signaturePath ? (
              <img src={student.signaturePath} alt="Student Signature" className="student-signature-img" />
            ) : (
              <div className="student-signature-placeholder">No Signature</div>
            )}
          </div>
        </div>

        <div className="details-grid">
          <DetailRow label="Roll No" value={student.rollNo} />
          <DetailRow label="Name" value={student.name} />
          <DetailRow label="Father Name" value={student.fatherName} />
          <DetailRow label="Date of Birth" value={student.dob} />
          <DetailRow label="Age" value={student.age} />
          <DetailRow label="Religion" value={student.religion} />
          <DetailRow label="Community" value={student.community} />
          <DetailRow label="Father Mobile Number" value={student.fatherMobile} />
          <DetailRow label="Student Mobile Number" value={student.studentMobile} />
          <DetailRow label="Aadhar Card Number" value={student.aadharCardNumber} />
          <DetailRow label="SSLC (%)" value={student.sslc} />
          <DetailRow label="HSC (%)" value={student.hsc} />
          <DetailRow label="DIPLOMA (%)" value={student.diploma} />
          <DetailRow label="Cut-Off Mark" value={student.cutOff} />
          <DetailRow label="School Name" value={student.schoolName} />
          <DetailRow label="CGPA" value={student.cgpa} />
          <DetailRow label="GPA" value={student.gpa} />
          <DetailRow label="Student Mail ID" value={student.email} />
          <DetailRow label="Batch" value={student.batch} />
          <DetailRow label="Day Scholar / Hostler" value={student.residentType} />
          {student.residentType === "Day Scholar" && (
            <DetailRow label="College Bus / Out Bus" value={student.transportMode} />
          )}
          {student.residentType === "Day Scholar" && student.transportMode === "College Bus" && (
            <DetailRow label="Transport Boarding Point" value={student.transportBoardingPoint} />
          )}
          <DetailRow label="Counselling / Management" value={student.admissionType} />
          <DetailRow
            label="Scholarship"
            value={student.scholarship === "Other" ? `Other - ${student.scholarshipOther || ""}` : student.scholarship}
          />
          <DetailRow label="Counselor Name" value={student.counselorName} />
          <DetailRow label="Address" value={student.address} full />
          <DetailRow label="Registered On" value={student.createdAt} />
          <DetailRow label="Last Updated" value={student.updatedAt} />
        </div>
      </div>

      <AcademicSummary student={student} />
    </>
  );
}
