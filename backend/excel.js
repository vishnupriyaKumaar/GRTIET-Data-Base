// -----------------------------------------------------------------------------
// EXCEL BUILDER (no files on disk)
// The workbook is built in memory from the records every time Admin presses
// "Download Excel". Nothing is stored, so there is nothing to keep in sync.
// -----------------------------------------------------------------------------
const ExcelJS = require("exceljs");
const path = require("path");
const fs = require("fs");

const LOGO_PATH = path.join(__dirname, "assets", "grt-logo.jpeg");

// Order here defines both the column order in every batch sheet and the
// object-key order used everywhere else in the backend.
const FIELDS = [
  { key: "rollNo", header: "Roll No", width: 16 },
  { key: "name", header: "Name", width: 24 },
  { key: "photoPath", header: "Student Photo", width: 16 },
  { key: "signaturePath", header: "Student Signature", width: 16 },
  { key: "fatherName", header: "Father Name", width: 24 },
  { key: "dob", header: "DOB", width: 14 },
  { key: "age", header: "Age", width: 8 },
  { key: "address", header: "Address", width: 34 },
  { key: "religion", header: "Religion", width: 16 },
  { key: "community", header: "Community", width: 16 },
  { key: "fatherMobile", header: "Father Mobile Number", width: 18 },
  { key: "studentMobile", header: "Student Mobile Number", width: 18 },
  { key: "aadharCardNumber", header: "Aadhar Card Number", width: 20 },
  { key: "sslc", header: "SSLC (%)", width: 10 },
  { key: "hsc", header: "HSC (%)", width: 10 },
  { key: "diploma", header: "DIPLOMA (%)", width: 12 },
  { key: "cutOff", header: "Cut-Off Mark", width: 14 },
  { key: "schoolName", header: "School Name", width: 30 },
  { key: "cgpa", header: "CGPA", width: 8 },
  { key: "gpa", header: "GPA", width: 8 },
  { key: "email", header: "Student Mail ID", width: 26 },
  { key: "batch", header: "Batch", width: 12 },
  { key: "residentType", header: "Day Scholar / Hostler", width: 18 },
  { key: "transportMode", header: "College Bus / Out Bus", width: 18 },
  { key: "transportBoardingPoint", header: "Transport Boarding Point", width: 24 },
  { key: "admissionType", header: "Counselling / Management", width: 20 },
  { key: "counselorName", header: "Counselor Name", width: 22 },
  { key: "scholarship", header: "Scholarship", width: 14 },
  {key:'createdAt',header:'Registered On',width:24},
  {key:'updatedAt',header:'Last Updated',width:24},
  {key:'umisNumber',header:'UMIS Number',width:22},
  {key:'emisNumber',header:'EMIS Number',width:22},
  {key:'apparId',header:'APPAR ID',width:22},
  {key:'semestersCompleted',header:'Semesters Completed',width:18},
  ...Array.from({length:8},(_,i)=>[{key:`sem${i+1}Gpa`,header:`Sem ${i+1} GPA`,width:12},{key:`sem${i+1}Cgpa`,header:`Sem ${i+1} CGPA`,width:12}]).flat(),
  {key:'arrearStatus',header:'Arrears (NA / Current / Count)',width:22},
  {key:'arrearOccurred',header:'Arrear Occurred Semester',width:26},
  {key:'arrearSubjectNames',header:'Arrear Subject Name',width:38},
  {key:'arrearSubjectCodes',header:'Arrear Subject Code',width:26},
  {key:'arrearCleared',header:'Arrear Cleared Semester',width:26},
];
const FIELD_KEYS = [...FIELDS.map((f) => f.key), "scholarshipOther"];

// Numeric-ish columns look better centered than left-aligned.
const CENTERED_KEYS = new Set(["rollNo", "age", "sslc", "hsc", "diploma", "cgpa", "gpa", "scholarship"]);

// Layout: 3 letterhead rows, 1 spacer row, then the header row, then data.
const TITLE_ROW_INSTITUTE = 1;
const TITLE_ROW_DEPT = 2;
const TITLE_ROW_BATCH = 3;
const SPACER_ROW = 4;
const HEADER_ROW = 5;
const FIRST_DATA_ROW = HEADER_ROW + 1;

const COLOR_MAROON = "FF5B21B6";
const COLOR_ORANGE = "FFEAB308";
const COLOR_LIGHT_ORANGE = "FFFCE9C7";
const COLOR_STRIPE = "FFFBF3E7";
const COLOR_WHITE = "FFFFFFFF";

