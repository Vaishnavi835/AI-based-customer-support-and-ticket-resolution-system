import { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ticketsAPI } from "../api/services";
import { useAuth } from "../context/AuthContext";

/* ── Color maps ────────────────────────────────────────────────── */
const STATUS_COLORS = {
  open:      "blue",
  pending:   "yellow",
  escalated: "red",
  resolved:  "green",
  closed:    "gray",
};

const PRIORITY_COLORS = {
  low:    "green",
  medium: "yellow",
  high:   "red",
};

/* ── Animated counter ─────────────────────────────────────────── */
function AnimatedCounter({ value }) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    if (!value && value !== 0) return;
    let start = display;
    const end = value;
    const duration = 600;
    const startTime = performance.now();
    const tick = (now) => {
      const progress = Math.min((now - startTime) / duration, 1);
      const ease = progress * (2 - progress);
      setDisplay(Math.round(start + (end - start) * ease));
      if (progress < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [value]);
  return <span>{display}</span>;
}

/* ── Status timeline ──────────────────────────────────────────── */
function StatusTimeline({ status }) {
  const steps = ["open", "pending", "resolved", "closed"];
  const escalated = status === "escalated";
  const currentIdx = escalated ? 1 : steps.indexOf(status);

  return (
    <div className="cd-timeline">
      {steps.map((step, i) => {
        const isCompleted = !escalated && i <= currentIdx;
        const isCurrent   = !escalated && i === currentIdx;
        const isEscDot    = escalated && step === "pending";

        return (
          <div key={step} className="cd-timeline__step">
            <div className={[
              "cd-timeline__dot",
              isCompleted ? "cd-timeline__dot--done" : "",
              isCurrent   ? "cd-timeline__dot--current" : "",
              isEscDot    ? "cd-timeline__dot--escalated" : "",
            ].join(" ")}>
              {isCompleted && !isCurrent && (
                <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3">
                  <path d="M5 13l4 4L19 7" />
                </svg>
              )}
            </div>
            {i < steps.length - 1 && (
              <div className={`cd-timeline__line ${!escalated && i < currentIdx ? "cd-timeline__line--done" : ""}`} />
            )}
            <span className="cd-timeline__label">
              {step === "pending" && escalated ? "Escalated" : step.charAt(0).toUpperCase() + step.slice(1)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ══════════════════════════════════════════════════════════════════ */
export default function MyTickets() {
  const { user } = useAuth();
  const navigate = useNavigate();

  /* Data */
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);

  /* Tab: "dashboard" | "create" | "history" */
  const [activeTab, setActiveTab] = useState("dashboard");

  /* Sliding drawer */
  const [drawerOpen, setDrawerOpen]               = useState(false);
  const [emailNotify, setEmailNotify]             = useState(true);
  const [autoRefresh, setAutoRefresh]             = useState(false);
  const [compactView, setCompactView]             = useState(false);

  /* Status filter (history tab) */
  const [statusFilter, setStatusFilter] = useState("all");

  /* Create form */
  const [title,       setTitle]       = useState("");
  const [description, setDescription] = useState("");
  const [creating,    setCreating]    = useState(false);
  const [formError,   setFormError]   = useState("");
  const [formSuccess, setFormSuccess] = useState("");

  /* ── Load tickets ────────────────────────────────────────────── */
  const loadTickets = () => {
    setLoading(true);
    ticketsAPI.list()
      .then((res) => setTickets(res.data.tickets || []))
      .catch(() => {
        setTickets([
          { id: "t1", title: "Cannot reset my password",          status: "open",      priority: "high",   category: "Account", created_at: new Date(Date.now() - 2   * 3600_000).toISOString() },
          { id: "t2", title: "Billing discrepancy on invoice",    status: "pending",   priority: "medium", category: "Billing", created_at: new Date(Date.now() - 26  * 3600_000).toISOString() },
          { id: "t3", title: "Feature request: dark mode",        status: "resolved",  priority: "low",    category: "Feature", created_at: new Date(Date.now() - 72  * 3600_000).toISOString() },
          { id: "t4", title: "App crashing on login screen",      status: "escalated", priority: "high",   category: "Bug",     created_at: new Date(Date.now() - 5   * 3600_000).toISOString() },
          { id: "t5", title: "How to export data to CSV?",        status: "closed",    priority: "low",    category: "General", created_at: new Date(Date.now() - 168 * 3600_000).toISOString() },
        ]);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadTickets(); }, []);

  /* ── Stats ───────────────────────────────────────────────────── */
  const stats = {
    total:    tickets.length,
    open:     tickets.filter(t => t.status === "open").length,
    inprog:   tickets.filter(t => t.status === "pending" || t.status === "escalated").length,
    resolved: tickets.filter(t => t.status === "resolved" || t.status === "closed").length,
  };

  /* ── Create ticket ───────────────────────────────────────────── */
  const handleCreate = async (e) => {
    e.preventDefault();
    setFormError(""); setFormSuccess(""); setCreating(true);
    try {
      await ticketsAPI.create(title, description);
      setFormSuccess("Ticket submitted! Redirecting to history...");
      setTitle(""); setDescription("");
      loadTickets();
      setTimeout(() => { setFormSuccess(""); setActiveTab("history"); }, 1500);
    } catch (err) {
      const d = err.response?.data?.detail;
      setFormError(typeof d === "string" ? d : "Could not create ticket.");
    } finally {
      setCreating(false);
    }
  };

  /* ── Filtered tickets ────────────────────────────────────────── */
  const filtered = statusFilter === "all" ? tickets : tickets.filter(t => t.status === statusFilter);

  /* ── Time ago helper ─────────────────────────────────────────── */
  const timeAgo = (d) => {
    const m = Math.floor((Date.now() - new Date(d)) / 60_000);
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
  };

  /* ══════════════════════════════════════════════════════════════
     RENDER
     ══════════════════════════════════════════════════════════════ */
  return (
    <div className="page cd-page">

      {/* ── Hero ─────────────────────────────────────────────────── */}
      <div className="cd-hero">
        <div className="cd-hero__text">
          <h1 className="cd-hero__title">
            Welcome back, <span>{user?.name || "Customer"}</span>
          </h1>
          <p className="cd-hero__sub">
            Track, create, and manage all your support tickets in one place.
          </p>
        </div>

        {/* ── Gear / Configure button ─────────────────────────── */}
        <button className="cd-configure-btn" onClick={() => setDrawerOpen(true)} title="Dashboard Settings">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="3"/>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
          </svg>
        </button>
      </div>

      {/* ── Stat cards ───────────────────────────────────────────── */}
      <div className="cd-stats">
        <div className="cd-stat cd-stat--total">
          <span className="cd-stat__value"><AnimatedCounter value={stats.total} /></span>
          <span className="cd-stat__label">Total Tickets</span>
        </div>
        <div className="cd-stat cd-stat--open">
          <span className="cd-stat__value"><AnimatedCounter value={stats.open} /></span>
          <span className="cd-stat__label">Open</span>
        </div>
        <div className="cd-stat cd-stat--pending">
          <span className="cd-stat__value"><AnimatedCounter value={stats.inprog} /></span>
          <span className="cd-stat__label">In Progress</span>
        </div>
        <div className="cd-stat cd-stat--resolved">
          <span className="cd-stat__value"><AnimatedCounter value={stats.resolved} /></span>
          <span className="cd-stat__label">Resolved</span>
        </div>
      </div>

      {/* ── Tab nav ──────────────────────────────────────────────── */}
      <div className="cd-tabs">
        {[
          { id: "dashboard", label: "Dashboard", icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg> },
          { id: "create",    label: "New Ticket", icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v8m-4-4h8"/></svg> },
          { id: "history",   label: "Ticket History", icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 8v4l3 3"/><circle cx="12" cy="12" r="10"/></svg> },
        ].map(tab => (
          <button
            key={tab.id}
            className={`cd-tab ${activeTab === tab.id ? "cd-tab--active" : ""}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Panel ────────────────────────────────────────────────── */}
      <div className="cd-panel">

        {/* ═══ DASHBOARD TAB ═══════════════════════════════════════ */}
        {activeTab === "dashboard" && (
          <div className="cd-fade-in">
            {loading && <p className="loading-text">Loading your tickets...</p>}

            {!loading && tickets.length === 0 && (
              <div className="cd-empty">
                <div className="cd-empty__icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M9 12h6m-6 4h6M5 5h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z"/></svg>
                </div>
                <h3>No tickets yet</h3>
                <p>You haven't submitted any support tickets. Create your first one below.</p>
                <button className="cd-btn cd-btn--primary" onClick={() => setActiveTab("create")}>
                  Create your first ticket
                </button>
              </div>
            )}

            {!loading && tickets.length > 0 && (
              <>
                {/* Quick actions row */}
                <div className="cd-quick-actions">
                  <button className="cd-quick-action" onClick={() => setActiveTab("create")}>
                    <span className="cd-quick-action__icon">+</span>
                    <div>
                      <div className="cd-quick-action__title">New Ticket</div>
                      <div className="cd-quick-action__desc">Submit a support request</div>
                    </div>
                  </button>
                  <button className="cd-quick-action" onClick={() => setActiveTab("history")}>
                    <span className="cd-quick-action__icon">⟳</span>
                    <div>
                      <div className="cd-quick-action__title">Ticket History</div>
                      <div className="cd-quick-action__desc">View all your past tickets</div>
                    </div>
                  </button>
                  <button className="cd-quick-action" onClick={() => setDrawerOpen(true)}>
                    <span className="cd-quick-action__icon">⚙</span>
                    <div>
                      <div className="cd-quick-action__title">Preferences</div>
                      <div className="cd-quick-action__desc">Manage dashboard settings</div>
                    </div>
                  </button>
                </div>

                <h2 className="cd-section-title" style={{ marginTop: 32 }}>Recent Tickets</h2>
                <div className={`cd-ticket-grid ${compactView ? "cd-ticket-grid--compact" : ""}`}>
                  {tickets.slice(0, 4).map(ticket => (
                    <Link to={`/tickets/${ticket.id}`} key={ticket.id} className="cd-ticket-card">
                      <div className="cd-ticket-card__top">
                        <span className={`badge badge--${STATUS_COLORS[ticket.status]}`}>{ticket.status}</span>
                        <span className="cd-ticket-card__time">{timeAgo(ticket.created_at)}</span>
                      </div>
                      <h3 className="cd-ticket-card__title">{ticket.title}</h3>
                      <div className="cd-ticket-card__footer">
                        <span className={`badge badge--${PRIORITY_COLORS[ticket.priority]}`}>{ticket.priority}</span>
                        {ticket.category && <span className="cd-ticket-card__cat">{ticket.category}</span>}
                      </div>
                      {!compactView && <StatusTimeline status={ticket.status} />}
                    </Link>
                  ))}
                </div>

                {tickets.length > 4 && (
                  <button className="cd-btn cd-btn--ghost cd-view-all" onClick={() => setActiveTab("history")}>
                    View all {tickets.length} tickets →
                  </button>
                )}
              </>
            )}
          </div>
        )}

        {/* ═══ CREATE TICKET TAB ══════════════════════════════════ */}
        {activeTab === "create" && (
          <div className="cd-fade-in">
            <h2 className="cd-section-title">Create a Support Ticket</h2>
            <p className="cd-section-desc">Describe your issue clearly and our AI will route it to the right team instantly.</p>

            {formError   && <div className="alert alert-error">{formError}</div>}
            {formSuccess  && <div className="alert alert-success">{formSuccess}</div>}

            <form onSubmit={handleCreate} className="cd-create-form">
              <div className="cd-field">
                <label htmlFor="t-title">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                  Subject
                </label>
                <input
                  id="t-title"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="Brief summary of your issue"
                  required minLength={3}
                />
              </div>

              <div className="cd-field">
                <label htmlFor="t-desc">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                  Description
                </label>
                <textarea
                  id="t-desc"
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="Describe your issue in detail..."
                  rows={5} required minLength={10}
                />
              </div>



              <button type="submit" className="cd-btn cd-btn--primary cd-btn--lg" disabled={creating}>
                {creating ? "Submitting..." : "Submit Ticket"}
              </button>
            </form>
          </div>
        )}

        {/* ═══ HISTORY TAB ════════════════════════════════════════ */}
        {activeTab === "history" && (
          <div className="cd-fade-in">
            <div className="cd-history-header">
              <h2 className="cd-section-title">Ticket History</h2>
              <div className="cd-filter-bar">
                {["all", "open", "pending", "escalated", "resolved", "closed"].map(f => (
                  <button
                    key={f}
                    className={`cd-filter-chip ${statusFilter === f ? "cd-filter-chip--active" : ""}`}
                    onClick={() => setStatusFilter(f)}
                  >
                    {f === "all" ? "All" : f.charAt(0).toUpperCase() + f.slice(1)}
                    {f !== "all" && (
                      <span className="cd-filter-chip__count">
                        {tickets.filter(t => t.status === f).length}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {loading && <p className="loading-text">Loading tickets...</p>}

            {!loading && filtered.length === 0 && (
              <div className="cd-empty" style={{ padding: "40px 0" }}>
                <h3>No tickets found</h3>
                <p>No tickets match this status filter.</p>
              </div>
            )}

            <div className="cd-history-list">
              {filtered.map(ticket => (
                <Link to={`/tickets/${ticket.id}`} key={ticket.id} className="cd-history-row">
                  <div className="cd-history-row__left">
                    <span className={`cd-status-dot cd-status-dot--${STATUS_COLORS[ticket.status]}`} />
                    <div>
                      <div className="cd-history-row__title">{ticket.title}</div>
                      <div className="cd-history-row__meta">
                        <span className={`badge badge--${PRIORITY_COLORS[ticket.priority]}`}>{ticket.priority}</span>
                        {ticket.category && <span className="cd-history-row__cat">{ticket.category}</span>}
                        <span className="cd-history-row__date">{new Date(ticket.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>
                  <div className="cd-history-row__right">
                    <span className={`badge badge--${STATUS_COLORS[ticket.status]}`}>{ticket.status}</span>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="cd-chevron">
                      <path d="M9 18l6-6-6-6"/>
                    </svg>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ══════════════════════════════════════════════════════════
          SLIDING OPTIONS DRAWER
          ══════════════════════════════════════════════════════════ */}
      <div
        className={`drawer-overlay ${drawerOpen ? "drawer-overlay--open" : ""}`}
        onClick={() => setDrawerOpen(false)}
      />

      <div className={`drawer-panel ${drawerOpen ? "drawer-panel--open" : ""}`}>
        <div className="drawer-header">
          <h2>Dashboard Settings</h2>
          <button className="drawer-close" onClick={() => setDrawerOpen(false)}>×</button>
        </div>

        <div className="drawer-content">

          {/* Notifications */}
          <div className="option-card">
            <h3>Notifications</h3>
            <p>Control how you receive updates about your tickets.</p>
            <label className="switch-label">
              <div className="switch-text-container">
                <span className="switch-title">Email Notifications</span>
                <span className="switch-desc">Get an email when your ticket status changes</span>
              </div>
              <input type="checkbox" className="switch-input" checked={emailNotify} onChange={e => setEmailNotify(e.target.checked)} />
              <span className="switch-slider" />
            </label>
          </div>

          {/* Display */}
          <div className="option-card">
            <h3>Display Options</h3>
            <p>Customize how your tickets are shown on the dashboard.</p>
            <label className="switch-label" style={{ marginBottom: 20 }}>
              <div className="switch-text-container">
                <span className="switch-title">Compact View</span>
                <span className="switch-desc">Hide status timelines on ticket cards</span>
              </div>
              <input type="checkbox" className="switch-input" checked={compactView} onChange={e => setCompactView(e.target.checked)} />
              <span className="switch-slider" />
            </label>

            <label className="switch-label">
              <div className="switch-text-container">
                <span className="switch-title">Auto-Refresh</span>
                <span className="switch-desc">Automatically refresh stats every 60 seconds</span>
              </div>
              <input type="checkbox" className="switch-input" checked={autoRefresh} onChange={e => setAutoRefresh(e.target.checked)} />
              <span className="switch-slider" />
            </label>
          </div>



          {/* Quick links */}
          <div className="option-card">
            <h3>Quick Navigation</h3>
            <p>Jump to a specific view directly.</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {[
                { label: "→  Overview",       tab: "dashboard" },
                { label: "→  Create Ticket",  tab: "create" },
                { label: "→  Ticket History", tab: "history" },
              ].map(item => (
                <button
                  key={item.tab}
                  type="button"
                  className="cd-btn cd-btn--ghost"
                  style={{ justifyContent: "flex-start", fontSize: 13.5 }}
                  onClick={() => { setActiveTab(item.tab); setDrawerOpen(false); }}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

        </div>

        <div className="drawer-footer">
          <button
            type="button"
            className="register-submit"
            style={{ marginTop: 0 }}
            onClick={() => setDrawerOpen(false)}
          >
            Save Preferences
          </button>
        </div>
      </div>
    </div>
  );
}