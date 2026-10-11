import React, { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import StudentForm from "./StudentForm.jsx";
import SearchView from "./SearchView.jsx";
import UpdateStudent from "./UpdateStudent.jsx";
import ChangePassword from "./ChangePassword.jsx";
import DownloadExcel from "./DownloadExcel.jsx";
import CompanyView from "./CompanyView.jsx";
import GuideModal from "./GuideModal.jsx";
import { usePwaInstall } from "../pwa.js";
import { IconPlus, IconSearch, IconPencil, IconDownload, IconKey, IconLogout, IconBuilding } from "./Icons.jsx";

export default function Dashboard({ onLogout, role }) {
  // "Edit" on the student details page sends us back here with that student's Roll No.
  const location = useLocation();
  const navigate = useNavigate();
  const editRoll = role === "admin" ? location.state?.editRoll || "" : "";
  const [tab, setTabState] = useState(() => { if (editRoll) return "update"; try { const t = sessionStorage.getItem("grt_tab"); return t && (role === "admin" || t === "add") ? t : "add"; } catch { return "add"; } });
  // Use the hand-off once, then clear it so Back/forward later never re-opens that edit form.
  useEffect(() => {
    if (editRoll) navigate(location.pathname + location.search, { replace: true, state: null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const setTab = (t) => { setTabState(t); try { sessionStorage.setItem("grt_tab", t); } catch {} };
  const [showChangePw, setShowChangePw] = useState(false);
  const [showDownload, setShowDownload] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const { canInstall, install } = usePwaInstall();

  function handleLogout() {
    onLogout();
  }

  return (
    <div className="dashboard">
      <div className="toolbar-actions">
        {role === "admin" && (
          <>
            <button className="btn-secondary" onClick={() => setShowDownload(true)}>
              <IconDownload /> Download Excel
            </button>
            <button className="btn-secondary" onClick={() => setShowChangePw(true)}>
              <IconKey /> Change Password
            </button>
            <button className="btn-secondary gear-btn" onClick={() => setShowGuide(true)} title="User guidelines" aria-label="Open user guidelines">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h.01a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h.01a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v.01a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
            </button>
          </>
        )}
        {canInstall && (
          <button className="btn-secondary" onClick={install}>📲 Install app</button>
        )}
        <button className="btn-secondary" onClick={handleLogout}>
          <IconLogout /> Logout
        </button>
      </div>

      <p className="access-badge">{role==="admin"?"Full access":"Add Student access only · Other sections are locked"}</p>
      <div className="dashboard-toolbar">
        <div className="tabs">
          <button
            className={tab === "add" ? "tab active" : "tab"}
            onClick={() => setTab("add")}
          >
            <IconPlus /> Add Student
          </button>
          <button
            className={tab === "search" ? "tab active" : "tab"}
            disabled={role!=="admin"} title={role!=="admin"?"Full access required":undefined} onClick={() => setTab("search")}
          >
            <IconSearch /> Search
          </button>
          <button
            className={tab === "update" ? "tab active" : "tab"}
            disabled={role!=="admin"} title={role!=="admin"?"Full access required":undefined} onClick={() => setTab("update")}
          >
            <IconPencil /> Update
          </button>
          <button
            className={tab === "company" ? "tab active" : "tab"}
            disabled={role!=="admin"} title={role!=="admin"?"Full access required":undefined} onClick={() => setTab("company")}
          >
            <IconBuilding /> Company
          </button>
        </div>
      </div>

      <div className="card dashboard-card">
        {tab === "add" && <StudentForm />}
        {role==="admin" && tab === "search" && <SearchView />}
        {role==="admin" && tab === "update" && <UpdateStudent initialRoll={editRoll} />}
        {role==="admin" && tab === "company" && <CompanyView />}
      </div>

      {role==="admin" && showGuide && <GuideModal onClose={() => setShowGuide(false)} />}
      {role==="admin" && showDownload && <DownloadExcel onClose={() => setShowDownload(false)} />}
      {role==="admin" && showChangePw && (
        <ChangePassword
          onClose={() => setShowChangePw(false)}
          onLoggedOut={onLogout}
        />
      )}
    </div>
  );
}