// A clearly visible mid-gray so every column boundary reads at a glance,
// even in a cell that also holds a floating photo/signature image.
const THIN_BORDER = {
  top: { style: "thin", color: { argb: "FF9A9A9A" } },
  left: { style: "thin", color: { argb: "FF9A9A9A" } },
  bottom: { style: "thin", color: { argb: "FF9A9A9A" } },
  right: { style: "thin", color: { argb: "FF9A9A9A" } },
};

// Excel sheet names: max 31 chars, and can't contain : \ / ? * [ ]
function sheetNameForBatch(batch) {
  return String(batch).replace(/[:\\/?*\[\]]/g, "-").slice(0, 31);
}

// Natural / alphanumeric comparison so Roll Nos like "24CS101" sort the way
// a person expects: "24CS2" before "24CS10" (not string-lexicographic,
// which would put "24CS10" before "24CS2"). Splits each value into runs of
// digits vs. non-digits and compares run-by-run.
function splitIntoChunks(value) {
  return String(value)
    .match(/\d+|\D+/g) || [];
}

function compareRollNo(a, b) {
  const chunksA = splitIntoChunks(a);
  const chunksB = splitIntoChunks(b);
  const len = Math.max(chunksA.length, chunksB.length);
  for (let i = 0; i < len; i++) {
    const chunkA = chunksA[i] ?? "";
    const chunkB = chunksB[i] ?? "";
    const numA = /^\d+$/.test(chunkA) ? Number(chunkA) : null;
    const numB = /^\d+$/.test(chunkB) ? Number(chunkB) : null;
    if (numA !== null && numB !== null) {
      if (numA !== numB) return numA - numB;
    } else if (chunkA !== chunkB) {
      return chunkA < chunkB ? -1 : 1;
    }
  }
  return 0;
}

// Convert a 1-indexed column number to its spreadsheet letter (17 -> "Q").
function colLetter(n) {
  let s = "";
  while (n > 0) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

function styleDataRow(row, rowNumber, cols) {
  const stripe = (rowNumber - HEADER_ROW) % 2 === 0;
  for (let c = 1; c <= cols.length; c++) {
    const cell = row.getCell(c);
    cell.border = THIN_BORDER;
    cell.alignment = {
      vertical: "middle",
      horizontal: CENTERED_KEYS.has(cols[c - 1].key) ? "center" : "left",
      wrapText: true,
    };
    cell.font = { name: "Calibri", size: 11 };
    cell.fill = stripe
      ? { type: "pattern", pattern: "solid", fgColor: { argb: COLOR_STRIPE } }
      : { type: "pattern", pattern: "solid", fgColor: { argb: COLOR_WHITE } };
  }
  let lines = 1;
  row.eachCell((cell) => {
    const width = cols[cell.col - 1]?.width || 20;
    const text = String(cell.value ?? "");
    lines = Math.max(lines, text.split("\n").length, ...text.split("\n").map((t) => Math.ceil(t.length / Math.max(8, width - 2))));
  });
  // 84pt leaves room for the student photo when that column is included.
  const minHeight = cols.some((f) => f.key === "photoPath") ? 84 : 30;
  row.height = Math.min(409, Math.max(minHeight, lines * 15 + 8));
}

function buildLetterhead(workbook, sheet, batch, cols) {
  const width = Math.max(cols.length, 3);
  const fillAll = (rowNo, argb) => {
    for (let c = 1; c <= width; c++) {
      sheet.getCell(rowNo, c).fill = { type: "pattern", pattern: "solid", fgColor: { argb } };
    }
  };
  // The logo now sits only in row 1 (column A); rows 2-3 use the full
  // width (A through the last title column) since there's no logo beside
  // them to leave room for.
  const TEXT_TO = colLetter(Math.min(12, width));
  const rows = [
    { row: TITLE_ROW_INSTITUTE, height: 40, argb: COLOR_MAROON, text: "GRT INSTITUTE OF ENGINEERING AND TECHNOLOGY - TIRUTTANI (AUTONOMOUS)", font: { name: "Calibri", bold: true, size: 18, color: { argb: COLOR_WHITE } }, textFrom: "B" },
    { row: TITLE_ROW_DEPT, height: 24, argb: COLOR_ORANGE, text: "DEPARTMENT OF COMPUTER SCIENCE AND ENGINEERING", font: { name: "Calibri", bold: true, size: 14, color: { argb: "FF3B2A00" } }, textFrom: "A" },
    { row: TITLE_ROW_BATCH, height: 22, argb: COLOR_LIGHT_ORANGE, text: `STUDENT DATA BASE  -  BATCH ${batch}`, font: { name: "Calibri", bold: true, size: 13, color: { argb: COLOR_MAROON } }, textFrom: "A" },
  ];
  rows.forEach((r) => {
    fillAll(r.row, r.argb);
    sheet.getRow(r.row).height = r.height;
    sheet.mergeCells(`${r.textFrom}${r.row}:${TEXT_TO}${r.row}`);
    const cell = sheet.getCell(`${r.textFrom}${r.row}`);
    cell.value = r.text;
    cell.font = r.font;
    cell.alignment = { horizontal: r.textFrom === "A" ? "center" : "left", vertical: "middle", indent: r.textFrom === "A" ? 0 : 1 };
  });

  // Logo: a single small badge in row 1 / column A only - it no longer
  // spans all three letterhead rows.
  sheet.getCell(`A${TITLE_ROW_INSTITUTE}`).fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLOR_WHITE } };
  sheet.getCell(`A${TITLE_ROW_INSTITUTE}`).border = { right: { style: "thin", color: { argb: COLOR_MAROON } } };
  try {
    const logoId = workbook.addImage({ filename: LOGO_PATH, extension: "jpeg" });
    sheet.addImage(logoId, { tl: { col: 0.08, row: 0.06 }, ext: { width: 34, height: 34 }, editAs: "oneCell" });
  } catch (e) { /* logo is optional - sheet still works without it */ }

  sheet.getRow(SPACER_ROW).height = 6;
  fillAll(SPACER_ROW, COLOR_WHITE);

  const headerRow = sheet.getRow(HEADER_ROW);
  headerRow.values = cols.map((f) => f.header);
  headerRow.eachCell((cell) => {
    cell.font = { name: "Calibri", bold: true, size: 11, color: { argb: COLOR_WHITE } };
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLOR_MAROON } };
    cell.border = {
      top: { style: "thin", color: { argb: COLOR_ORANGE } },
      left: { style: "thin", color: { argb: "FF8B5CF6" } },
      right: { style: "thin", color: { argb: "FF8B5CF6" } },
      bottom: { style: "medium", color: { argb: COLOR_ORANGE } },
    };
  });
  headerRow.height = 36;

  sheet.properties.tabColor = { argb: COLOR_MAROON };
  sheet.views = [{ state: "frozen", xSplit: 1, ySplit: HEADER_ROW, topLeftCell: `B${HEADER_ROW + 1}`, showGridLines: false }];
  sheet.autoFilter = {
    from: { row: HEADER_ROW, column: 1 },
    to: { row: HEADER_ROW, column: cols.length },
  };
}

