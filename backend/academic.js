
const NOT_CLEARED = 'Not Cleared';

function parseAcademic(body){
 const fail=message=>{throw Object.assign(new Error(message),{status:400});};
 const json=(v,fallback)=>{try{return typeof v==='string'?JSON.parse(v):v??fallback;}catch{fail('Invalid academic data.');}};
 const sem=Number(body.semestersCompleted);
 if(!Number.isInteger(sem)||sem<1||sem>8)fail('Select completed semesters from 1 to 8.');
 const out={semestersCompleted:sem};
 for(const key of ['umisNumber','emisNumber','apparId']){if(!String(body[key]||'').trim())fail(`${key} is required.`);out[key]=String(body[key]).trim();}

 // Arrears come first: they decide which semesters can have a CGPA.
 out.arrearStatus=String(body.arrearStatus);
 const n=Number(out.arrearStatus);
 if(!['NA','Current'].includes(out.arrearStatus)&&(!Number.isInteger(n)||n<1||n>60))fail('Choose NA, Current or 1–60 arrears.');
 out.arrears=out.arrearStatus==='NA'?[]:json(body.arrears,[]);
 if(!Array.isArray(out.arrears)||out.arrears.length!==(out.arrearStatus==='NA'?0:out.arrearStatus==='Current'?1:n))fail('Complete every arrear record.');
 out.arrears=out.arrears.map(a=>{
  let occurredSem='',clearedSem='';
  if(out.arrearStatus!=='Current'){
   occurredSem=Number(a.occurredSem);
   if(!Number.isInteger(occurredSem)||occurredSem<1||occurredSem>sem)fail('Arrear semesters must be completed semesters.');
   if(a.clearedSem===NOT_CLEARED)clearedSem=NOT_CLEARED;
   else{
    clearedSem=Number(a.clearedSem);
    if(!Number.isInteger(clearedSem)||clearedSem<occurredSem||clearedSem>sem)fail('Clearance cannot precede occurrence and must be a completed semester (or Still Not Cleared).');
   }
  }
  if(!Array.isArray(a.subjects)||a.subjects.length<1||a.subjects.length>60)fail('Select 1–60 subjects per arrear record.');
  return {occurredSem,clearedSem,subjects:a.subjects.map(s=>{if(!String(s.name||'').trim()||!String(s.code||'').trim())fail('Enter every subject name and code.');return {name:String(s.name).trim(),code:String(s.code).trim()};})};
 });

 // CGPA is not generated for a semester while a past arrear is still pending
 // (occurred in/before that semester and not yet cleared, or cleared later).
 const cgpaPending=s=>out.arrearStatus!=='Current'&&out.arrears.some(a=>a.occurredSem<=s&&(a.clearedSem===NOT_CLEARED||s<a.clearedSem));

 out.semesters=json(body.semesters,[]);
 if(!Array.isArray(out.semesters)||out.semesters.length!==sem)fail('Enter GPA for every completed semester.');
 const inRange=v=>v!=null&&String(v).trim()!==''&&Number.isFinite(Number(v))&&Number(v)>=0&&Number(v)<=10;
 out.semesters=out.semesters.map((s,i)=>{
  if(!inRange(s.gpa))fail('GPA must be between 0 and 10.');
  if(cgpaPending(i+1))return {gpa:Number(s.gpa),cgpa:null};
  if(!inRange(s.cgpa))fail('CGPA must be between 0 and 10 for semesters without a pending arrear.');
  return {gpa:Number(s.gpa),cgpa:Number(s.cgpa)};
 });
 out.gpa=out.semesters.at(-1).gpa;
 const lastCgpa=[...out.semesters].reverse().find(s=>s.cgpa!==null);
 out.cgpa=lastCgpa?lastCgpa.cgpa:'';
 return out;
}
module.exports={parseAcademic};
