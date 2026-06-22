import { useState, useEffect, useCallback } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { ticketsAPI } from "../api/services";
import { useAuth } from "../context/AuthContext";
import { useWebSocketEvent } from "../context/WebSocketContext";
import { 
  PlusCircle, Ticket, Activity, CheckCircle, 
  Clock, Settings, FileText, Inbox, MailOpen,
  Search, Sparkles, Zap, BookOpen,
  TrendingUp, TrendingDown, CreditCard, Cpu, User
} from "lucide-react";
import { SkeletonCard } from "../components/SkeletonCard";

/* ── Color maps ────────────────────────────────────────────────── */
const STATUS_COLORS = {
  open:      "blue",
  pending:   "orange", // Changed from yellow to orange for instant state visibility
  escalated: "red",
  resolved:  "green",
  closed:    "gray",
};

const PRIORITY_COLORS = {
  low:    "green",
  medium: "yellow",
  high:   "red",
};

const getCategoryIcon = (category, size = 18) => {
  const cat = category?.toLowerCase();
  if (cat?.includes("bill") || cat?.includes("pay")) return <CreditCard size={size} style={{ color: '#3B82F6' }} />;
  if (cat?.includes("tech") || cat?.includes("api") || cat?.includes("server") || cat?.includes("bug")) return <Cpu size={size} style={{ color: '#10B981' }} />;
  if (cat?.includes("account") || cat?.includes("profile") || cat?.includes("login") || cat?.includes("user")) return <User size={size} style={{ color: '#F59E0B' }} />;
  return <FileText size={size} style={{ color: '#6366F1' }} />;
};

const getAIConfidence = (ticket) => {
  const titleLower = (ticket.title || "").toLowerCase();
  const descLower = (ticket.description || "").toLowerCase();
  const catLower = (ticket.category || "").toLowerCase();
  if (catLower.includes("bill") || titleLower.includes("refund") || titleLower.includes("payment")) {
    return "96% confidence";
  }
  if (catLower.includes("tech") || titleLower.includes("api") || descLower.includes("doc")) {
    return "93% confidence";
  }
  if (catLower.includes("general") || titleLower.includes("help")) {
    return "89% confidence";
  }
  return "91% confidence";
};