function getOrCreateSheet(workbook, batch, cols) {
  const name = sheetNameForBatch(batch);
  let sheet = workbook.getWorksheet(name);
  if (!sheet) {
    sheet = workbook.addWorksheet(name);
    cols.forEach((f, i) => {
      sheet.getColumn(i + 1).width = f.width;
    });
    buildLetterhead(workbook, sheet, batch, cols);
  }
  // The placeholder "Info" sheet is only relevant while no batch sheet
  // exists yet; remove it as soon as real data sheets are present.
  const info = workbook.getWorksheet("Info");
  if (info && workbook.worksheets.length > 1) {
    workbook.removeWorksheet(info.id);
  }
  return sheet;
}

function buildRowValues(student, cols) {
  return cols.map((f) => student[f.key] ?? "");
}

// Groups used by the "choose columns" dialog when downloading Excel.
function groupOf(key) {
  if (["rollNo", "name", "photoPath", "signaturePath", "fatherName", "dob", "age", "address", "religion", "community"].includes(key)) return "Personal Details";
  if (["fatherMobile", "studentMobile", "aadharCardNumber", "email", "batch"].includes(key)) return "Contact Details";
  if (/^sem\d+(Gpa|Cgpa)$/.test(key)) return "Semester Marks";
  if (key.startsWith("arrear")) return "Arrear Details";
  if (["residentType", "transportMode", "transportBoardingPoint", "admissionType", "counselorName", "scholarship"].includes(key)) return "Residency & Admission";
  if (["createdAt", "updatedAt"].includes(key)) return "Record Dates";
  return "Academic Records";
}
const COLUMN_META = FIELDS.map((f) => ({ key: f.key, header: f.header, group: groupOf(f.key) }));

