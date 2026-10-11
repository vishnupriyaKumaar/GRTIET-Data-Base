const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const store = require("../store");

// Photo + signature are tiny JPEGs (the browser shrinks them). Everything is
// kept in memory and goes straight into the database - nothing touches a disk.
// Limits: photo 30 KB, signature 14 KB, and the WHOLE student record 50 KB.
const MAX_PHOTO_SIZE = store.MAX_PHOTO_BYTES;
const MAX_SIGNATURE_SIZE = store.MAX_SIGNATURE_BYTES;
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: Math.max(MAX_PHOTO_SIZE, MAX_SIGNATURE_SIZE) + 1024, files: 2, fields: 100, fieldSize: 2 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const label = file.fieldname === "signature" ? "signature" : "photo";
    if (!["photo", "signature"].includes(file.fieldname) || ![".png", ".jpg", ".jpeg"].includes(ext)) {
      return cb(new Error(`Student ${label} must be a PNG or JPG image.`));
    }
    cb(null, true);
  },
}).fields([
  { name: "photo", maxCount: 1 },
  { name: "signature", maxCount: 1 },
]);
function parseForm(req, res, next) {
  upload(req, res, (err) => {
    if (err) {
      const message = err.code === "LIMIT_FILE_SIZE" ? "Student photo / signature is too large (photo max 30 KB, signature max 14 KB). The app normally shrinks it for you." : err.message;
      return res.status(400).json({ success: false, message });
    }
    const f = req.files || {};
    const pick = (a) => (a && a[0] ? { buffer: a[0].buffer, contentType: /png$/i.test(a[0].originalname) ? "image/png" : "image/jpeg" } : undefined);
    req.photo = pick(f.photo);
    req.signature = pick(f.signature);
    if (req.photo && req.photo.buffer.length > MAX_PHOTO_SIZE) return res.status(400).json({ success: false, message: "Student photo must be 30 KB or smaller (the app shrinks it automatically)." });
    if (req.signature && req.signature.buffer.length > MAX_SIGNATURE_SIZE) return res.status(400).json({ success: false, message: "Student signature must be 14 KB or smaller (the app shrinks it automatically)." });
    next();
  });
}

const {requireAuth,admin}=require("../authStore");
const {parseAcademic}=require("../academic");
const {findEligible}=require("../eligibility");
router.use(requireAuth);
router.get("/check/:rollNo",async(req,res)=>{const found=await store.findByRollNo(req.params.rollNo);res.json({exists:!!found});});
router.use((req,res,next)=>req.method==="POST"?next():admin(req,res,next));

const RESIDENT_TYPES = ["Day Scholar", "Hostler"];
const ADMISSION_TYPES = ["Counselling", "Management"];
const SCHOLARSHIP_VALUES = store.SCHOLARSHIP_VALUES; // NA, 7.5, FG, College, SC/ST, Other
const TRANSPORT_MODES = ["College Bus", "Out Bus"];

// Validates the "Day Scholar / Hostler" + "Transport Boarding Point",
// "Counselling / Management", "Scholarship" and "Community" fields. Returns an
// error string, or null.
function validateResidencyAndAdmission(body, { partial }) {
  const hasResidentType = body.residentType !== undefined && body.residentType !== "";
  if (!partial || hasResidentType) {
    if (!RESIDENT_TYPES.includes(body.residentType)) {
      return 'Please select either "Day Scholar" or "Hostler".';
    }
    if (body.residentType === "Day Scholar") {
      if (!TRANSPORT_MODES.includes(body.transportMode)) {
        return 'Please select either "College Bus" or "Out Bus" for the Day Scholar student.';
      }
      if (body.transportMode === "College Bus" && !String(body.transportBoardingPoint || "").trim()) {
        return "Transport Boarding Point is required for College Bus students.";
      }
    }
  }
  const hasAdmissionType = body.admissionType !== undefined && body.admissionType !== "";
  if (!partial || hasAdmissionType) {
    if (!ADMISSION_TYPES.includes(body.admissionType)) {
      return 'Please select either "Counselling" or "Management".';
    }
  }
  const hasScholarship = body.scholarship !== undefined && body.scholarship !== "";
  if (!partial || hasScholarship) {
    if (!SCHOLARSHIP_VALUES.includes(body.scholarship)) {
      return `Please select a Scholarship (${SCHOLARSHIP_VALUES.join(", ")}).`;
    }
    if (body.scholarship === "Other" && !String(body.scholarshipOther || "").trim()) {
      return "Please enter which Scholarship.";
    }
  }
  const hasCommunity = body.community !== undefined && body.community !== "";
  if (!partial || hasCommunity) {
    if (!String(body.community || "").trim()) {
      return "Please enter Community.";
    }
  }
  return null;
}

