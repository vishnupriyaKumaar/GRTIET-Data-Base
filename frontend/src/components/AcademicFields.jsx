import React from 'react';
export const initialAcademic=()=>({umisNumber:'',emisNumber:'',apparId:'',semestersCompleted:'1',semesters:[{gpa:'',cgpa:''}],arrearStatus:'NA',arrears:[]});
const options=n=>Array.from({length:n},(_,i)=><option key={i+1} value={i+1}>{i+1}</option>);
const resize=(list,n,create)=>Array.from({length:n},(_,i)=>list?.[i]||create());
const blankArrear=()=>({occurredSem:'1',clearedSem:'1',subjects:[{name:'',code:''}]});
export const NOT_CLEARED='Not Cleared';
// CGPA is not generated for a semester while a past arrear is still pending
// (occurred in/before that semester and not cleared yet, or cleared later).
export const cgpaPending=(status,arrears,s)=>status!=='Current'&&(arrears||[]).some(a=>Number(a.occurredSem)<=s&&(a.clearedSem===NOT_CLEARED||s<Number(a.clearedSem)));
export function AcademicFields({value:v,onChange}){
 const set=(key,value)=>onChange({...v,[key]:value});
 const updateArrear=(index,patch)=>set('arrears',v.arrears.map((a,i)=>i===index?{...a,...patch}:a));
 const total=+v.semestersCompleted;
 const changeOccurred=(i,a,value)=>{const cleared=a.clearedSem===NOT_CLEARED||+a.clearedSem>=+value?a.clearedSem:value;updateArrear(i,{occurredSem:value,clearedSem:cleared});};
 return <section><div className="form-grid">
 { [['umisNumber','UMIS Number'],['emisNumber','EMIS Number'],['apparId','APPAR ID']].map(([key,label])=><label key={key}>{label}<input required maxLength={60} value={v[key]||''} onChange={e=>set(key,e.target.value)}/></label>)}
 <label>How many semesters have you completed?<select value={v.semestersCompleted} onChange={e=>onChange({...v,semestersCompleted:e.target.value,semesters:resize(v.semesters,+e.target.value,()=>({gpa:'',cgpa:''})),arrears:(v.arrears||[]).map(a=>v.arrearStatus==='Current'?a:{...a,occurredSem:String(Math.min(+a.occurredSem,+e.target.value)),clearedSem:a.clearedSem===NOT_CLEARED?a.clearedSem:String(Math.min(+a.clearedSem,+e.target.value))})})}>{options(8)}</select></label>
 </div>

 <h3 className="form-section-label">Arrear Details</h3>
 <label>How many arrear records?<select value={v.arrearStatus} onChange={e=>onChange({...v,arrearStatus:e.target.value,arrears:e.target.value==='NA'?[]:resize([],e.target.value==='Current'?1:+e.target.value,blankArrear)})}><option>NA</option><option>Current</option>{options(60)}</select></label>
 <p className="hint-text">Select NA for no arrears, Current for pending subjects, or the number of past arrear records. Each new past arrear record is for one subject. For Current, use Add subject for additional pending subjects.</p>
 {(v.arrears||[]).map((a,i)=><fieldset key={i}><legend>{v.arrearStatus==='Current'?'Current arrears':`Arrear record ${i+1}`}</legend><div className="form-grid">
 {v.arrearStatus!=='Current'&&<><label>Occurred in semester<select value={a.occurredSem} onChange={e=>changeOccurred(i,a,e.target.value)}>{options(total)}</select></label><label>Cleared in semester<select value={a.clearedSem} onChange={e=>updateArrear(i,{clearedSem:e.target.value})}>{Array.from({length:Math.max(0,total-(+a.occurredSem)+1)},(_,k)=>+a.occurredSem+k).map(n=><option key={n} value={n}>{n}</option>)}<option value={NOT_CLEARED}>Still Not Cleared</option></select></label></>}
 </div>
 {a.subjects.map((sub,j)=><div className="form-grid" key={j}>{['name','code'].map(key=><label key={key}>Subject {j+1} {key}<input required maxLength={120} value={sub[key]} onChange={e=>updateArrear(i,{subjects:a.subjects.map((s,k)=>j===k?{...s,[key]:e.target.value}:s)})}/></label>)}</div>)}
 {v.arrearStatus==='Current'&&<div className="update-actions"><button type="button" className="btn-secondary" disabled={a.subjects.length>=60} onClick={()=>updateArrear(i,{subjects:[...a.subjects,{name:'',code:''}]})}>Add subject</button><button type="button" className="btn-secondary" disabled={a.subjects.length<=1} onClick={()=>updateArrear(i,{subjects:a.subjects.slice(0,-1)})}>Remove last subject</button></div>}
 </fieldset>)}

 <h3 className="form-section-label">Semester Marks</h3>
 <p className="hint-text">CGPA is not generated for a semester while an arrear from that semester (or earlier) is still not cleared. It appears again from the semester the arrear is cleared.</p>
 {(v.semesters||[]).map((s,i)=>{const pending=cgpaPending(v.arrearStatus,v.arrears,i+1);return <fieldset key={i}><legend>Semester {i+1}</legend><div className="form-grid">{['gpa','cgpa'].map(key=>key==='cgpa'&&pending?<label key={key}>Sem {i+1} CGPA<input disabled value="" placeholder="Not generated (arrear pending)"/></label>:<label key={key}>Sem {i+1} {key.toUpperCase()}<input type="number" min="0" max="10" step="0.01" required value={s[key]??''} onChange={e=>set('semesters',v.semesters.map((s,j)=>i===j?{...s,[key]:e.target.value}:s))}/></label>)}</div></fieldset>;})}
 </section>;
}
export function appendAcademic(data,value){
 for(const key of ['umisNumber','emisNumber','apparId','semestersCompleted','arrearStatus'])data.set(key,value[key]);
 for(const key of ['semesters','arrears'])data.set(key,JSON.stringify(value[key]||[]));
}
export function AcademicSummary({student:s}){return <section><h3 className="form-section-label">Academic history</h3><p>UMIS: {s.umisNumber} · EMIS: {s.emisNumber} · APPAR ID: {s.apparId}</p><p>Completed semesters: {s.semestersCompleted}</p><table className="print-table"><thead><tr><th>Semester</th><th>GPA</th><th>CGPA</th></tr></thead><tbody>{(s.semesters||[]).map((v,i)=><tr key={i}><td>{i+1}</td><td>{v.gpa}</td><td>{v.cgpa==null||v.cgpa===''?'Not Generated':v.cgpa}</td></tr>)}</tbody></table><h3>Arrears: {s.arrearStatus||'NA'}</h3>{(s.arrears||[]).map((a,i)=><section key={i}><p>Record {i+1} · {a.subjects.length} subjects · {s.arrearStatus==='Current'?'Current':`Occurred: Sem ${a.occurredSem} · Cleared: ${a.clearedSem==='Not Cleared'?'Still Not Cleared':`Sem ${a.clearedSem}`}`}</p><table className="print-table"><thead><tr><th>Subject name</th><th>Subject code</th></tr></thead><tbody>{a.subjects.map((sub,j)=><tr key={j}><td>{sub.name}</td><td>{sub.code}</td></tr>)}</tbody></table></section>)}</section>}
