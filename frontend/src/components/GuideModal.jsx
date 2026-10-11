import React, { useEffect, useState } from "react";
import api from "../api";
import { saveBlob, blobErrorMessage } from "../download.js";
import { usePwaInstall } from "../pwa.js";

const TABS = [
  { id: "use", label: "📘 Using the app" },
  { id: "vscode", label: "💻 Run in VS Code" },
  { id: "devices", label: "📱 Phones & devices" },
  { id: "fix", label: "🛠️ Problems & fixes" },
  { id: "deploy", label: "🚀 Deploy & maintain" },
];

function UseTab() {
  return (
    <>
      <h4>1. Open the app</h4>
      <p>Click once on the OTC intro screen (the browser only plays sound after a tap), or press <b>Skip</b>. Then choose <b>Student</b> or <b>Admin</b>.</p>
      <h4>2. Student (no password)</h4>
      <p>Opens only <b>Add Student</b>. Fill every required field. Photo and signature are optional and can be a file <i>or</i> a live camera shot. They are shrunk automatically (photo ≈ 24 KB, signature ≈ 10 KB).</p>
      <h4>3. Admin (password)</h4>
      <p>First password: <code>ADMIN_PASSWORD</code> from your <code>.env</code> / Vercel settings (default <code>grtcse@1234</code>). Change it with <b>Change Password</b> at once. Admin gets:</p>
      <ul>
        <li><b>Search</b> – find by name or Roll No, open a student's full details, print on A4.</li>
        <li><b>Update</b> – pick a batch, then <b>View</b>, <b>Edit</b> or <b>Delete</b>. Roll No can be renamed.</li>
        <li><b>Company</b> – eligibility lists (10th, 12th, cut-off, CGPA, arrears) printed batch-wise.</li>
        <li><b>Download Excel</b> – choose columns per batch; the file is built fresh from the database, A4-landscape ready.</li>
        <li><b>⚙ Gear</b> – this guide and the project ZIP.</li>
      </ul>
      <h4>4. The 50 KB rule</h4>
      <p>Every item stored in the database is under <b>50 KB</b>, and the <b>whole record of one student</b> (details + photo + signature) is kept under 50 KB. That is why many more students fit in the free database. If a record is ever too big, the app tells you which part to shrink.</p>
    </>
  );
}

function VsCodeTab() {
  return (
    <>
      <h4>What you need first</h4>
      <ul>
        <li><b>Node.js 18 or newer</b> (LTS) from <code>nodejs.org</code>. Check with <code>node -v</code>.</li>
        <li><b>Visual Studio Code</b> from <code>code.visualstudio.com</code>.</li>
        <li>Internet for <code>npm install</code>. Firebase is <b>optional</b> on your own PC (without it, data is kept in <code>backend/data/local-db.json</code>).</li>
      </ul>
      <h4>Step by step</h4>
      <ol>
        <li><b>Unzip</b> the downloaded ZIP. You get a folder named <code>grt-student-app</code>.</li>
        <li>VS Code: <b>File → Open Folder…</b> and choose that folder (the one containing <code>package.json</code>).</li>
        <li>Open the terminal: <b>Terminal → New Terminal</b>.</li>
        <li>Install once: <span className="guide-code">npm install</span></li>
        <li>Create your settings file:
          <span className="guide-code">{"Windows (Command Prompt):  copy .env.example .env\nPowerShell / Mac / Linux:  cp .env.example .env"}</span>
          Open <code>.env</code> and set <code>ADMIN_PASSWORD</code>. For Firebase save your key as <code>backend/serviceAccountKey.json</code> (or run <code>npm run firebase-env</code> and paste the line into <code>FIREBASE_SERVICE_ACCOUNT_JSON</code>).
        </li>
        <li>Start: <span className="guide-code">npm run dev</span> Wait for the API and WEB lines, then open <code>http://localhost:5173</code>.</li>
        <li>Stop with <code>Ctrl + C</code>.</li>
      </ol>
      <h4>Other ways to run</h4>
      <ul>
        <li><b>Production style:</b> <code>npm run build</code> then <code>npm start</code>, open <code>http://localhost:5000</code>.</li>
        <li><b>Windows double-click:</b> <code>RUN.bat</code> installs, builds, starts and opens the browser.</li>
        <li><b>Test on your phone:</b> with <code>npm run dev</code> running, open <code>http://YOUR-PC-IP:5173</code> on a phone on the same Wi-Fi.</li>
      </ul>
      <div className="guide-note"><b>Keep secret:</b> never share or upload <code>.env</code> or <code>serviceAccountKey.json</code>. They are in <code>.gitignore</code> and are not inside the ZIP.</div>
    </>
  );
}

