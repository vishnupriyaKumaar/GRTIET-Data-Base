import React from "react";

export default function Layout({ children }) {
  return (
    <div className="app-shell">
      <div className="app-background" />
      <div className="app-overlay" />

      <div className="app-content">
        <header className="app-topbar">
          <img src="/logo.png" alt="GRT Institute of Engineering and Technology" className="app-topbar-logo" />
          <div className="app-topbar-divider" />
          <div className="app-topbar-text">
            <span className="app-topbar-kicker">Department of Computer Science and Engineering</span>
            <span className="app-topbar-title">Student Records Register</span>
          </div>
        </header>

        <main className="app-main">{children}</main>

        <footer className="app-footer">
          <p>&copy; CopyRight &mdash; Department of Computer Science (Batch 2024-2028)</p>
          <p className="app-footer-credit">
            <img src="/otc-logo.png" alt="" />
            Made by Team OTC
          </p>
        </footer>
      </div>
    </div>
  );
}
