import React, { useState, useEffect, useRef } from "react";
import api from "../api";
import { IconCheck } from "./Icons.jsx";
import ImageCapture from "./ImageCapture.jsx";
import { normalizeBatch } from "../batch.js";
import { SCHOLARSHIP_OPTIONS } from "../constants.js";

import {AcademicFields,appendAcademic,initialAcademic} from "./AcademicFields.jsx";



const TRANSPORT_MODES = ["College Bus", "Out Bus"];
const MAX_PHOTO_SIZE = 24 * 1024; // 24 KB (whole student record stays under 50 KB)
const MAX_SIGNATURE_SIZE = 10 * 1024; // 10 KB
const PHOTO_TYPES = ["image/png", "image/jpeg"];

const emptyDetails = {
  name: "",
  fatherName: "",
  dob: "",
  address: "",
  fatherMobile: "",
  studentMobile: "",
  aadharCardNumber: "",
  religion: "",
  cutOff: "",
  schoolName: "",
  counselorName: "",
  sslc: "",
  hsc: "",
  diploma: "",
  cgpa: "",
  gpa: "",
  email: "",
  batch: "",
};

function calculateAge(dobString) {
  if (!dobString) return "";
  const dob = new Date(dobString);
  if (isNaN(dob.getTime())) return "";
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const m = today.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) {
    age--;
  }
  return age;
}

const CHECK_DEBOUNCE_MS = 500;