function DevicesTab() {
  const { canInstall, install } = usePwaInstall();
  return (
    <>
      <h4>Works on every device</h4>
      <p>One address works on <b>Android</b>, <b>Pixel</b>, <b>iPhone / iPad (iOS)</b>, <b>macOS</b>, <b>Windows</b> and <b>Linux</b>. The layout changes size by itself to fit the screen, and respects phone notches.</p>
      <h4>Install it like an app</h4>
      <ul>
        <li><b>Android / Pixel (Chrome):</b> menu ⋮ → <b>Install app</b> / <b>Add to Home screen</b>.</li>
        <li><b>iPhone / iPad (Safari):</b> Share ⬆ → <b>Add to Home Screen</b>.</li>
        <li><b>macOS / Windows (Chrome, Edge):</b> the install icon at the right of the address bar. Safari on Mac: File → <b>Add to Dock</b>.</li>
      </ul>
      {canInstall && <p><button type="button" className="btn-primary" onClick={install}>📲 Install this app now</button></p>}
      <h4>Downloads on phones</h4>
      <ul>
        <li><b>Excel:</b> Download Excel saves the file to Downloads (Android) or opens the Files / Share sheet (iOS).</li>
        <li><b>Student sheet (PDF):</b> in <b>Search</b> open a student → <b>Print (A4)</b> → on the print screen choose <b>Save as PDF</b> (iOS: Share → Save to Files).</li>
        <li><b>Project ZIP:</b> the button below.</li>
      </ul>
    </>
  );
}

function FixTab() {
  return (
    <>
      <h4>"npm is not recognized"</h4>
      <p>Node.js is not installed, or the terminal was opened before installing it. Install Node LTS, then close and reopen VS Code.</p>
      <h4>Login says "database is not connected"</h4>
      <p>On Vercel add <code>FIREBASE_SERVICE_ACCOUNT_JSON</code> and redeploy. Open <code>/api/health</code>: both checks must be <code>true</code>.</p>
      <h4>Login says "JWT_SECRET is not set"</h4>
      <p>Add <code>JWT_SECRET</code> (any long random text) in Vercel → Settings → Environment Variables, then Redeploy.</p>
      <h4>Forgot the Admin password I set in the app</h4>
      <p>Firebase console → Firestore → collection <code>appConfig</code> → delete document <code>config</code>. The app returns to <code>ADMIN_PASSWORD</code>.</p>
      <h4>"Port is busy"</h4>
      <p>Close the other copy, or change <code>PORT</code> in <code>.env</code>. The production server tries the next ports automatically.</p>
      <h4>Intro has no sound</h4>
      <p>Browsers only allow sound after a tap. Tap the screen once on the intro.</p>
      <h4>Packages broken</h4>
      <p>Delete <code>node_modules</code> and run <code>npm install</code> again.</p>
      <h4>Moving old data from the previous version</h4>
      <p>Run <code>npm run migrate-legacy</code> once (see README). It converts old Firestore records to the new 50 KB format.</p>
    </>
  );
}

