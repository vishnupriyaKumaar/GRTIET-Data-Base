import React, { useState } from "react";
import api from "../api";
import { IconLock, IconUser, IconShield, IconArrowLeft } from "./Icons.jsx";

// Landing screen. Two steps:
//  1. "choice" - pick Student (no password, minimum access to Add Student
//     only) or Admin (full access, password-gated).
//  2. "password" - only reached for Admin.
export default function Login({ onSuccess }) {
  const [step, setStep] = useState("choice");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleStudent() {
    setError("");
    setLoading(true);
    try {
      const res = await api.post("/auth/student-login", {});
      if (res.data.success) onSuccess(res.data.role);
    } catch (err) {
      setError(err.response?.data?.message || "Could not continue. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleAdminSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await api.post("/auth/login", { password });
      if (res.data.success) onSuccess(res.data.role);
    } catch (err) {
      setError(err.response?.data?.message || "Login failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card login-card">
      <img src="/logo.png" alt="GRT Institute of Engineering and Technology" className="login-crest" />
      <h1>Student Records Register</h1>

      {step === "choice" && (
        <>
          <p className="subtitle">Choose how you'd like to continue</p>
          <div className="role-choice">
            <button type="button" className="role-choice-btn" onClick={handleStudent} disabled={loading}>
              <IconUser />
              <span>Student</span>
              <small>Add your own record — no password needed</small>
            </button>
            <button type="button" className="role-choice-btn" onClick={() => { setStep("password"); setError(""); }} disabled={loading}>
              <IconShield />
              <span>Admin</span>
              <small>Full access — password required</small>
            </button>
          </div>
          {error && <p className="error-text">{error}</p>}
        </>
      )}

      {step === "password" && (
        <>
          <button type="button" className="back-link" onClick={() => { setStep("choice"); setError(""); setPassword(""); }}>
            <IconArrowLeft /> Back
          </button>
          <p className="subtitle">Enter the Admin password to open full access</p>
          <form onSubmit={handleAdminSubmit}>
            <label htmlFor="password">Password</label>
            <div className="login-field">
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter Admin password"
                autoFocus
                required
              />
            </div>
            {error && <p className="error-text">{error}</p>}
            <button type="submit" className="btn-primary" disabled={loading}>
              <IconLock /> {loading ? "Checking..." : "Login as Admin"}
            </button>
          </form>
        </>
      )}
    </div>
  );
}
