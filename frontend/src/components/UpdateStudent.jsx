import {AcademicFields,appendAcademic,initialAcademic} from "./AcademicFields.jsx";
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api";
import { IconSearch, IconCheck } from "./Icons.jsx";
import ImageCapture from "./ImageCapture.jsx";
import SuggestSearch from "./SuggestSearch.jsx";
import { normalizeBatch } from "../batch.js";
import { SCHOLARSHIP_OPTIONS } from "../constants.js";

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


const BATCH_STORE_KEY = "grt_update_batch";
const TRANSPORT_MODES = ["College Bus", "Out Bus"];
const MAX_PHOTO_SIZE = 24 * 1024; // 24 KB (whole student record stays under 50 KB)
const MAX_SIGNATURE_SIZE = 10 * 1024; // 10 KB
const PHOTO_TYPES = ["image/png", "image/jpeg"];

const EDITABLE_FIELDS = [
  { key: "name", label: "Name", type: "text", required: true },
  { key: "fatherName", label: "Father Name", type: "text", required: true },
  { key: "dob", label: "Date of Birth", type: "date", required: true },
  { key: "address", label: "Address", type: "textarea", required: true },
  { key: "fatherMobile", label: "Father Mobile Number", type: "text", required: true },
  { key: "studentMobile", label: "Student Mobile Number", type: "text", required: true },
  { key: "aadharCardNumber", label: "Aadhar Card Number", type: "text", required: true },
  { key: "religion", label: "Religion", type: "text", required: true },
  { key: "cutOff", label: "Cut-Off Mark", type: "text", required: true },
  { key: "schoolName", label: "School Name", type: "text", required: true },
  { key: "counselorName", label: "Counselor Name", type: "text", required: false },
  { key: "sslc", label: "SSLC (%)", type: "text", required: true },
  { key: "hsc", label: "HSC (%)", type: "text", required: false },
  { key: "diploma", label: "DIPLOMA (%)", type: "text", required: false },
  { key: "cgpa", label: "CGPA", type: "text", required: false },
  { key: "gpa", label: "GPA", type: "text", required: false },
  { key: "email", label: "Student Mail ID", type: "email", required: true },
  { key: "batch", label: "Batch", type: "text", required: true },
  { key: "community", label: "Community", type: "text", required: true },
];