function DeployTab() {
  return (
    <>
      <h4>Project layout (one project, one deployment)</h4>
      <span className="guide-code">{`api/index.js        Vercel function entry (exports the Express app)
backend/app.js      Express app (login + students + Excel + guide)
backend/server.js   Local server only
backend/db.js       Database layer - enforces the 50 KB limit
backend/store.js    Student records (compressed) + tiny image docs
backend/routes/     auth, students, guide (ZIP download)
backend/assets/     logo and downloads/ (the project ZIP)
frontend/src/       React app (Vite) - built into /dist
vercel.json         Build + routing settings`}</span>
      <h4>Deploy on Vercel (frontend + backend together, one time)</h4>
      <ol>
        <li>Windows: double-click <code>deploy-vercel.bat</code>. Mac/Linux: <code>bash deploy-vercel.sh</code>. Or push to GitHub and import the repo in Vercel (all settings come from <code>vercel.json</code>).</li>
        <li>Add environment variables: <code>JWT_SECRET</code>, <code>FIREBASE_SERVICE_ACCOUNT_JSON</code>, optionally <code>ADMIN_PASSWORD</code>. Redeploy.</li>
        <li>Check <code>https://YOUR-APP.vercel.app/api/health</code>.</li>
      </ol>
      <h4>Keeping the ZIP up to date</h4>
      <p>The ZIP lives at <code>backend/assets/downloads/GRT-Student-App.zip</code>. After you change the project, zip the folder (without <code>node_modules</code>, <code>dist</code>, <code>.env</code>, key file), replace that file, commit and redeploy.</p>
      <h4>Long-term advice</h4>
      <ul>
        <li>Keep a private copy of your Firebase key and <code>.env</code>, separate from the ZIP.</li>
        <li>Back up regularly: Admin → Download Excel for every batch.</li>
        <li>If a future Node breaks <code>npm install</code>, use Node 20 LTS.</li>
        <li>Full details: <code>README.md</code>, <code>USER-GUIDE.md</code>, <code>DEPLOY-ONE-TIME.md</code> in the ZIP.</li>
      </ul>
    </>
  );
}

export default function GuideModal({ onClose }) {
  const [tab, setTab] = useState("use");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function download() {
    if (busy) return;
    setBusy(true); setError("");
    try {
      const res = await api.get("/guide/download", { responseType: "blob" });
      saveBlob(res.data, "GRT-Student-App.zip");
    } catch (e) {
      setError(await blobErrorMessage(e, "Could not download the ZIP."));
    } finally { setBusy(false); }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card guide-modal" role="dialog" aria-modal="true" aria-labelledby="guide-title" onClick={(e) => e.stopPropagation()}>
        <div className="guide-head">
          <h3 id="guide-title">⚙️ User Guidelines</h3>
          <button type="button" className="guide-close" onClick={onClose} aria-label="Close">×</button>
        </div>
        <div className="guide-tabs" role="tablist">
          {TABS.map((t) => (
            <button key={t.id} type="button" role="tab" aria-selected={tab === t.id}
              className={"guide-tab" + (tab === t.id ? " active" : "")} onClick={() => setTab(t.id)}>{t.label}</button>
          ))}
        </div>
        <div className="guide-body">
          {tab === "use" && <UseTab />}
          {tab === "vscode" && <VsCodeTab />}
          {tab === "devices" && <DevicesTab />}
          {tab === "fix" && <FixTab />}
          {tab === "deploy" && <DeployTab />}
        </div>
        <div className="guide-foot">
          <div className="grow">
            <b>Complete project (ZIP)</b>
            <div className="hint-text">Full source code for future use. Contains no passwords or keys.</div>
            {error && <div className="error-text" role="alert">{error}</div>}
          </div>
          <button type="button" className="btn-primary" onClick={download} disabled={busy}>{busy ? "Preparing…" : "⬇ Download project ZIP"}</button>
          <button type="button" className="btn-secondary" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
