import { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Navbar() {
  const { user, logout, isStaff, isAdmin } = useAuth();
  const navigate  = useNavigate();
  const location  = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate("/login");
    setSidebarOpen(false);
  };

  if (!user) return null;

  /* ── Navigation items per role ─────────────────────────────── */
  const customerLinks = [
    {
      to: "/my-tickets",
      label: "Dashboard",
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="3" width="7" height="7" rx="1"/>
          <rect x="14" y="3" width="7" height="7" rx="1"/>
          <rect x="3" y="14" width="7" height="7" rx="1"/>
          <rect x="14" y="14" width="7" height="7" rx="1"/>
        </svg>
      ),
    },
    {
      to: "/profile",
      label: "Profile",
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
          <circle cx="12" cy="7" r="4"/>
        </svg>
      ),
    },
  ];

  const staffLinks = [
    {
      to: "/dashboard",
      label: "Dashboard",
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="3" width="7" height="7" rx="1"/>
          <rect x="14" y="3" width="7" height="7" rx="1"/>
          <rect x="3" y="14" width="7" height="7" rx="1"/>
          <rect x="14" y="14" width="7" height="7" rx="1"/>
        </svg>
      ),
    },
    {
      to: "/tickets",
      label: "All Tickets",
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M9 12h6m-6 4h6M5 5h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z"/>
        </svg>
      ),
    },
    {
      to: "/escalations",
      label: "Escalations",
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0zM12 9v4m0 4h.01"/>
        </svg>
      ),
    },
    ...(isAdmin ? [{
      to: "/knowledge-base",
      label: "Knowledge Base",
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
          <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
        </svg>
      ),
    }] : []),
    {
      to: "/profile",
      label: "Profile",
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
          <circle cx="12" cy="7" r="4"/>
        </svg>
      ),
    },
  ];

  const navLinks = isStaff ? staffLinks : customerLinks;
  const isActive = (to) => location.pathname === to;

  return (
    <>
      {/* ── Top Navbar ─────────────────────────────────────────── */}
      <nav className="navbar">
        <div className="navbar__left">
          {/* Hamburger toggle */}
          <button
            className="sidebar-toggle"
            onClick={() => setSidebarOpen(true)}
            aria-label="Open menu"
          >
            <span />
            <span />
            <span />
          </button>

          <div className="navbar__brand">
            <Link to={isStaff ? "/dashboard" : "/my-tickets"}>
              AI Support
            </Link>
          </div>
        </div>

        {/* Inline links (desktop) */}
        <div className="navbar__links">
          {navLinks.map(link => (
            <Link
              key={link.to}
              to={link.to}
              className={isActive(link.to) ? "navbar__link--active" : ""}
            >
              {link.label}
            </Link>
          ))}
        </div>

        <div className="navbar__user">
          <span className="user-name">{user.name}</span>
          <span className={`role-badge role-badge--${user.role}`}>{user.role}</span>
          <button onClick={handleLogout} className="btn btn-ghost btn-sm">
            Sign out
          </button>
        </div>
      </nav>

      {/* ── Sidebar Overlay ────────────────────────────────────── */}
      <div
        className={`sidebar-overlay ${sidebarOpen ? "sidebar-overlay--open" : ""}`}
        onClick={() => setSidebarOpen(false)}
      />

      {/* ── Sliding Left Sidebar ───────────────────────────────── */}
      <aside className={`sidebar ${sidebarOpen ? "sidebar--open" : ""}`}>

        {/* Sidebar header */}
        <div className="sidebar__header">
          <div className="sidebar__brand">
            <span className="sidebar__brand-ai">AI</span>
            <span className="sidebar__brand-support">Support</span>
          </div>
          <button
            className="sidebar__close"
            onClick={() => setSidebarOpen(false)}
            aria-label="Close menu"
          >
            ×
          </button>
        </div>

        {/* User card */}
        <div className="sidebar__user-card">
          <div className="sidebar__avatar">
            {user.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <div className="sidebar__user-name">{user.name}</div>
            <span className={`role-badge role-badge--${user.role}`}>{user.role}</span>
          </div>
        </div>

        {/* Nav links */}
        <nav className="sidebar__nav">
          <div className="sidebar__nav-label">Navigation</div>
          {navLinks.map(link => (
            <Link
              key={link.to}
              to={link.to}
              className={`sidebar__link ${isActive(link.to) ? "sidebar__link--active" : ""}`}
              onClick={() => setSidebarOpen(false)}
            >
              <span className="sidebar__link-icon">{link.icon}</span>
              {link.label}
            </Link>
          ))}
        </nav>

        {/* Divider + logout */}
        <div className="sidebar__footer">
          <button className="sidebar__logout" onClick={handleLogout}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
              <polyline points="16 17 21 12 16 7"/>
              <line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
            Sign Out
          </button>
        </div>

      </aside>
    </>
  );
}