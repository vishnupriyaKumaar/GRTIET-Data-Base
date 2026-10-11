import React, { useState, useEffect } from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import api from "./api";
import Login from "./components/Login.jsx";
import Dashboard from "./components/Dashboard.jsx";
import Layout from "./components/Layout.jsx";
import PrintView from "./components/PrintView.jsx";
import StudentView from "./components/StudentView.jsx";
import CompanyBatch from "./components/CompanyBatch.jsx";
import IntroSplash from "./components/IntroSplash.jsx";

export default function App() {
  const location = useLocation();
  // OTC intro: shown once each time the app is opened (not on print pages).
  const [introDone, setIntroDone] = useState(() => /^\/(print|company\/batch)\//.test(location.pathname));
  const splash = !introDone ? <IntroSplash onDone={() => setIntroDone(true)} /> : null;

  const [role, setRole] = useState(null), [loading, setLoading] = useState(true);
  useEffect(() => {
    api.get("/auth/me").then((r) => setRole(r.data.role)).catch(() => setRole(null)).finally(() => setLoading(false));
    const expired = () => setRole(null);
    window.addEventListener("session-expired", expired);
    return () => window.removeEventListener("session-expired", expired);
  }, []);
  const logout = async () => { await api.post("/auth/logout"); setRole(null); };

  if (loading) return <>{splash}<p style={{ padding: 24 }}>Loading…</p></>;
  return (
    <>
      {splash}
      <Routes>
        <Route path="/print/:rollNo" element={role === "admin" ? <PrintView /> : <Navigate to="/" replace />} />
        <Route path="/company/batch/:batch" element={role === "admin" ? <CompanyBatch /> : <Navigate to="/" replace />} />
        <Route path="/student/:rollNo" element={role === "admin" ? <Layout><StudentView /></Layout> : <Navigate to="/" replace />} />
        <Route path="/*" element={<Layout>{role ? <Dashboard role={role} onLogout={logout} /> : <Login onSuccess={setRole} />}</Layout>} />
      </Routes>
    </>
  );
}
