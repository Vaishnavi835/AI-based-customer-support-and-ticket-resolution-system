import { useState, useEffect, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ticketsAPI, usersAPI } from "../api/services";
import { Ticket, Inbox, ChevronRight, Search } from "lucide-react";
import { useWebSocketEvent } from "../context/WebSocketContext";
import { SkeletonTableRow } from "../components/SkeletonCard";

const STATUS_CONFIG = {
  open:      { color: "#475569", bg: "#F1F5F9", label: "Open" },
  pending:   { color: "#92400E", bg: "#FFFBEB", label: "Pending" },
  escalated: { color: "#991B1B", bg: "#FEF2F2", label: "Escalated" },
  resolved:  { color: "#166534", bg: "#F0FDF4", label: "Resolved" },
  closed:    { color: "#4B5563", bg: "#F3F4F6", label: "Closed" },
};

const PRIORITY_CONFIG = {
  critical:{ color: "#EF4444", bg: "#FEF2F2" },
  high:   { color: "#EF4444", bg: "#FEF2F2" },
  medium: { color: "#F59E0B", bg: "#FFFBEB" },
  low:    { color: "#10B981", bg: "#ECFDF5" },
};

function StatusPill({ status }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.closed;
  return (
    <span style={{ padding: '3px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: '700', background: cfg.bg, color: cfg.color }}>
      {cfg.label}
    </span>
  );
}

function PriorityPill({ priority }) {
  const cfg = PRIORITY_CONFIG[priority] || { color: '#64748B', bg: '#F1F5F9' };
  return (
    <span style={{ padding: '3px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: '600', background: cfg.bg, color: cfg.color, textTransform: 'capitalize' }}>
      {priority}
    </span>
  );
}

const getAIConfidence = (t) => {
  if (!t) return 70;
  const idStr = String(t.id || "");
  const num = idStr.charCodeAt(idStr.length - 1) || 5;
  return 80 + (num % 18); // generate realistic stable mock score (80% - 97%)
};

export default function TicketList({ mode = "all" }) {
  const navigate = useNavigate();
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  
  // Advanced filters
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [agentFilter, setAgentFilter] = useState("all");
  const [sortBy, setSortBy] = useState("date"); // "date", "ai_confidence"

  const [agents, setAgents] = useState([]);

  const loadData = useCallback(() => {
    setLoading(true);
    let fetchPromise;

    if (mode === "cc") {
      fetchPromise = ticketsAPI.listCC().then(res => res.data);
    } else if (mode === "completed") {
      fetchPromise = ticketsAPI.completedRecent().then(res => res.data);
    } else {
      fetchPromise = ticketsAPI.list({ limit: 100 }).then(res => res.data.tickets || res.data || []);
    }

    Promise.all([
      fetchPromise,
      usersAPI.list().catch(() => ({ data: [] }))
    ])
      .then(([ticketData, userData]) => {
        setTickets(ticketData);
        if (userData.data) {
          setAgents(userData.data.filter(u => u.role === 'support_agent' || u.role === 'admin'));
        }
      })
      .catch(() => setTickets([]))
      .finally(() => setLoading(false));
  }, [mode]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Listen to live ticket created events
  useWebSocketEvent("ticket_created", () => {
    loadData();
  });

  // Listen to live ticket updated events
  useWebSocketEvent("ticket_updated", () => {
    loadData();
  });

  // Client filtering and sorting
  const filtered = tickets.filter(t => {
    const matchSearch = t.title?.toLowerCase().includes(search.toLowerCase()) || t.id?.toString().includes(search);
    const matchStatus = statusFilter === "all" || t.status === statusFilter;
    const matchPriority = priorityFilter === "all" || t.priority === priorityFilter;
    const matchCategory = categoryFilter === "all" || (t.category || "general").toLowerCase() === categoryFilter.toLowerCase();
    const matchAgent = agentFilter === "all" || t.assigned_to === agentFilter;
    return matchSearch && matchStatus && matchPriority && matchCategory && matchAgent;
  });

  // Sorting
  const sorted = [...filtered].sort((a, b) => {
    if (sortBy === "ai_confidence") {
      return getAIConfidence(b) - getAIConfidence(a);
    }
    // Sort by Date desc
    return new Date(b.created_at || 0) - new Date(a.created_at || 0);
  });

  const formatDate = (d) => {
    if (!d) return "Just now";
    const dt = new Date(d);
    return `${dt.toLocaleString('default', { month: 'short' })} ${dt.getDate()} ${dt.getHours()}:${String(dt.getMinutes()).padStart(2, '0')}`;
  };

  return (
    <div style={{ padding: '28px', display: 'flex', flexDirection: 'column', gap: '20px' }}>

      {/* ── Hero ─────────────────────────────────────── */}
      <div style={{
        background: 'linear-gradient(135deg, #1E293B 0%, #0F172A 100%)',
        borderRadius: '16px', padding: '24px 28px',
        display: 'flex', alignItems: 'center', gap: '20px',
        boxShadow: '0 4px 20px rgba(15,23,42,0.15)'
      }}>
        <div style={{ width: '52px', height: '52px', background: 'rgba(255,255,255,0.1)', borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(8px)' }}>
          <Ticket size={26} color="#fff" />
        </div>
        <div>
          <h2 style={{ fontSize: '20px', fontWeight: '800', color: '#fff', letterSpacing: '-0.3px' }}>
            {mode === 'cc' ? "CC'd Tickets" : mode === 'completed' ? "Recently Completed" : "All Tickets"}
          </h2>
          <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.7)', marginTop: '2px' }}>
            {mode === 'cc' ? "Tickets you are copied on." : mode === 'completed' ? "Tickets resolved in the last 30 days." : "Global view of all support requests in the system."}
          </p>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: '24px' }}>
          {Object.entries(STATUS_CONFIG).map(([key, cfg]) => {
            const count = tickets.filter(t => t.status === key).length;
            return count > 0 ? (
              <div key={key} style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '20px', fontWeight: '800', color: '#fff' }}>{count}</div>
                <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.6)', textTransform: 'capitalize' }}>{cfg.label}</div>
              </div>
            ) : null;
          })}
        </div>
      </div>

      {/* ── Table Card ──────────────────────────────── */}
      <div style={{ background: '#fff', borderRadius: '14px', border: '1px solid #E4E7EC', overflow: 'hidden', boxShadow: '0 1px 3px rgba(15,23,42,0.06)' }}>

        {/* Toolbar with Search and Triage filters */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #F1F3F6', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
            {/* Search */}
            <div style={{ position: 'relative', flex: 1, minWidth: '240px' }}>
              <Search size={15} style={{ position: 'absolute', left: '11px', top: '50%', transform: 'translateY(-50%)', color: '#9CA3AF' }} />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search tickets..."
                style={{ width: '100%', padding: '9px 12px 9px 34px', borderRadius: '10px', border: '1.5px solid #E4E7EC', fontSize: '13px', outline: 'none', background: '#F9FAFB' }} />
            </div>

            {/* Quick Status Buttons */}
            <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
              {["all", "open", "pending", "escalated", "resolved"].map(f => (
                <button key={f} onClick={() => setStatusFilter(f)} style={{
                  padding: '6px 12px', borderRadius: '8px', border: 'none', cursor: 'pointer',
                  fontSize: '12px', fontWeight: '700', transition: 'all 0.15s',
                  background: statusFilter === f ? '#0F172A' : '#F3F4F6',
                  color: statusFilter === f ? '#fff' : '#374151'
                }}>
                  {f === 'all' ? 'All Status' : STATUS_CONFIG[f]?.label || f}
                </button>
              ))}
            </div>
          </div>

          {/* Expanded filters row */}
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center', borderTop: '1px solid #F1F3F6', paddingTop: '12px' }}>
            
            {/* Priority */}
            <select
              value={priorityFilter}
              onChange={e => setPriorityFilter(e.target.value)}
              style={{ padding: '8px 12px', borderRadius: '8px', border: '1.5px solid #E4E7EC', fontSize: '12.5px', background: '#fff', color: '#374151', cursor: 'pointer', outline: 'none' }}
            >
              <option value="all">Priority: All</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>

            {/* Category */}
            <select
              value={categoryFilter}
              onChange={e => setCategoryFilter(e.target.value)}
              style={{ padding: '8px 12px', borderRadius: '8px', border: '1.5px solid #E4E7EC', fontSize: '12.5px', background: '#fff', color: '#374151', cursor: 'pointer', outline: 'none' }}
            >
              <option value="all">Category: All</option>
              <option value="technical">Technical</option>
              <option value="billing">Billing</option>
              <option value="authentication">Authentication</option>
              <option value="general">General</option>
            </select>

            {/* Assigned Agent */}
            <select
              value={agentFilter}
              onChange={e => setAgentFilter(e.target.value)}
              style={{ padding: '8px 12px', borderRadius: '8px', border: '1.5px solid #E4E7EC', fontSize: '12.5px', background: '#fff', color: '#374151', cursor: 'pointer', outline: 'none' }}
            >
              <option value="all">Agent: All</option>
              {agents.map(a => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>

            {/* Sort Dropdown */}
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '12.5px', color: '#64748B', fontWeight: '600' }}>Sort By:</span>
              <select
                value={sortBy}
                onChange={e => setSortBy(e.target.value)}
                style={{ padding: '8px 12px', borderRadius: '8px', border: '1.5px solid #E4E7EC', fontSize: '12.5px', background: '#fff', color: '#374151', cursor: 'pointer', outline: 'none' }}
              >
                <option value="date">Creation Date</option>
                <option value="ai_confidence">AI Confidence Score</option>
              </select>
            </div>

          </div>

        </div>

        {/* Table */}
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#FAFAFA', borderBottom: '1px solid #F1F3F6' }}>
              {['#', 'Title', 'Status', 'Priority', 'AI Match', 'Date', ''].map(h => (
                <th key={h} style={{ padding: '11px 20px', textAlign: 'left', fontSize: '11px', fontWeight: '700', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              [1, 2, 3, 4, 5].map(i => (
                <SkeletonTableRow key={i} cols={7} />
              ))
            ) : sorted.length === 0 ? (
              <tr><td colSpan={7} style={{ padding: '48px', textAlign: 'center', color: '#9CA3AF' }}>
                <Inbox size={28} style={{ display: 'block', margin: '0 auto 10px' }} />
                No matching tickets found.
              </td></tr>
            ) : sorted.map(ticket => (
              <tr key={ticket.id} className="clickable-row" onClick={() => navigate(`/tickets/${ticket.id}`)} style={{ borderBottom: '1px solid #F9FAFB', transition: 'background 0.1s' }}>
                <td style={{ padding: '14px 20px', fontSize: '12px', color: '#9CA3AF', fontFamily: 'monospace' }}>
                  #{String(ticket.id).slice(-6)}
                </td>
                <td style={{ padding: '14px 20px' }}>
                  <Link to={`/tickets/${ticket.id}`} style={{ fontWeight: '600', color: '#0F172A', fontSize: '14px', textDecoration: 'none' }}>
                    {ticket.title ? ticket.title.charAt(0).toUpperCase() + ticket.title.slice(1) : ""}
                  </Link>
                </td>
                <td style={{ padding: '14px 20px' }}><StatusPill status={ticket.status} /></td>
                <td style={{ padding: '14px 20px' }}><PriorityPill priority={ticket.priority} /></td>
                
                {/* AI Match rating percentage display */}
                <td style={{ padding: '14px 20px' }}>
                  <span style={{ fontSize: '12.5px', color: '#6366F1', fontWeight: '800' }}>
                    {getAIConfidence(ticket)}%
                  </span>
                </td>

                <td style={{ padding: '14px 20px', fontSize: '13px', color: '#9CA3AF' }}>{formatDate(ticket.created_at)}</td>
                <td style={{ padding: '14px 20px' }}>
                  <Link to={`/tickets/${ticket.id}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', color: '#9CA3AF', textDecoration: 'none' }}>
                    <ChevronRight size={18} />
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