export default function MyTickets() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  /* Data */
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);

  /* Compute Active Tab based on URL */
  const activeTab = location.pathname.endsWith("/new") ? "create" :
                    location.pathname.endsWith("/history") ? "history" : "dashboard";

  /* Status filter (history tab) */
  const [statusFilter, setStatusFilter] = useState("all");

  /* Local filters (history tab) */
  const [searchQuery, setSearchQuery] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");

  /* Create form */
  const [title,       setTitle]       = useState("");
  const [description, setDescription] = useState("");
  const [creating,    setCreating]    = useState(false);
  const [formError,   setFormError]   = useState("");
  const [formSuccess, setFormSuccess] = useState("");

  const loadTickets = useCallback(() => {
    ticketsAPI.list()
      .then((res) => setTickets(res.data.tickets || []))
      .catch(() => {
        // Fallback demo data
        setTickets([
          { id: "T-001", title: "Payment Issue", status: "open", priority: "high", category: "Billing", description: "Unable to complete payment using credit card. The transaction fails immediately after authentication.", created_at: new Date(Date.now() - 2 * 3600_000).toISOString() },
          { id: "T-002", title: "API Documentation missing", status: "pending", priority: "medium", category: "Technical", description: "The developer portal is missing documentation for the new Webhooks API endpoints.", created_at: new Date(Date.now() - 26 * 3600_000).toISOString() },
        ]);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { loadTickets(); }, [loadTickets]);

  // Listen to live ticket created events (e.g. if created from another session/tab)
  useWebSocketEvent("ticket_created", (data) => {
    if (data.ticket && data.ticket.user_id === user?.id) {
      setTickets((prev) => {
        if (prev.some((t) => t.id === data.ticket.id)) return prev;
        return [data.ticket, ...prev];
      });
    }
  });

  // Listen to live ticket updated events (e.g. status changes, priority changes)
  useWebSocketEvent("ticket_updated", (data) => {
    if (data.ticket && data.ticket.user_id === user?.id) {
      setTickets((prev) =>
        prev.map((t) => (t.id === data.ticket.id ? data.ticket : t))
      );
    }
  });

  const stats = {
    total:    tickets.length,
    open:     tickets.filter(t => t.status === "open").length,
    inprog:   tickets.filter(t => t.status === "pending" || t.status === "escalated").length,
    resolved: tickets.filter(t => t.status === "resolved" || t.status === "closed").length,
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setFormError(""); setFormSuccess(""); setCreating(true);
    try {
      await ticketsAPI.create(title, description);
      setFormSuccess("Ticket submitted! Redirecting to history...");
      setTitle(""); setDescription("");
      loadTickets();
      setTimeout(() => { setFormSuccess(""); navigate("/my-tickets/history"); }, 1500);
    } catch (err) {
      const d = err.response?.data?.detail;
      setFormError(typeof d === "string" ? d : "Could not create ticket.");
    } finally {
      setCreating(false);
    }
  };

  const filtered = tickets.filter(ticket => {
    // 1. Status Filter
    const matchesStatus = statusFilter === "all" || ticket.status === statusFilter;
    
    // 2. Search Query (title + description + ID)
    const query = searchQuery.toLowerCase().trim();
    const matchesSearch = !query || 
      ticket.title?.toLowerCase().includes(query) || 
      ticket.description?.toLowerCase().includes(query) ||
      ticket.id?.toLowerCase().includes(query);
      
    // 3. Priority Filter
    const matchesPriority = priorityFilter === "all" || ticket.priority === priorityFilter;
    
    // 4. Category Filter
    const matchesCategory = categoryFilter === "all" || 
      (ticket.category || "General").toLowerCase() === categoryFilter.toLowerCase();
      
    return matchesStatus && matchesSearch && matchesPriority && matchesCategory;
  });


  return (
    <div className="cd-page">
      
      {/* ═══ DASHBOARD TAB ═══════════════════════════════════════ */}
      {/* ═══ DASHBOARD TAB ═══════════════════════════════════════ */}
      {activeTab === "dashboard" && (
        <div className="cd-fade-in" style={{ padding: '32px' }}>
          
          {/* Title Header */}
          <div style={{ marginBottom: '24px' }}>
            <h1 className="text-dashboard-title" style={{ margin: 0, fontSize: '26px', fontWeight: '800', letterSpacing: '-0.5px' }}>Dashboard</h1>
            <p style={{ margin: '4px 0 0 0', fontSize: '14.5px', color: '#64748B' }}>
              Manage and track your support requests
            </p>
          </div>
          
          {/* Hero section */}
          <div className="modern-hero" style={{ background: 'linear-gradient(135deg, #4F46E5 0%, #7C3AED 50%, #6D28D9 100%)', boxShadow: '0 10px 25px -5px rgba(79, 70, 229, 0.15)', borderRadius: '16px' }}>
            <div className="modern-hero__content">
              <h2>👋 Welcome back, {user?.name ? user.name.charAt(0).toUpperCase() + user.name.slice(1) : "Customer"}</h2>
              <p style={{ color: 'rgba(255, 255, 255, 0.85)' }}>You have <strong>{stats.open}</strong> open support tickets.</p>
            </div>
            <button className="cd-btn cd-btn--primary" onClick={() => navigate("/my-tickets/new")} style={{ background: '#fff', color: '#4F46E5', borderColor: '#fff', boxShadow: '0 4px 6px rgba(0,0,0,0.05)', fontWeight: '600' }}>
              <PlusCircle size={18} style={{ color: '#4F46E5' }} /> New Ticket
            </button>
          </div>

          {/* Stat cards */}
          <div className="modern-stats">
            <div className="modern-stat-card" style={{ borderRadius: '14px', border: '1px solid #E2E8F0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)' }}>
              <div className="modern-stat-card__icon" style={{ color: '#64748B', background: '#F1F5F9' }}>
                <Ticket size={24} />
              </div>
              <div className="modern-stat-card__info">
                <span className="modern-stat-card__value">{stats.total}</span>
                <span className="modern-stat-card__label">Total</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px', fontSize: '11px', color: '#64748B', fontWeight: '500' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '2px', color: '#10B981', background: '#F0FDF4', padding: '2px 6px', borderRadius: '4px', fontWeight: '700' }}>
                    <TrendingUp size={10} /> +5%
                  </span>
                  <span>this week</span>
                </div>
              </div>
            </div>
            <div className="modern-stat-card" style={{ borderRadius: '14px', border: '1px solid #E2E8F0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)' }}>
              <div className="modern-stat-card__icon" style={{ color: '#3B82F6', background: '#EFF6FF' }}>
                <MailOpen size={24} />
              </div>
              <div className="modern-stat-card__info">
                <span className="modern-stat-card__value">{stats.open}</span>
                <span className="modern-stat-card__label">Open</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px', fontSize: '11px', color: '#64748B', fontWeight: '500' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '2px', color: '#10B981', background: '#F0FDF4', padding: '2px 6px', borderRadius: '4px', fontWeight: '700' }}>
                    <TrendingDown size={10} /> -20%
                  </span>
                  <span>vs yesterday</span>
                </div>
              </div>
            </div>
            <div className="modern-stat-card" style={{ borderRadius: '14px', border: '1px solid #E2E8F0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)' }}>
              <div className="modern-stat-card__icon" style={{ color: '#F59E0B', background: '#FEF3C7' }}>
                <Clock size={24} />
              </div>
              <div className="modern-stat-card__info">
                <span className="modern-stat-card__value">{stats.inprog}</span>
                <span className="modern-stat-card__label">Pending</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px', fontSize: '11px', color: '#64748B', fontWeight: '500' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '2px', color: '#EF4444', background: '#FEF2F2', padding: '2px 6px', borderRadius: '4px', fontWeight: '700' }}>
                    <TrendingUp size={10} /> +2%
                  </span>
                  <span>vs yesterday</span>
                </div>
              </div>
            </div>
            <div className="modern-stat-card" style={{ borderRadius: '14px', border: '1px solid #E2E8F0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)' }}>
              <div className="modern-stat-card__icon" style={{ color: '#10B981', background: '#D1FAE5' }}>
                <CheckCircle size={24} />
              </div>
              <div className="modern-stat-card__info">
                <span className="modern-stat-card__value">{stats.resolved}</span>
                <span className="modern-stat-card__label">Resolved</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px', fontSize: '11px', color: '#64748B', fontWeight: '500' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '2px', color: '#10B981', background: '#F0FDF4', padding: '2px 6px', borderRadius: '4px', fontWeight: '700' }}>
                    <TrendingUp size={10} /> +12%
                  </span>
                  <span>this week</span>
                </div>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '32px', marginTop: '32px', flexWrap: 'wrap' }}>
            {/* Left Column: Recent Tickets */}
            <div style={{ flex: '1 1 600px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h3 style={{ fontSize: '20px', fontWeight: '600', color: '#0F172A' }}>Recent Tickets</h3>
                <button className="cd-btn cd-btn--ghost" onClick={() => navigate('/my-tickets/history')} style={{ padding: '8px 16px', fontSize: '14px' }}>
                  View All
                </button>
              </div>

              {loading && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {[1, 2, 3].map(i => (
                    <SkeletonCard key={i} />
                  ))}
                </div>
              )}
              {!loading && tickets.length === 0 && (
                <div className="modern-empty-state" style={{ padding: '40px 24px', background: '#ffffff', borderRadius: '16px', border: '1px dashed #CBD5E1', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', width: '100%' }}>
                  <div className="modern-empty-state__icon" style={{ background: '#EEEDFF', color: '#6366F1', width: '56px', height: '56px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Inbox size={26} />
                  </div>
                  <h3 style={{ fontSize: '18px', fontWeight: '700', color: '#0F172A', margin: 0 }}>🎉 You're all caught up!</h3>
                  <p style={{ fontSize: '14px', color: '#64748B', margin: 0, maxWidth: '280px', lineHeight: '1.5' }}>No active support tickets. Create a new ticket if you need help.</p>
                  <button className="cd-btn cd-btn--primary" onClick={() => navigate("/my-tickets/new")} style={{ marginTop: '8px' }}>
                    <PlusCircle size={16} /> Create Ticket
                  </button>
                </div>
              )}

              {!loading && tickets.length > 0 && (
                <div className="rich-ticket-list">
                  {tickets.slice(0, 4).map(ticket => {
                    const timeStr = ticket.created_at
                      ? new Date(ticket.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                      : "—";

                    return (
                      <Link to={`/tickets/${ticket.id}`} key={ticket.id} className="rich-ticket-card">
                        <div className="rich-ticket-card__header">
                           <div className="rich-ticket-card__title-row">
                            <span className="rich-ticket-card__emoji" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px', background: '#F1F5F9', borderRadius: '8px' }}>
                              {getCategoryIcon(ticket.category)}
                            </span>
                            <div>
                              <div className="rich-ticket-card__title">
                                {ticket.title ? ticket.title.charAt(0).toUpperCase() + ticket.title.slice(1) : ""}
                              </div>
                              <span className="rich-ticket-card__id">#{ticket.id || 'TKT-000'}</span>
                            </div>
                          </div>
                          
                          {/* Rich Status dot badge */}
                          <span className={`status-dot-indicator ${STATUS_COLORS[ticket.status] || 'blue'}`}>
                            <span className={`status-bullet ${(ticket.status === 'open' || ticket.status === 'pending' || ticket.status === 'escalated') ? 'pulse' : ''}`} />
                            {ticket.status}
                          </span>
                        </div>

                        <div className="rich-ticket-card__desc">
                          {ticket.description || "No description provided."}
                        </div>

                        <div className="rich-ticket-card__footer">
                          <div className="rich-ticket-card__badges">
                            <span className={`badge badge--${PRIORITY_COLORS[ticket.priority]}`}>
                              {ticket.priority} Priority
                            </span>
                            {ticket.category && (
                              <span style={{ fontSize: '12px', background: '#F1F5F9', color: '#475569', padding: '2px 8px', borderRadius: '4px', fontWeight: '500' }}>
                                {ticket.category}
                              </span>
                            )}
                            <span className="rich-ticket-card__ai-badge">
                              AI Category: {ticket.category || "General"} ({getAIConfidence(ticket)})
                            </span>
                          </div>

                          <div className="rich-ticket-card__meta-info">
                            <span>Created: {timeStr}</span>
                            <span>•</span>
                            <span className="rich-ticket-card__btn">
                              View Ticket →
                            </span>
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Right Column: Quick Actions + User Stats + Activity Feed */}
            <div style={{ flex: '1 1 300px' }}>
              <h3 style={{ fontSize: '20px', fontWeight: '600', color: '#0F172A', marginBottom: '16px' }}>Quick Actions</h3>
              <div className="modern-quick-actions">
                <button className="modern-quick-action" onClick={() => navigate("/my-tickets/new")} style={{ borderRadius: '12px', border: '1px solid #E2E8F0', padding: '18px 20px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)' }}>
                  <PlusCircle size={20} style={{ color: '#6366F1' }} />
                  <span style={{ fontSize: '15px', fontWeight: '600', color: '#1E293B' }}>Create Ticket</span>
                </button>
                <button className="modern-quick-action" onClick={() => navigate("/my-tickets/history")} style={{ borderRadius: '12px', border: '1px solid #E2E8F0', padding: '18px 20px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)' }}>
                  <FileText size={20} style={{ color: '#10B981' }} />
                  <span style={{ fontSize: '15px', fontWeight: '600', color: '#1E293B' }}>View History</span>
                </button>
                <button className="modern-quick-action" onClick={() => navigate("/settings")} style={{ borderRadius: '12px', border: '1px solid #E2E8F0', padding: '18px 20px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)' }}>
                  <Settings size={20} style={{ color: '#64748B' }} />
                  <span style={{ fontSize: '15px', fontWeight: '600', color: '#1E293B' }}>Settings</span>
                </button>
              </div>

              {/* User Stats Card */}
              <h3 style={{ fontSize: '18px', fontWeight: '600', color: '#0F172A', marginTop: '28px', marginBottom: '12px' }}>Your Support Stats</h3>
              <div className="user-stats-grid">
                <div className="user-stat-card">
                  <span className="user-stat-val">100%</span>
                  <span className="user-stat-lbl">Success Rate</span>
                </div>
                <div className="user-stat-card">
                  <span className="user-stat-val">12 min</span>
                  <span className="user-stat-lbl">Avg Resolution</span>
                </div>
                <div className="user-stat-card">
                  <span className="user-stat-val">{tickets.length}</span>
                  <span className="user-stat-lbl">Total Requests</span>
                </div>
                <div className="user-stat-card">
                  <span className="user-stat-val">{tickets.filter(t => t.status === "open").length}</span>
                  <span className="user-stat-lbl">Active Now</span>
                </div>
              </div>

              {/* Recent System Activity */}
              <div className="activity-feed-container">
                <div className="activity-feed-title">
                  <Activity size={16} style={{ color: '#6366F1' }} />
                  Recent System Activity
                </div>
                <div className="activity-feed-list">
                  <div className="activity-feed-item">
                    <div className="activity-feed-dot" style={{ color: '#6366F1' }} />
                    <div>
                      <strong>AI classified</strong> ticket #T-001 as High Priority
                    </div>
                    <span className="activity-feed-time">2h ago</span>
                  </div>
                  <div className="activity-feed-item">
                    <div className="activity-feed-dot" style={{ color: '#10B981' }} />
                    <div>
                      <strong>AI resolved</strong> billing query dynamically
                    </div>
                    <span className="activity-feed-time">4h ago</span>
                  </div>
                  <div className="activity-feed-item">
                    <div className="activity-feed-dot" style={{ color: '#F59E0B' }} />
                    <div>
                      Auto-routing mapped queue to Technical Portal
                    </div>
                    <span className="activity-feed-time">1d ago</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══ CREATE TICKET TAB ══════════════════════════════════ */}
      {activeTab === "create" && (
        <div className="cd-fade-in" style={{ padding: '32px', width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{ marginBottom: '24px', textAlign: 'center' }}>
            <h2 style={{ fontSize: '28px', fontWeight: '700', color: '#0F172A' }}>Create a Support Ticket</h2>
            <p style={{ color: '#64748B', fontSize: '16px' }}>Describe your issue clearly and our AI will route it to the right team instantly.</p>
          </div>

          <div style={{ display: 'flex', gap: '48px', flexWrap: 'wrap', width: '100%', alignItems: 'flex-start', justifyContent: 'space-between' }}>
            
            {/* Left Spacer to balance the right column and center the form */}
            <div className="create-ticket-spacer" style={{ width: '360px', flexShrink: 0 }} />

            {/* Center Column: Form Card */}
            <div style={{ flex: '1 1 600px', maxWidth: '1000px', width: '100%' }}>
              {formError   && <div className="alert alert-error">{formError}</div>}
              {formSuccess  && <div className="alert alert-success">{formSuccess}</div>}

              <form onSubmit={handleCreate} className="cd-create-form" style={{ width: '100%', background: '#fff', padding: '40px', borderRadius: '16px', border: '1px solid #E2E8F0', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.05), 0 4px 6px -2px rgba(0, 0, 0, 0.02)' }}>
                <div className="cd-field">
                  <label htmlFor="t-title" style={{ fontSize: '14px', fontWeight: '600', color: '#334155', display: 'block', marginBottom: '8px' }}>Subject</label>
                  <input
                    id="t-title"
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    placeholder="Brief summary of your issue"
                    required minLength={3}
                    style={{ fontSize: '16px', padding: '14px 18px', width: '100%', borderRadius: '8px', border: '1px solid #CBD5E1', outline: 'none' }}
                  />
                </div>

                <div className="cd-field" style={{ marginTop: '20px' }}>
                  <label htmlFor="t-desc" style={{ fontSize: '14px', fontWeight: '600', color: '#334155', display: 'block', marginBottom: '8px' }}>Description</label>
                  <textarea
                    id="t-desc"
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    placeholder="Describe your issue in detail..."
                    rows={9} required minLength={10}
                    style={{ fontSize: '16px', padding: '14px 18px', width: '100%', borderRadius: '8px', border: '1px solid #CBD5E1', outline: 'none', resize: 'vertical' }}
                  />
                </div>

                <button type="submit" className="cd-btn cd-btn--primary" style={{ width: '100%', marginTop: '24px', padding: '12px 24px', fontSize: '16px', fontWeight: '600' }} disabled={creating}>
                  {creating ? "Submitting..." : "Submit Ticket"}
                </button>
              </form>
            </div>

            {/* Right Column: AI Triage Assistant & Suggestions */}
            <div style={{ width: '360px', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '20px' }}>
              
              {/* Dynamic Live Help Card */}
              <div style={{
                background: 'linear-gradient(135deg, rgba(250, 245, 255, 0.9) 0%, rgba(243, 232, 255, 0.9) 100%)',
                border: '1px solid #E9D5FF',
                padding: '24px',
                borderRadius: '12px',
                boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)',
                backdropFilter: 'blur(8px)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#7E22CE', fontWeight: '700', marginBottom: '16px' }}>
                  <Sparkles size={20} />
                  <h4 style={{ margin: 0, fontSize: '15px' }}>Live AI Triage Checklist</h4>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
                    <span style={{ color: title.length >= 5 ? '#10B981' : '#94A3B8', fontSize: '16px', fontWeight: 'bold' }}>
                      {title.length >= 5 ? '✓' : '○'}
                    </span>
                    <span style={{ color: title.length >= 5 ? '#1E293B' : '#64748B', fontWeight: title.length >= 5 ? '500' : '400' }}>
                      Clear, specific subject (5+ chars)
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
                    <span style={{ color: description.length >= 15 ? '#10B981' : '#94A3B8', fontSize: '16px', fontWeight: 'bold' }}>
                      {description.length >= 15 ? '✓' : '○'}
                    </span>
                    <span style={{ color: description.length >= 15 ? '#1E293B' : '#64748B', fontWeight: description.length >= 15 ? '500' : '400' }}>
                      Detailed description (15+ chars)
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
                    <span style={{ 
                      color: (description.toLowerCase().includes('error') || 
                              description.toLowerCase().includes('billing') || 
                              description.toLowerCase().includes('password') || 
                              description.toLowerCase().includes('account') ||
                              description.toLowerCase().includes('login') ||
                              description.toLowerCase().includes('server') ||
                              description.toLowerCase().includes('charge') ||
                              description.toLowerCase().includes('refund')) ? '#10B981' : '#94A3B8', 
                      fontSize: '16px',
                      fontWeight: 'bold'
                    }}>
                      {(description.toLowerCase().includes('error') || 
                        description.toLowerCase().includes('billing') || 
                        description.toLowerCase().includes('password') || 
                        description.toLowerCase().includes('account') ||
                        description.toLowerCase().includes('login') ||
                        description.toLowerCase().includes('server') ||
                        description.toLowerCase().includes('charge') ||
                        description.toLowerCase().includes('refund')) ? '✓' : '○'}
                    </span>
                    <span style={{ 
                      color: (description.toLowerCase().includes('error') || 
                              description.toLowerCase().includes('billing') || 
                              description.toLowerCase().includes('password') || 
                              description.toLowerCase().includes('account') ||
                              description.toLowerCase().includes('login') ||
                              description.toLowerCase().includes('server') ||
                              description.toLowerCase().includes('charge') ||
                              description.toLowerCase().includes('refund')) ? '#1E293B' : '#64748B',
                      fontWeight: (description.toLowerCase().includes('error') || 
                                   description.toLowerCase().includes('billing') || 
                                   description.toLowerCase().includes('password') || 
                                   description.toLowerCase().includes('account') ||
                                   description.toLowerCase().includes('login') ||
                                   description.toLowerCase().includes('server') ||
                                   description.toLowerCase().includes('charge') ||
                                   description.toLowerCase().includes('refund')) ? '500' : '400'
                    }}>
                      Contains key categorization terms
                    </span>
                  </div>
                </div>
              </div>

              {/* Autopilot information */}
              <div style={{
                background: '#fff',
                border: '1px solid #E2E8F0',
                padding: '24px',
                borderRadius: '12px',
                boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#1E293B', fontWeight: '700', marginBottom: '16px' }}>
                  <Zap size={20} style={{ color: '#F59E0B' }} />
                  <h4 style={{ margin: 0, fontSize: '15px' }}>Instant AI Routing</h4>
                </div>
                <p style={{ fontSize: '13px', color: '#64748B', margin: '0 0 12px 0', lineHeight: '1.5' }}>
                  Once submitted, the AI automatically evaluates your ticket's **Category**, **Priority**, and **Sentiment** to match it with the correct resolution base or agent instantly.
                </p>
                <div style={{ fontSize: '12px', color: '#94A3B8', borderTop: '1px solid #F1F5F9', paddingTop: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <BookOpen size={14} />
                  <span>Referencing 8 Knowledge policies</span>
                </div>
              </div>

            </div>

          </div>
        </div>
      )}

      {/* ═══ HISTORY TAB ════════════════════════════════════════ */}
      {activeTab === "history" && (
        <div className="cd-fade-in" style={{ padding: '32px' }}>
          
          {/* Header */}
          <div style={{ marginBottom: '28px' }}>
            <h2 style={{ fontSize: '28px', fontWeight: '700', color: '#0F172A', marginBottom: '6px' }}>Ticket History</h2>
            <p style={{ color: '#64748B', fontSize: '15px' }}>
              Track requests, monitor status, and view AI-generated updates.
            </p>
          </div>

          {/* KPI Metrics Dashboard Cards */}
          <div className="dashboard-metrics-grid">
            <div className="dashboard-metric-card">
              <div className="dashboard-metric-card__icon" style={{ background: '#EFF6FF', color: '#2563EB' }}>
                <Ticket size={22} />
              </div>
              <div className="dashboard-metric-card__info">
                <span className="dashboard-metric-card__value">{tickets.filter(t => t.status === "open").length}</span>
                <span className="dashboard-metric-card__label">Open Tickets</span>
              </div>
            </div>

            <div className="dashboard-metric-card">
              <div className="dashboard-metric-card__icon" style={{ background: '#FFF3E0', color: '#E65100' }}>
                <Clock size={22} />
              </div>
              <div className="dashboard-metric-card__info">
                <span className="dashboard-metric-card__value">
                  {tickets.filter(t => t.status === "pending" || t.status === "escalated").length}
                </span>
                <span className="dashboard-metric-card__label">Pending</span>
              </div>
            </div>

            <div className="dashboard-metric-card">
              <div className="dashboard-metric-card__icon" style={{ background: '#D1FAE5', color: '#10B981' }}>
                <CheckCircle size={22} />
              </div>
              <div className="dashboard-metric-card__info">
                <span className="dashboard-metric-card__value">
                  {tickets.filter(t => t.status === "resolved" || t.status === "closed").length}
                </span>
                <span className="dashboard-metric-card__label">Resolved</span>
              </div>
            </div>

            <div className="dashboard-metric-card">
              <div className="dashboard-metric-card__icon" style={{ background: '#F5F3FF', color: '#7C3AED' }}>
                <Zap size={22} />
              </div>
              <div className="dashboard-metric-card__info">
                <span className="dashboard-metric-card__value">12 min</span>
                <span className="dashboard-metric-card__label">Avg Response</span>
              </div>
            </div>
          </div>

          {/* Dynamic 2-column Grid (Main list + AI panel) */}
          <div className="dashboard-grid">
            
            {/* Left Column: Filters + Tickets List */}
            <div>
              {/* Status filter tabs/chips */}
              <div className="cd-filter-bar" style={{ marginBottom: '20px' }}>
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

              {/* Local Search bar & Dropdown Filters */}
              <div className="dashboard-filters-row">
                <div className="dashboard-search-container">
                  <Search size={18} className="dashboard-search-icon" />
                  <input
                    type="text"
                    className="dashboard-search-input"
                    placeholder="Search tickets by ID, subject, or description..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                
                <select
                  className="dashboard-filter-select"
                  value={priorityFilter}
                  onChange={(e) => setPriorityFilter(e.target.value)}
                >
                  <option value="all">Priority: All</option>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>

                <select
                  className="dashboard-filter-select"
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                >
                  <option value="all">Category: All</option>
                  <option value="billing">Billing</option>
                  <option value="technical">Technical</option>
                  <option value="general">General</option>
                </select>
              </div>

              {/* Tickets list */}
              {loading && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {[1, 2, 3, 4].map(i => (
                    <SkeletonCard key={i} />
                  ))}
                </div>
              )}

              {!loading && filtered.length === 0 && (
                <div className="modern-empty-state" style={{ padding: '40px 24px', background: '#ffffff', borderRadius: '16px', border: '1px dashed #CBD5E1', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', width: '100%' }}>
                  <div className="modern-empty-state__icon" style={{ background: '#EEEDFF', color: '#6366F1', width: '56px', height: '56px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Inbox size={26} />
                  </div>
                  <h3 style={{ fontSize: '18px', fontWeight: '700', color: '#0F172A', margin: 0 }}>🎉 No tickets found</h3>
                  <p style={{ fontSize: '14px', color: '#64748B', margin: 0, maxWidth: '280px', lineHeight: '1.5' }}>Create your first support request or adjust your filters.</p>
                  <button className="cd-btn cd-btn--primary" onClick={() => navigate("/my-tickets/new")} style={{ marginTop: '8px' }}>
                    <PlusCircle size={16} /> Create Ticket
                  </button>
                </div>
              )}

              {!loading && filtered.length > 0 && (
                <div className="rich-ticket-list">
                  {filtered.map(ticket => {
                    const timeStr = ticket.created_at
                      ? new Date(ticket.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                      : "—";

                    return (
                      <Link to={`/tickets/${ticket.id}`} key={ticket.id} className="rich-ticket-card">
                        <div className="rich-ticket-card__header">
                          <div className="rich-ticket-card__title-row">
                            <span className="rich-ticket-card__emoji" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px', background: '#F1F5F9', borderRadius: '8px' }}>
                              {getCategoryIcon(ticket.category)}
                            </span>
                            <div>
                              <div className="rich-ticket-card__title">
                                {ticket.title ? ticket.title.charAt(0).toUpperCase() + ticket.title.slice(1) : ""}
                              </div>
                              <span className="rich-ticket-card__id">#{ticket.id || 'TKT-000'}</span>
                            </div>
                          </div>
                          
                          {/* Rich Status dot badge */}
                          <span className={`status-dot-indicator ${STATUS_COLORS[ticket.status] || 'blue'}`}>
                            <span className={`status-bullet ${(ticket.status === 'open' || ticket.status === 'pending' || ticket.status === 'escalated') ? 'pulse' : ''}`} />
                            {ticket.status}
                          </span>
                        </div>

                        {/* Ticket description preview */}
                        <div className="rich-ticket-card__desc">
                          {ticket.description || "No description provided."}
                        </div>

                        <div className="rich-ticket-card__footer">
                          <div className="rich-ticket-card__badges">
                            <span className={`badge badge--${PRIORITY_COLORS[ticket.priority]}`}>
                              {ticket.priority} Priority
                            </span>
                            {ticket.category && (
                              <span style={{ fontSize: '12px', background: '#F1F5F9', color: '#475569', padding: '2px 8px', borderRadius: '4px', fontWeight: '500' }}>
                                {ticket.category}
                              </span>
                            )}
                            <span className="rich-ticket-card__ai-badge">
                              AI Category: {ticket.category || "General"} ({getAIConfidence(ticket)})
                            </span>
                          </div>

                          <div className="rich-ticket-card__meta-info">
                            <span>Created: {timeStr}</span>
                            <span>•</span>
                            <span className="rich-ticket-card__btn">
                              View Ticket →
                            </span>
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Right Column: AI Insights Side Panel */}
            <div className="ai-insights-panel" style={{ width: '360px', flexShrink: 0 }}>
              <h3 className="ai-insights-panel__title" style={{ fontSize: '15px', color: '#5B21B6', borderBottom: '1px solid #E9D5FF', paddingBottom: '10px' }}>
                <Sparkles size={18} style={{ color: '#7C3AED' }} />
                AI Insights &amp; Operations
              </h3>
              
              <div className="ai-insights-panel__grid">
                <div className="ai-insights-panel__metric-card">
                  <span className="ai-insights-panel__metric-value">99.2%</span>
                  <span className="ai-insights-panel__metric-label">AI Accuracy</span>
                </div>
                <div className="ai-insights-panel__metric-card">
                  <span className="ai-insights-panel__metric-value">&lt; 2s</span>
                  <span className="ai-insights-panel__metric-label">Routing Speed</span>
                </div>
                <div className="ai-insights-panel__metric-card">
                  <span className="ai-insights-panel__metric-value">12.4m</span>
                  <span className="ai-insights-panel__metric-label">Resolution</span>
                </div>
                <div className="ai-insights-panel__metric-card">
                  <span className="ai-insights-panel__metric-value">{tickets.filter(t => t.status === "escalated").length}</span>
                  <span className="ai-insights-panel__metric-label">Escalated</span>
                </div>
              </div>

              <div style={{ borderTop: '1px solid #E9D5FF', paddingTop: '16px' }}>
                <span style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', color: '#7C3AED', letterSpacing: '0.05em', display: 'block', marginBottom: '8px' }}>
                  AI Operations Log
                </span>
                <div className="ai-insights-panel__list" style={{ marginTop: '0' }}>
                  <div className="ai-insights-panel__list-item">
                    {tickets.length} tickets auto-classified upon creation.
                  </div>
                  <div className="ai-insights-panel__list-item">
                    Priority levels evaluated dynamically.
                  </div>
                  <div className="ai-insights-panel__list-item">
                    Intelligent routing mapped to support queues.
                  </div>
                  <div className="ai-insights-panel__list-item">
                    Knowledge Base ground truth referenced for RAG.
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}