export default function UpdateStudent({ initialRoll = "" }) {
  const navigate = useNavigate();
  const [rollNo, setRollNo] = useState("");
  const [student, setStudent] = useState(null);
  const [form, setForm] = useState(null);
  const [photo, setPhoto] = useState(null);
  const [photoError, setPhotoError] = useState("");
  const [photoKey, setPhotoKey] = useState(0);
  const [signature, setSignature] = useState(null);
  const [signatureError, setSignatureError] = useState("");
  const [signatureKey, setSignatureKey] = useState(0);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [batches, setBatches] = useState([]);
  const [batch, setBatch] = useState("");
  const [batchStudents, setBatchStudents] = useState([]);
  const [batchLoading, setBatchLoading] = useState(false);

  useEffect(() => {
    api.get("/students/meta/batches")
      .then((res) => {
        const list = res.data.data || [];
        setBatches(list);
        // Coming back from the student details page: show the same batch list again.
        let saved = "";
        try { saved = sessionStorage.getItem(BATCH_STORE_KEY) || ""; } catch {}
        if (saved && list.includes(saved)) restoreBatch(saved);
      })
      .catch(() => setBatches([]));
    // "Edit" on the details page: open that student's edit form straight away.
    if (initialRoll) loadStudent(initialRoll);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function restoreBatch(value) {
    setBatch(value);
    setBatchLoading(true);
    try {
      const res = await api.get("/students/search", { params: { batch: value } });
      setBatchStudents(res.data.data || []);
    } catch (e) {
      setBatchStudents([]);
    } finally {
      setBatchLoading(false);
    }
  }

  async function handleBatchChange(value) {
    try { sessionStorage.setItem(BATCH_STORE_KEY, value); } catch {}
    setBatch(value);
    setBatchStudents([]);
    setError("");
    setSuccess("");
    setStudent(null);
    setForm(null);
    if (!value) return;
    setBatchLoading(true);
    try {
      const res = await api.get("/students/search", { params: { batch: value } });
      setBatchStudents(res.data.data || []);
    } catch (err) {
      setError(err.response?.data?.message || "Could not load the students of this batch.");
    } finally {
      setBatchLoading(false);
    }
  }

  async function handleSearch(e) {
    if (e) e.preventDefault();
    await loadStudent(rollNo.trim());
  }

  // Loads one student into the edit form (used by Search, suggestions and the batch grid "View").
  async function loadStudent(value) {
    setError("");
    setSuccess("");
    setStudent(null);
    setForm(null);
    if (!value) return;
    setLoading(true);
    try {
      const res = await api.get(`/students/${encodeURIComponent(value)}`);
      setStudent(res.data.data);
      setForm({ ...initialAcademic(), ...res.data.data });
      setTimeout(() => document.querySelector(".update-form")?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
    } catch (err) {
      setError(err.response?.data?.message || "No student found with this Roll No.");
    } finally {
      setLoading(false);
    }
  }

  async function handleBatchRefresh() {
    try {
      const res = await api.get("/students/search", { params: { batch } });
      setBatchStudents(res.data.data || []);
    } catch (e) {}
  }

  async function handleDelete(item) {
    if (!window.confirm(`Delete ${item.name} (${item.rollNo})? This cannot be undone.`)) return;
    setError("");
    setSuccess("");
    try {
      await api.delete(`/students/${encodeURIComponent(item.rollNo)}`);
      setBatchStudents((list) => list.filter((x) => x.rollNo !== item.rollNo));
      if (student && student.rollNo === item.rollNo) {
        setStudent(null);
        setForm(null);
      }
      // If that was the last student of the batch, the batch disappears from the dropdown.
      api.get("/students/meta/batches").then((res) => {
        const list = res.data.data || [];
        setBatches(list);
        if (!list.includes(batch)) setBatch("");
      });
      setSuccess(`Deleted ${item.name} (${item.rollNo}).`);
    } catch (err) {
      setError(err.response?.data?.message || "Could not delete the student.");
    }
  }

  function handleFieldChange(e) {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
  }

  function setResidentType(value) {
    setForm((f) => {
      const nextValue = f.residentType === value ? "" : value;
      return {
        ...f,
        residentType: nextValue,
        transportMode: nextValue === "Day Scholar" ? f.transportMode : "",
        transportBoardingPoint: nextValue === "Day Scholar" ? f.transportBoardingPoint : "",
      };
    });
  }

  function setTransportMode(value) {
    setForm((f) => {
      const nextValue = f.transportMode === value ? "" : value;
      return { ...f, transportMode: nextValue, transportBoardingPoint: nextValue === "College Bus" ? f.transportBoardingPoint : "" };
    });
  }

  function setAdmissionType(value) {
    setForm((f) => ({ ...f, admissionType: f.admissionType === value ? "" : value }));
  }

  async function handleSave(e) {
    e.preventDefault();
    if (!student) return;
    setError("");
    setSuccess("");

    if (!form.residentType) {
      setError('Please select either "Day Scholar" or "Hostler".');
      return;
    }
    if (form.residentType === "Day Scholar" && !form.transportMode) {
      setError('Please select either "College Bus" or "Out Bus".');
      return;
    }
    if (form.residentType === "Day Scholar" && form.transportMode === "College Bus" && !String(form.transportBoardingPoint || "").trim()) {
      setError("Please enter the Transport Boarding Point for the College Bus student.");
      return;
    }
    if (!form.admissionType) {
      setError('Please select either "Counselling" or "Management".');
      return;
    }
    if (!form.scholarship) {
      setError("Please select a Scholarship.");
      return;
    }
    if (form.scholarship === "Other" && !String(form.scholarshipOther || "").trim()) {
      setError("Please enter which Scholarship.");
      return;
    }
    if (!String(form.community || "").trim()) {
      setError("Please enter Community.");
      return;
    }

    if (!String(form.rollNo || "").trim()) {
      setError("Roll No is required.");
      return;
    }

    setSaving(true);
    try {
      const formData = new FormData();
      Object.entries(form).forEach(([key, value]) => {
        if (key.startsWith("_")) return;
        if(["semesters","arrears","certificates"].includes(key)||key.endsWith("Path"))return;
        formData.append(key, key === "batch" ? normalizeBatch(value) : value ?? "");
      });
      if (photo) formData.append("photo", photo);
      if (signature) formData.append("signature", signature);
      appendAcademic(formData,form);
      const res = await api.put(`/students/${encodeURIComponent(student.rollNo)}`, formData);
      setStudent(res.data.data);
      setForm({...initialAcademic(),...res.data.data});
      setPhoto(null);
      setPhotoKey((k) => k + 1);
      setSignature(null);
      setSignatureKey((k) => k + 1);
      setSuccess("Updated — changes have been saved to the Excel sheet.");
      api.get("/students/meta/batches").then((r) => setBatches(r.data.data || []));
      if (batch) handleBatchRefresh();
    } catch (err) {
      setError(err.response?.data?.message || "Could not save the update.");
    } finally {
      setSaving(false);
    }
  }

  const age = form ? calculateAge(form.dob) : "";

  const FIELD_MAP = Object.fromEntries(EDITABLE_FIELDS.map((f) => [f.key, f]));
  function renderField(key) {
    const f = FIELD_MAP[key];
    if (!form) return null;
    if (f.type === "textarea") {
      return (
        <div className="form-field form-field-full" key={f.key}>
          <label htmlFor={f.key}>{f.label}</label>
          <textarea
            id={f.key}
            name={f.key}
            rows={3}
            value={form[f.key] ?? ""}
            onChange={handleFieldChange}
            required={f.required}
          />
        </div>
      );
    }
    return (
      <div className="form-field" key={f.key}>
        <label htmlFor={f.key}>{f.label}</label>
        <input
          id={f.key}
          name={f.key}
          type={f.type}
          value={form[f.key] ?? ""}
          onChange={handleFieldChange}
          required={f.required}
        />
      </div>
    );
  }

  return (
    <div>
      <h2>Update Student</h2>
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

      <div className="batch-filter">
        <label htmlFor="batchSelect">Batch</label>
        <select id="batchSelect" value={batch} onChange={(e) => handleBatchChange(e.target.value)}>
          <option value="">-- Select Batch --</option>
          {batches.map((b) => (
            <option key={b} value={b}>{b}</option>
          ))}
        </select>
      </div>

      {batch && (
        <div className="batch-list">
          <p className="hint-text">
            {batchLoading ? "Loading..." : `${batchStudents.length} student(s) in Batch ${batch}`}
          </p>
          <div className="student-grid">
            {batchStudents.map((it) => (
              <div className="student-card" key={it.rollNo}>
                <div className="student-card-photo">
                  {it.photoPath ? <img src={it.photoPath} alt={it.name} /> : <span>No Photo</span>}
                </div>
                <div className="student-card-info">
                  <strong>{it.name}</strong>
                  <span>{it.rollNo}</span>
                </div>
                <div className="student-card-actions">
                  <button type="button" className="btn-small btn-view" onClick={() => navigate(`/student/${encodeURIComponent(it.rollNo)}`)}>View</button>
                  <button type="button" className="btn-small btn-edit" onClick={() => loadStudent(it.rollNo)}>Edit</button>
                  <button type="button" className="btn-small btn-delete" onClick={() => handleDelete(it)}>Delete</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {success && !student && <p className="success-text">{success}</p>}

      {error && <p className="error-text">{error}</p>}

      {student && form && (
        <form onSubmit={handleSave} className="student-form update-form">
          <h3 className="form-section-label">Record</h3>
          <div className="form-grid">
            <div className="form-field">
              <label htmlFor="rollNo">Roll No</label>
              <input id="rollNo" name="rollNo" value={form.rollNo ?? ""} onChange={handleFieldChange} required />
              <p className="hint-text">Changing this renames the Roll No everywhere, including on the Excel sheet.</p>
            </div>

            <div className="form-field">
              <label>Age (auto-calculated)</label>
              <input value={age} disabled />
            </div>
          </div>

          <h3 className="form-section-label">Personal Details</h3>
          <div className="form-grid">
            {renderField("name")}
            {renderField("fatherName")}
            {renderField("dob")}
            {renderField("address")}
            {renderField("religion")}
            {renderField("community")}
          </div>

          <h3 className="form-section-label">Contact Details</h3>
          <div className="form-grid">
            {renderField("fatherMobile")}
            {renderField("studentMobile")}
            {renderField("aadharCardNumber")}
            {renderField("email")}
            {renderField("batch")}
          </div>

          <h3 className="form-section-label">Academic Records</h3>
          <div className="form-grid">
            {renderField("sslc")}
            {renderField("hsc")}
            {renderField("diploma")}
            {renderField("cutOff")}
            {renderField("schoolName")}

          </div>

          <AcademicFields value={form} onChange={setForm}/>
          <h3 className="form-section-label">Residency &amp; Admission</h3>
          <div className="form-grid">
            <div className="form-field">
              <label>Day Scholar / Hostler</label>
              <div className="checkbox-row">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={form.residentType === "Day Scholar"}
                    onChange={() => setResidentType("Day Scholar")}
                  />
                  Day Scholar
                </label>
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={form.residentType === "Hostler"}
                    onChange={() => setResidentType("Hostler")}
                  />
                  Hostler
                </label>
              </div>
            </div>

            {form.residentType === "Day Scholar" && (
              <div className="form-field">
                <label>College Bus / Out Bus</label>
                <div className="checkbox-row">
                  {TRANSPORT_MODES.map((m) => (
                    <label className="checkbox-label" key={m}>
                      <input type="checkbox" checked={form.transportMode === m} onChange={() => setTransportMode(m)} />
                      {m}
                    </label>
                  ))}
                </div>
              </div>
            )}

            {form.residentType === "Day Scholar" && form.transportMode === "College Bus" && (
              <div className="form-field">
                <label htmlFor="transportBoardingPoint">Transport Boarding Point</label>
                <input
                  id="transportBoardingPoint"
                  name="transportBoardingPoint"
                  value={form.transportBoardingPoint ?? ""}
                  onChange={handleFieldChange}
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
                    checked={form.admissionType === "Counselling"}
                    onChange={() => setAdmissionType("Counselling")}
                  />
                  Counselling
                </label>
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={form.admissionType === "Management"}
                    onChange={() => setAdmissionType("Management")}
                  />
                  Management
                </label>
              </div>
            </div>

            {renderField("counselorName")}

            <div className="form-field">
              <label htmlFor="scholarship">Scholarship</label>
              <select id="scholarship" name="scholarship" value={form.scholarship || ""} onChange={(e) => setForm((f) => ({ ...f, scholarship: e.target.value, scholarshipOther: e.target.value === "Other" ? f.scholarshipOther : "" }))}>
                <option value="">-- Select Scholarship --</option>
                {SCHOLARSHIP_OPTIONS.map((o) => (
                  <option key={o} value={o}>{o}</option>
                ))}
              </select>
            </div>

            {form.scholarship === "Other" && (
              <div className="form-field">
                <label htmlFor="scholarshipOther">Which Scholarship?</label>
                <input
                  id="scholarshipOther"
                  name="scholarshipOther"
                  value={form.scholarshipOther ?? ""}
                  onChange={handleFieldChange}
                  placeholder="Enter the scholarship name"
                  required
                />
              </div>
            )}

          </div>

          <h3 className="form-section-label">Student Photo (optional - leave blank to keep the current photo)</h3>
          <div className="form-grid">
            <div className="form-field form-field-full">
              {form.photoPath && (
                <p className="hint-text">Current: <a href={form.photoPath} target="_blank" rel="noreferrer">View photo</a></p>
              )}
              <ImageCapture id="photo" label="Photo" kind="photo" value={photo} onChange={setPhoto} maxBytes={MAX_PHOTO_SIZE} />
            </div>
          </div>

          <h3 className="form-section-label">Student Signature (optional - leave blank to keep the current signature)</h3>
          <div className="form-grid">
            <div className="form-field form-field-full">
              {form.signaturePath && (
                <p className="hint-text">Current: <a href={form.signaturePath} target="_blank" rel="noreferrer">View signature</a></p>
              )}
              <ImageCapture id="signature" label="Signature" kind="signature" value={signature} onChange={setSignature} maxBytes={MAX_SIGNATURE_SIZE} />
            </div>
          </div>

          {success && <p className="success-text">{success}</p>}

          <button type="submit" className="btn-primary" disabled={saving}>
            <IconCheck /> {saving ? "Saving..." : "Save Changes"}
          </button>
        </form>
      )}
    </div>
  );
}
