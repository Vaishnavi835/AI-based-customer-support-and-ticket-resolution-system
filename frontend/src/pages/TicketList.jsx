import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ticketsAPI } from "../api/services";
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
    <span style={{ padding: '3px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: '600', background: cfg.bg, color: cfg.color }}>
      {priority}
    </span>
  );
}

export default function TicketList() {
  const navigate = useNavigate();
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  useEffect(() => {
    ticketsAPI.list()
      .then((res) => setTickets(res.data.tickets || res.data || []))
      .catch(() => {
        setTickets([
          { id: "T-100", title: "General inquiry", status: "open", priority: "low", created_at: new Date().toISOString() },
          { id: "T-101", title: "Payment failure", status: "escalated", priority: "high", created_at: new Date().toISOString() },
          { id: "T-102", title: "Feature Request", status: "open", priority: "medium", created_at: new Date().toISOString() },
          { id: "T-103", title: "Unable to use the application", status: "pending", priority: "high", created_at: new Date().toISOString() },
        ]);
      })
      .finally(() => setLoading(false));
  }, []);

  // Listen to live ticket created events (e.g. if created by any customer)
  useWebSocketEvent("ticket_created", (data) => {
    if (data.ticket) {
      setTickets((prev) => {
        if (prev.some((t) => t.id === data.ticket.id)) return prev;
        return [data.ticket, ...prev];
      });
    }
  });

  // Listen to live ticket updated events (e.g. status changes, priority changes)
  useWebSocketEvent("ticket_updated", (data) => {
    if (data.ticket) {
      setTickets((prev) =>
        prev.map((t) => (t.id === data.ticket.id ? data.ticket : t))
      );
    }
  });

  const filtered = tickets.filter(t => {
    const matchSearch = t.title?.toLowerCase().includes(search.toLowerCase()) || t.id?.toString().includes(search);
    const matchStatus = statusFilter === "all" || t.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const formatDate = (d) => {
    const dt = new Date(d);
    return `${dt.toLocaleString('default', { month: 'short' })} ${dt.getDate()} ${dt.getHours()}:${String(dt.getMinutes()).padStart(2, '0')}`;
  };

  return (
    <div style={{ padding: '28px', display: 'flex', flexDirection: 'column', gap: '20px' }}>

      {/* ── Hero ─────────────────────────────────────── */}
      <div style={{
        background: 'linear-gradient(135deg, #374151 0%, #4B5563 100%)',
        borderRadius: '16px', padding: '24px 28px',
        display: 'flex', alignItems: 'center', gap: '20px',
        boxShadow: '0 4px 20px rgba(55,65,81,0.2)'
      }}>
        <div style={{ width: '52px', height: '52px', background: 'rgba(255,255,255,0.15)', borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(8px)' }}>
          <Ticket size={26} color="#fff" />
        </div>
        <div>
          <h2 style={{ fontSize: '20px', fontWeight: '800', color: '#fff', letterSpacing: '-0.3px' }}>All Tickets</h2>
          <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.7)', marginTop: '2px' }}>Global view of all support requests in the system.</p>
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

        {/* Toolbar */}
        <div style={{ padding: '14px 20px', borderBottom: '1px solid #F1F3F6', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ position: 'relative', flex: 1, maxWidth: '300px' }}>
            <Search size={15} style={{ position: 'absolute', left: '11px', top: '50%', transform: 'translateY(-50%)', color: '#9CA3AF' }} />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search tickets..."
              style={{ width: '100%', padding: '8px 12px 8px 34px', borderRadius: '9px', border: '1.5px solid #E4E7EC', fontSize: '13px', outline: 'none', fontFamily: 'inherit', background: '#F9FAFB' }} />
          </div>
          <div style={{ display: 'flex', gap: '6px' }}>
            {["all", "open", "pending", "escalated", "resolved", "closed"].map(f => (
              <button key={f} onClick={() => setStatusFilter(f)} style={{
                padding: '6px 12px', borderRadius: '8px', border: 'none', cursor: 'pointer',
                fontSize: '12px', fontWeight: '600', transition: 'all 0.15s',
                background: statusFilter === f ? '#475569' : '#F3F4F6',
                color: statusFilter === f ? '#fff' : '#374151',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6.5px'
              }}>
                <span>{f === 'all' ? 'All' : STATUS_CONFIG[f]?.label}</span>
                <span style={{
                  padding: '1.5px 6.5px',
                  borderRadius: '99px',
                  fontSize: '10.5px',
                  fontWeight: '700',
                  background: statusFilter === f ? 'rgba(255, 255, 255, 0.22)' : '#E2E8F0',
                  color: statusFilter === f ? '#fff' : '#475569'
                }}>
                  {f === 'all' ? tickets.length : tickets.filter(t => t.status === f).length}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#FAFAFA', borderBottom: '1px solid #F1F3F6' }}>
              {['#', 'Title', 'Status', 'Priority', 'Date', ''].map(h => (
                <th key={h} style={{ padding: '11px 20px', textAlign: 'left', fontSize: '11px', fontWeight: '700', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              [1, 2, 3, 4, 5].map(i => (
                <SkeletonTableRow key={i} cols={6} />
              ))
            ) : filtered.length === 0 ? (
              <tr><td colSpan={6} style={{ padding: '48px', textAlign: 'center', color: '#9CA3AF' }}>
                <Inbox size={28} style={{ display: 'block', margin: '0 auto 10px' }} />
                No tickets found.
              </td></tr>
            ) : filtered.map(ticket => (
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