// "24-25" / "2024-28" / "24 - 2028" -> "2024-2028". Anything else is returned trimmed.
function normalizeBatch(value){
 const raw=String(value??'').trim();
 const m=raw.match(/^(\d{2}|\d{4})\s*[-\u2013\u2014\/]\s*(\d{2}|\d{4})$/);
 if(!m)return raw;
 const full=x=>x.length===2?'20'+x:x;
 return `${full(m[1])}-${full(m[2])}`;
}
// Scholarship choices offered in the dropdown. Anything else typed in the past is kept as "Other - <text>".
const SCHOLARSHIP_VALUES=['NA','7.5','FG','College','SC/ST','Other'];
// Builds a workbook with one sheet per batch. `colsFor(batch)` returns the
// list of FIELDS to show for that batch (or null to leave the batch out).
function buildWorkbook(students,colsFor,{print=false}={}){
 const workbook=new ExcelJS.Workbook();
 for(const s of [...students].sort((a,b)=>compareRollNo(a.rollNo,b.rollNo))){
  const cols=colsFor(s.batch);
  if(!cols||!cols.length)continue;
  const flat={...s};(s.semesters||[]).forEach((v,i)=>{flat[`sem${i+1}Gpa`]=v.gpa;flat[`sem${i+1}Cgpa`]=(v.cgpa==null||v.cgpa==='')?'Not Generated':v.cgpa;});
  const details=(s.arrears||[]).flatMap((a,i)=>(a.subjects||[]).map((sub,j)=>({index:a.subjects.length>1?`${i+1}.${j+1}`:`${i+1}`,a,sub})));
  const lines=fn=>details.length?details.map(d=>`${d.index}. ${fn(d)}`).join('\n'):'NA';
  flat.arrearOccurred=lines(d=>s.arrearStatus==='Current'?'Current':d.a.occurredSem);
  flat.arrearCleared=lines(d=>s.arrearStatus==='Current'?'Current':(d.a.clearedSem==='Not Cleared'?'Still Not Cleared':d.a.clearedSem));
  flat.arrearSubjectNames=lines(d=>d.sub.name);
  flat.arrearSubjectCodes=lines(d=>d.sub.code);
  flat.scholarship=s.scholarship==='Other'?`Other - ${s.scholarshipOther||''}`:(s.scholarship||'');
  flat.photoPath='';
  flat.signaturePath='';
  const sheet=getOrCreateSheet(workbook,s.batch,cols);
  const row=sheet.addRow(buildRowValues(flat,cols));
  styleDataRow(row,row.number,cols);
  row.commit();
  // Small inset (in fractional column/row units) so the image sits clearly
  // inside its cell's border instead of touching or overrunning it - that
  // gap is what makes the column line next to it stay visible.
  const embedImage=(key,img,ext_)=>{
   const idx=cols.findIndex(f=>f.key===key);
   if(idx<0||!img||!img.data)return;
   try{
    const ext=/png/i.test(img.contentType||'')?'png':'jpeg';
    const id=workbook.addImage({buffer:Buffer.from(img.data),extension:ext});
    sheet.addImage(id,{tl:{col:idx+0.08,row:row.number-1+0.08},ext:ext_,editAs:'oneCell'});
   }catch(e){}
  };
  embedImage('photoPath',s._photo,{width:88,height:92});
  embedImage('signaturePath',s._signature,{width:88,height:46});
 }
 for(const sheet of workbook.worksheets){
  sheet.pageSetup={paperSize:9,orientation:'landscape',fitToPage:true,fitToWidth:1,fitToHeight:0,...(print?{printTitlesRow:`${HEADER_ROW}:${HEADER_ROW}`,margins:{left:0.4,right:0.4,top:0.5,bottom:0.5,header:0.3,footer:0.3},horizontalCentered:true}:{})};
  if(print)sheet.headerFooter={oddFooter:'&LGRT Institute of Engineering and Technology&CPage &P of &N&R&D'};
 }
 return workbook;
}
// selections: [{batch, columns: "all" | [field keys]}] - one entry per batch to export.
// students: records (with optional _photo / _signature = {data, contentType}).
async function buildCustomWorkbook(selections,students){
 const byBatch=new Map();
 for(const sel of selections||[]){
  const cols=sel.columns==='all'?FIELDS:FIELDS.filter(f=>Array.isArray(sel.columns)&&sel.columns.includes(f.key));
  if(cols.length)byBatch.set(String(sel.batch),cols);
 }
 const list=(students||[]).filter(s=>byBatch.has(String(s.batch)));
 const workbook=buildWorkbook(list,batch=>byBatch.get(String(batch)),{print:true});
 if(!workbook.worksheets.length)throw Object.assign(new Error('No student records found for the selected batches and columns.'),{status:400});
 return workbook.xlsx.writeBuffer();
}
module.exports={SCHOLARSHIP_VALUES,compareRollNo,FIELDS,FIELD_KEYS,COLUMN_META,normalizeBatch,buildCustomWorkbook};