export default function StudentForm() {
  const [academic,setAcademic]=useState(initialAcademic);
  const [rollNo, setRollNo] = useState("");
  // status: 'idle' | 'checking' | 'available' | 'taken'
  const [status, setStatus] = useState("idle");
  const [existing, setExisting] = useState(null); // brief info about the existing record, if taken
  const [details, setDetails] = useState(emptyDetails);
  const [residentType, setResidentType] = useState("");
  const [transportMode, setTransportMode] = useState("");
  const [transportBoardingPoint, setTransportBoardingPoint] = useState("");
  const [admissionType, setAdmissionType] = useState("");
  const [scholarship, setScholarship] = useState("");
  const [scholarshipOther, setScholarshipOther] = useState("");
  const [community, setCommunity] = useState("");
  const [photo, setPhoto] = useState(null);
  const [photoError, setPhotoError] = useState("");
  const [photoKey, setPhotoKey] = useState(0);
  const [signature, setSignature] = useState(null);
  const [signatureError, setSignatureError] = useState("");
  const [signatureKey, setSignatureKey] = useState(0);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [saving, setSaving] = useState(false);
  const debounceRef = useRef(null);
  const requestTokenRef = useRef(0);
  // The Roll No that was last checked successfully. Used so that clicking away from
  // the Roll No box does not re-check (and momentarily hide) a form that is already open.
  const checkedRollRef = useRef("");

  const age = calculateAge(details.dob);

  async function checkRollNo(value) {
    const token = ++requestTokenRef.current;
    setStatus("checking");
    setError("");
    setSuccess("");
    try {
      const res = await api.get(`/students/check/${encodeURIComponent(value)}`);
      if (token !== requestTokenRef.current) return; // stale response
      setExisting(null);
      checkedRollRef.current = value;
      setStatus(res.data.exists?"taken":"available");
    } catch (err) {
      if (token !== requestTokenRef.current) return;
      if (err.response?.status === 404) {
        checkedRollRef.current = value;
        setStatus("available");
        setExisting(null);
      } else {
        setStatus("idle");
        setError("Could not check this Roll No. Please try again.");
      }
    }
  }

  function handleRollNoChange(e) {
    const value = e.target.value;
    ++requestTokenRef.current;
    setRollNo(value);
    checkedRollRef.current = "";
    setStatus("idle");
    setExisting(null);
    setError("");
    setSuccess("");

    if (debounceRef.current) clearTimeout(debounceRef.current);
    const trimmed = value.trim();
    if (!trimmed) return;
    debounceRef.current = setTimeout(() => checkRollNo(trimmed), CHECK_DEBOUNCE_MS);
  }

  function handleRollNoBlur() {
    const trimmed = rollNo.trim();
    if (!trimmed) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    // BUG FIX: this used to run the check again on every blur, which switched the status to
    // "checking" and hid the whole form - so clicking anywhere lower on the page made the page
    // collapse and jump back to the top. If this Roll No is already checked, do nothing.
    if (checkedRollRef.current === trimmed && (status === "available" || status === "taken")) return;
    checkRollNo(trimmed);
  }

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  function handleDetailChange(e) {
    const { name, value } = e.target;
    setDetails((d) => ({ ...d, [name]: value }));
  }

  function toggleResidentType(value) {
    setResidentType((prev) => (prev === value ? "" : value));
    if (value !== "Day Scholar") {
      setTransportMode("");
      setTransportBoardingPoint("");
    }
  }

  function chooseTransportMode(value) {
    setTransportMode((prev) => (prev === value ? "" : value));
    setTransportBoardingPoint("");
  }

  function toggleAdmissionType(value) {
    setAdmissionType((prev) => (prev === value ? "" : value));
  }


  function resetAll() {
    setPhoto(null);
    setPhotoError("");
    setPhotoKey((k) => k + 1);
    setSignature(null);
    setSignatureError("");
    setSignatureKey((k) => k + 1);
    setRollNo("");
    checkedRollRef.current = "";
    setStatus("idle");
    setExisting(null);
    setDetails(emptyDetails);
    setAcademic(initialAcademic());
    setResidentType("");
    setTransportMode("");
    setTransportBoardingPoint("");
    setAdmissionType("");
    setScholarship("");
    setScholarshipOther("");
    setCommunity("");
    setError("");
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (status !== "available") return;
    setError("");
    setSuccess("");

    if (!residentType) {
      setError('Please select either "Day Scholar" or "Hostler".');
      return;
    }
    if (residentType === "Day Scholar" && !transportMode) {
      setError('Please select either "College Bus" or "Out Bus".');
      return;
    }
    if (residentType === "Day Scholar" && transportMode === "College Bus" && !transportBoardingPoint.trim()) {
      setError("Please enter the Transport Boarding Point for the College Bus student.");
      return;
    }
    if (!admissionType) {
      setError('Please select either "Counselling" or "Management".');
      return;
    }
    if (!scholarship) {
      setError("Please select a Scholarship.");
      return;
    }
    if (scholarship === "Other" && !scholarshipOther.trim()) {
      setError("Please enter which Scholarship.");
      return;
    }
    if (!community.trim()) {
      setError("Please enter Community.");
      return;
    }

    setSaving(true);
    try {
      const formData = new FormData();
      formData.append("rollNo", rollNo.trim());
      Object.entries({ ...details, batch: normalizeBatch(details.batch) }).forEach(([key, value]) => formData.append(key, value ?? ""));
      formData.append("residentType", residentType);
      formData.append("transportMode", residentType === "Day Scholar" ? transportMode : "");
      formData.append(
        "transportBoardingPoint",
        residentType === "Day Scholar" && transportMode === "College Bus" ? transportBoardingPoint.trim() : ""
      );
      formData.append("admissionType", admissionType);
      formData.append("scholarship", scholarship);
      formData.append("scholarshipOther", scholarship === "Other" ? scholarshipOther.trim() : "");
      formData.append("community", community.trim());
      if (photo) formData.append("photo", photo);
      if (signature) formData.append("signature", signature);
      appendAcademic(formData,academic);
      await api.post("/students", formData);
      setSuccess(`Saved — Roll No ${rollNo.trim()} added under Batch ${normalizeBatch(details.batch)}.`);
      resetAll();
    } catch (err) {
      if (err.response?.status === 409) {
        // Race condition: became taken between the check and submit.
        setStatus("taken");
      }
      setError(err.response?.data?.message || "Could not save student record.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <h2>Add New Student</h2>

      <div className="form-field rollno-field">
        <label htmlFor="rollNo">Roll No</label>
        <input
          id="rollNo"
          value={rollNo}
          onChange={handleRollNoChange}
          onBlur={handleRollNoBlur}
          placeholder="e.g. 24CS101"
          autoFocus
          required
        />
        {status === "checking" && <p className="hint-text">Checking...</p>}
      </div>

      {status === "taken" && (
        <div className="already-applied-banner">
          <strong>Already Entered</strong>
        </div>
      )}

      {status === "available" && (
        <form onSubmit={handleSubmit} className="student-form">
          <p className="success-text rollno-available-text">Roll No is available — fill in the details below.</p>

          <h3 className="form-section-label">Personal Details</h3>
          <div className="form-grid">
            <div className="form-field">
              <label htmlFor="name">Name</label>
              <input id="name" name="name" value={details.name} onChange={handleDetailChange} placeholder="Full name" required />
            </div>

            <div className="form-field">
              <label htmlFor="fatherName">Father Name</label>
              <input id="fatherName" name="fatherName" value={details.fatherName} onChange={handleDetailChange} placeholder="Father's name" required />
            </div>

            <div className="form-field">
              <label htmlFor="dob">Date of Birth</label>
              <input id="dob" name="dob" type="date" value={details.dob} onChange={handleDetailChange} required />
            </div>

            <div className="form-field">
              <label htmlFor="age">Age (auto-calculated)</label>
              <input id="age" value={age} readOnly disabled placeholder="—" />
            </div>

            <div className="form-field form-field-full">
              <label htmlFor="address">Address</label>
              <textarea id="address" name="address" value={details.address} onChange={handleDetailChange} placeholder="Full address" rows={3} required />
            </div>

            <div className="form-field">
              <label htmlFor="religion">Religion</label>
              <input id="religion" name="religion" value={details.religion} onChange={handleDetailChange} placeholder="e.g. Hindu / Christian / Muslim" required />
            </div>

            <div className="form-field">
              <label htmlFor="community">Community</label>
              <input
                id="community"
                value={community}
                onChange={(e) => setCommunity(e.target.value)}
                placeholder="e.g. OC / BC / MBC / SC / ST"
                required
              />
            </div>
          </div>

          <h3 className="form-section-label">Contact Details</h3>
          <div className="form-grid">
            <div className="form-field">
              <label htmlFor="fatherMobile">Father Mobile Number</label>
              <input id="fatherMobile" name="fatherMobile" value={details.fatherMobile} onChange={handleDetailChange} placeholder="10-digit number" required />
            </div>

            <div className="form-field">
              <label htmlFor="studentMobile">Student Mobile Number</label>
              <input id="studentMobile" name="studentMobile" value={details.studentMobile} onChange={handleDetailChange} placeholder="10-digit number" required />
            </div>

            <div className="form-field">
              <label htmlFor="aadharCardNumber">Aadhar Card Number</label>
              <input id="aadharCardNumber" name="aadharCardNumber" value={details.aadharCardNumber} onChange={handleDetailChange} placeholder="12-digit Aadhar number" inputMode="numeric" pattern="[0-9 ]{12,14}" maxLength={14} required />
            </div>

            <div className="form-field">
              <label htmlFor="email">Student Mail ID</label>
              <input id="email" name="email" type="email" value={details.email} onChange={handleDetailChange} placeholder="student@example.com" required />
            </div>

            <div className="form-field">
              <label htmlFor="batch">Batch</label>
              <input id="batch" name="batch" value={details.batch} onChange={handleDetailChange} onBlur={() => setDetails((d) => ({ ...d, batch: normalizeBatch(d.batch) }))} placeholder="e.g. 2024-2028 (or 24-28)" required />
            </div>
          </div>

          <h3 className="form-section-label">Academic Records</h3>
          <div className="form-grid">
            <div className="form-field">
              <label htmlFor="sslc">SSLC (%)</label>
              <input id="sslc" name="sslc" value={details.sslc} onChange={handleDetailChange} placeholder="e.g. 92" required />
            </div>

            <div className="form-field">
              <label htmlFor="hsc">HSC (%)</label>
              <input id="hsc" name="hsc" value={details.hsc} onChange={handleDetailChange} placeholder="e.g. 88 (if applicable)" />
            </div>

            <div className="form-field">
              <label htmlFor="diploma">DIPLOMA (%)</label>
              <input id="diploma" name="diploma" value={details.diploma} onChange={handleDetailChange} placeholder="if applicable" />
            </div>

            <div className="form-field">
              <label htmlFor="cutOff">Cut-Off Mark</label>
              <input id="cutOff" name="cutOff" value={details.cutOff} onChange={handleDetailChange} placeholder="e.g. 185.5" inputMode="decimal" required />
            </div>

            <div className="form-field">
              <label htmlFor="schoolName">School Name</label>
              <input id="schoolName" name="schoolName" value={details.schoolName} onChange={handleDetailChange} placeholder="School studied in (12th / 10th)" required />
            </div>


          </div>

          <AcademicFields value={academic} onChange={setAcademic}/>
          <h3 className="form-section-label">Residency &amp; Admission</h3>
          <div className="form-grid">
            <div className="form-field">
              <label>Day Scholar / Hostler</label>
              <div className="checkbox-row">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={residentType === "Day Scholar"}
                    onChange={() => toggleResidentType("Day Scholar")}
                  />
                  Day Scholar
                </label>
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={residentType === "Hostler"}
                    onChange={() => toggleResidentType("Hostler")}
                  />
                  Hostler
                </label>
              </div>
            </div>

            {residentType === "Day Scholar" && (
              <div className="form-field">
                <label>College Bus / Out Bus</label>
                <div className="checkbox-row">
                  {TRANSPORT_MODES.map((m) => (
                    <label className="checkbox-label" key={m}>
                      <input type="checkbox" checked={transportMode === m} onChange={() => chooseTransportMode(m)} />
                      {m}
                    </label>
                  ))}
                </div>
              </div>
            )}

            {residentType === "Day Scholar" && transportMode === "College Bus" && (
              <div className="form-field">
                <label htmlFor="transportBoardingPoint">Transport Boarding Point</label>
                <input
                  id="transportBoardingPoint"
                  value={transportBoardingPoint}
                  onChange={(e) => setTransportBoardingPoint(e.target.value)}
                  placeholder="e.g. Tiruttani Bus Stand"
                  required
                />
              </div>
            )}

            <div className="form-field">
              <label>Counselling / Management</label>
              <div className="checkbox-row">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={admissionType === "Counselling"}
                    onChange={() => toggleAdmissionType("Counselling")}
                  />
                  Counselling
                </label>
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={admissionType === "Management"}
                    onChange={() => toggleAdmissionType("Management")}
                  />
                  Management
                </label>
              </div>
            </div>

            <div className="form-field">
              <label htmlFor="counselorName">Counselor Name</label>
              <input id="counselorName" name="counselorName" value={details.counselorName} onChange={handleDetailChange} placeholder="Name of the counselor" />
            </div>

            <div className="form-field">
              <label htmlFor="scholarship">Scholarship</label>
              <select id="scholarship" name="scholarship" value={scholarship} onChange={(e) => { setScholarship(e.target.value); if (e.target.value !== "Other") setScholarshipOther(""); }}>
                <option value="">-- Select Scholarship --</option>
                {SCHOLARSHIP_OPTIONS.map((o) => (
                  <option key={o} value={o}>{o}</option>
                ))}
              </select>
            </div>

            {scholarship === "Other" && (
              <div className="form-field">
                <label htmlFor="scholarshipOther">Which Scholarship?</label>
                <input
                  id="scholarshipOther"
                  value={scholarshipOther}
                  onChange={(e) => setScholarshipOther(e.target.value)}
                  placeholder="Enter the scholarship name"
                  required
                />
              </div>
            )}
          </div>

          <h3 className="form-section-label">Student Photo (optional)</h3>
          <div className="form-grid">
            <div className="form-field form-field-full">
              <ImageCapture id="photo" label="Photo" kind="photo" value={photo} onChange={setPhoto} maxBytes={MAX_PHOTO_SIZE} />
            </div>
          </div>

          <h3 className="form-section-label">Student Signature (optional)</h3>
          <div className="form-grid">
            <div className="form-field form-field-full">
              <ImageCapture id="signature" label="Signature" kind="signature" value={signature} onChange={setSignature} maxBytes={MAX_SIGNATURE_SIZE} />
            </div>
          </div>


          {error && <p className="error-text">{error}</p>}
          {success && <p className="success-text">{success}</p>}

          <button type="submit" className="btn-primary" disabled={saving}>
            <IconCheck /> {saving ? "Saving..." : "Save to Excel Sheet"}
          </button>
        </form>
      )}

      {status === "idle" && error && <p className="error-text">{error}</p>}
      {status === "idle" && success && <p className="success-text">{success}</p>}
    </div>
  );
}