function calculateAge(dobString) {
  const dob = new Date(dobString);
  if (isNaN(dob.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const m = today.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) {
    age--;
  }
  return age;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const BATCH_RE = /^\d{4}-\d{4}$/;

function isTenDigitPhone(v) {
  return /^\d{10}$/.test(String(v).replace(/\D/g, "").slice(-10)) && String(v).replace(/\D/g, "").length >= 10;
}

function isTwelveDigitAadhar(v) {
  return /^\d{12}$/.test(String(v).replace(/\D/g, ""));
}

function isCutOff(v) {
  const n = Number(v);
  return String(v).trim() !== "" && !isNaN(n) && n >= 0 && n <= 200;
}

function isPercent(v) {
  const n = Number(v);
  return !isNaN(n) && n >= 0 && n <= 100;
}

function isGradePoint(v) {
  const n = Number(v);
  return !isNaN(n) && n >= 0 && n <= 10;
}

// Internal bookkeeping fields (_sheet, _row) are used to locate a record
// inside the workbook; strip them before sending data back to the client.
function publicView(student) {
  if (!student) return student;
  const { _sheet, _row, ...rest } = student;
  return rest;
}

// Required for a brand-new record. HSC / DIPLOMA / CGPA / GPA are left
// optional since students may have taken different academic routes.
const REQUIRED_FIELDS = [
  "rollNo",
  "name",
  "fatherName",
  "dob",
  "address",
  "fatherMobile",
  "studentMobile",
  "aadharCardNumber",
  "sslc",
  "cutOff",
  "schoolName",
  "religion",
  "email",
  "batch",
];

function validateStudent(body, { partial } = { partial: false }) {
  if (!partial) {
    for (const field of REQUIRED_FIELDS) {
      if (!body[field] || String(body[field]).trim() === "") {
        return `Field "${field}" is required.`;
      }
    }
  }
  if (body.fatherMobile && !isTenDigitPhone(body.fatherMobile)) {
    return "Father Mobile Number should contain at least 10 digits.";
  }
  if (body.studentMobile && !isTenDigitPhone(body.studentMobile)) {
    return "Student Mobile Number should contain at least 10 digits.";
  }
  if (body.aadharCardNumber && !isTwelveDigitAadhar(body.aadharCardNumber)) {
    return "Aadhar Card Number should contain exactly 12 digits.";
  }
  if (body.cutOff && !isCutOff(body.cutOff)) {
    return "Cut-Off Mark should be a number between 0 and 200.";
  }
  if (body.email && !EMAIL_RE.test(body.email)) {
    return "Student Mail ID is not a valid email address.";
  }
  if (body.batch && !BATCH_RE.test(body.batch)) {
    return 'Batch should be in the format "YYYY-YYYY" (e.g. 2024-2028).';
  }
  if (body.dob && isNaN(new Date(body.dob).getTime())) {
    return "DOB is not a valid date.";
  }
  if (body.sslc && !isPercent(body.sslc)) {
    return "SSLC (%) should be a number between 0 and 100.";
  }
  if (body.hsc && !isPercent(body.hsc)) {
    return "HSC (%) should be a number between 0 and 100.";
  }
  if (body.diploma && !isPercent(body.diploma)) {
    return "DIPLOMA (%) should be a number between 0 and 100.";
  }
  if (body.cgpa && !isGradePoint(body.cgpa)) {
    return "CGPA should be a number between 0 and 10.";
  }
  if (body.gpa && !isGradePoint(body.gpa)) {
    return "GPA should be a number between 0 and 10.";
  }
  return null;
}

// GET /api/students - list all (across every batch sheet)
router.get("/", async (req, res) => {
  try {
    const students = await store.getAllStudents();
    res.json({ success: true, data: students.map(publicView) });
  } catch (err) {
    res.status(err.status || 500).json({ success: false, message: err.message });
  }
});

// GET /api/students/batches - list the batch (sheet) names present
// GET /api/students/meta/columns - every Excel column (for the download dialog)
router.get("/meta/columns", (req, res) => {
  res.json({ success: true, data: store.COLUMN_META });
});

// GET /api/students/search?q=vish&batch=2024-2028 - name / roll no suggestions and batch-wise lists
router.get("/search", async (req, res) => {
  try {
    const data = await store.searchStudents({ q: req.query.q, batch: req.query.batch });
    res.json({ success: true, data });
  } catch (err) {
    res.status(err.status || 500).json({ success: false, message: err.message });
  }
});

router.get("/meta/batches", async (req, res) => {
  try {
    const batches = await store.getBatchList();
    res.json({ success: true, data: batches });
  } catch (err) {
    res.status(err.status || 500).json({ success: false, message: err.message });
  }
});

// GET /api/students/eligible?c={"tenth":{"op":"gt","a":80},...}&batch=2024-2028
// Company eligibility: every criterion is optional. Admin only (GET is admin-guarded above).
router.get("/eligible", async (req, res) => {
  try {
    const students = (await store.getAllStudents()).map(publicView);
    const batch = req.query.batch ? store.normalizeBatch(req.query.batch) : "";
    const result = findEligible(students, req.query.c, { batch, compareRollNo: store.compareRollNo });
    const eligibleTotal = result.batches.reduce((n, b) => n + b.count, 0);
    res.json({
      success: true,
      data: { criteria: result.criteria, eligibleTotal, studentTotal: students.length, batches: result.batches },
    });
  } catch (err) {
    res.status(err.status || 500).json({ success: false, message: err.message });
  }
});

// GET /api/students/image/:id/:kind - the photo / signature, from the database (admin only)
router.get("/image/:id/:kind", async (req, res) => {
  try {
    const img = await store.getImage(req.params.id, req.params.kind);
    if (!img) return res.status(404).end();
    res.setHeader("Content-Type", img.contentType);
    res.setHeader("Cache-Control", "private, max-age=86400");
    res.send(img.data);
  } catch (err) {
    res.status(err.status || 500).json({ success: false, message: err.message });
  }
});

// GET /api/students/:rollNo - search by roll no (also used to check
// whether a Roll No has "Already Applied" before the Add form unlocks)
router.get("/:rollNo", async (req, res) => {
  try {
    const student = await store.findByRollNo(req.params.rollNo);
    if (!student) {
      return res.status(404).json({ success: false, message: "No student found with this Roll No." });
    }
    res.json({ success: true, data: publicView(student) });
  } catch (err) {
    res.status(err.status || 500).json({ success: false, message: err.message });
  }
});

// POST /api/students - add new student (rejected if Roll No already exists)
router.post("/", parseForm, async (req, res) => {
  try {
    if (req.body.batch) req.body.batch = store.normalizeBatch(req.body.batch);
    const validationError = validateStudent({...req.body,rollNo:req.params.rollNo||req.body.rollNo}, { partial: false });
    if (validationError) {
      return res.status(400).json({ success: false, message: validationError });
    }

    const residencyError = validateResidencyAndAdmission(req.body, { partial: false });
    if (residencyError) {
      return res.status(400).json({ success: false, message: residencyError });
    }

    const age = calculateAge(req.body.dob);
    const rollNo = String(req.body.rollNo).trim();

    const academic=parseAcademic(req.body);
    // Photo and signature are optional - they can be added later via Update.
    if(await store.findByRollNo(rollNo))return res.status(409).json({message:'Roll No is already registered.'});
    const student = {
      rollNo,
      name: req.body.name.trim(),
      fatherName: req.body.fatherName.trim(),
      dob: req.body.dob,
      age,
      address: req.body.address.trim(),
      fatherMobile: req.body.fatherMobile.trim(),
      studentMobile: req.body.studentMobile.trim(),
      aadharCardNumber: String(req.body.aadharCardNumber).trim(),
      sslc: req.body.sslc,
      cutOff: String(req.body.cutOff).trim(),
      schoolName: String(req.body.schoolName).trim(),
      religion: String(req.body.religion).trim(),
      counselorName: String(req.body.counselorName || "").trim(),
      hsc: req.body.hsc || "",
      diploma: req.body.diploma || "",
      cgpa: req.body.cgpa || "",
      gpa: req.body.gpa || "",
      email: req.body.email.trim(),
      batch: req.body.batch.trim(),
      residentType: req.body.residentType,
      transportMode: req.body.residentType === "Day Scholar" ? req.body.transportMode : "",
      transportBoardingPoint:
        req.body.residentType === "Day Scholar" && req.body.transportMode === "College Bus"
          ? String(req.body.transportBoardingPoint).trim()
          : "",
      admissionType: req.body.admissionType,
      community: String(req.body.community).trim(),
      scholarship: req.body.scholarship,
      scholarshipOther: req.body.scholarship === "Other" ? String(req.body.scholarshipOther).trim() : "",
      ...academic,
    };

    const saved = await store.addStudent(student, req.photo, req.signature);
    res.status(201).json({ success: true, data: publicView(saved) });
  } catch (err) {
    if (err.code === "DUPLICATE") {
      return res.status(409).json({ success: false, message: err.message });
    }
    res.status(err.status || 500).json({ success: false, message: err.message });
  }
});

// PUT /api/students/:rollNo - update an existing student. The URL's
// :rollNo locates the record; if the body includes a different Roll No,
// the record is renamed to it (Admin only - guarded above).
router.put("/:rollNo", parseForm, async (req, res) => {
  try {
    if (req.body.batch) req.body.batch = store.normalizeBatch(req.body.batch);
    const validationError = validateStudent({...req.body,rollNo:req.body.rollNo||req.params.rollNo}, { partial: false });
    if (validationError) {
      return res.status(400).json({ success: false, message: validationError });
    }

    const residencyError = validateResidencyAndAdmission(req.body, { partial: true });
    if (residencyError) {
      return res.status(400).json({ success: false, message: residencyError });
    }

    const existing=await store.findByRollNo(req.params.rollNo);
    if(!existing)return res.status(404).json({message:'Student not found.'});
    const academic=parseAcademic(req.body);
    const updates = Object.fromEntries(Object.entries(req.body).filter(([key])=>store.FIELD_KEYS.includes(key)&&!key.endsWith('Path')&&!['createdAt','updatedAt','arrearOccurred','arrearCleared','arrearSubjectNames','arrearSubjectCodes'].includes(key)));
    if (updates.rollNo !== undefined) {
      const desired = String(updates.rollNo).trim();
      if (!desired) return res.status(400).json({ success: false, message: "Roll No is required." });
      if (desired.toLowerCase() !== existing.rollNo.toLowerCase()) {
        const conflict = await store.findByRollNo(desired);
        if (conflict) return res.status(409).json({ success: false, message: "Roll No is already registered." });
      }
      updates.rollNo = desired;
    }
    if (updates.dob) {
      updates.age = calculateAge(updates.dob);
    }
    if (updates.residentType === "Hostler") {
      updates.transportMode = "";
      updates.transportBoardingPoint = "";
    }
    if (updates.residentType === "Day Scholar" && updates.transportMode !== "College Bus") {
      updates.transportBoardingPoint = "";
    }
    if (updates.scholarship !== undefined) {
      updates.scholarshipOther = updates.scholarship === "Other" ? String(updates.scholarshipOther || "").trim() : "";
    }

    Object.assign(updates,academic);

    const student = await store.updateStudent(req.params.rollNo, updates, req.photo, req.signature);
    res.json({ success: true, data: publicView(student) });
  } catch (err) {
    if (err.code === "NOT_FOUND") {
      return res.status(404).json({ success: false, message: err.message });
    }
    res.status(err.status || 500).json({ success: false, message: err.message });
  }
});

// DELETE /api/students/:rollNo
router.delete("/:rollNo", async (req, res) => {
  try {
    await store.deleteStudent(req.params.rollNo);
    res.json({ success: true, message: "Student deleted." });
  } catch (err) {
    if (err.code === "NOT_FOUND") {
      return res.status(404).json({ success: false, message: err.message });
    }
    res.status(err.status || 500).json({ success: false, message: err.message });
  }
});

module.exports = router;
