import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { ticketsAPI } from "../api/services";
import { useAuth } from "../context/AuthContext";
import { Search, Filter, ChevronDown, MoreHorizontal } from "lucide-react";

const STATUS_COLORS = {
  open:      { bg: '#F1F5F9', color: '#475569', label: 'Open' },
  pending:   { bg: '#FFFBEB', color: '#92400E', label: 'Pending' },
  escalated: { bg: '#FEE2E2', color: '#991B1B', label: 'Escalated' },
  resolved:  { bg: '#F0FDF4', color: '#166534', label: 'Resolved' },
  closed:    { bg: '#F3F4F6', color: '#4B5563', label: 'Closed' },
};

const PRIORITY_COLORS = {
  high: '#EF4444', medium: '#F59E0B', low: '#6B7280',
};

export default function AgentDashboard() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");

  useEffect(() => {
    ticketsAPI.agentTickets(user.id)
      .then((res) => setData(res.data))
      .catch(() => {
        setData({
          total: 3,
          tickets: {
            open: [
              { id: "3311", title: "Manny P. | Refund request", priority: "high", status: "open", created_at: "2026-06-15T17:58:00Z", requester: "Manny P." },
              { id: "3312", title: "Sarah K. | Cannot access account", priority: "medium", status: "open", created_at: "2026-06-16T09:20:00Z", requester: "Sarah K." },
            ],
            pending: [
              { id: "3305", title: "Tom R. | Upgrade plan inquiry", priority: "low", status: "pending", created_at: "2026-06-14T11:00:00Z", requester: "Tom R." },
            ],
            escalated: [
              { id: "3298", title: "API Error — 500 on POST /orders", priority: "high", status: "escalated", created_at: "2026-06-13T16:30:00Z", requester: "Dev Team" },
            ],
            resolved: []
          }
        });
      })
      .finally(() => setLoading(false));
  }, [user.id]);

  const allTickets = data ? [
    ...(data.tickets.open || []),
    ...(data.tickets.pending || []),
    ...(data.tickets.escalated || []),
    ...(data.tickets.resolved || [])
  ] : [];

  const filtered = statusFilter === "all" ? allTickets : allTickets.filter(t => t.status === statusFilter);

  const formatDate = (d) => {
    const dt = new Date(d);
    return `${dt.toLocaleString('default', { month: 'short' })} ${dt.getDate()} ${dt.getHours()}:${String(dt.getMinutes()).padStart(2, '0')}`;
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: '#fff' }}>
      {/* ── Top Bar ───────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 24px', borderBottom: '1px solid #E5E7EB', flexShrink: 0 }}>
        <span style={{ fontSize: '14px', color: '#6B7280', fontWeight: '500' }}>
          {filtered.length} ticket{filtered.length !== 1 ? 's' : ''}
        </span>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 12px', border: '1px solid #E5E7EB', borderRadius: '6px', background: '#fff', cursor: 'pointer', fontSize: '13px', color: '#374151' }}>
            Status <Filter size={13} /> <ChevronDown size={13} />
          </button>
          <button style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 12px', border: '1px solid #E5E7EB', borderRadius: '6px', background: '#fff', cursor: 'pointer', fontSize: '13px', color: '#374151' }}>
            Channel <Filter size={13} /> <ChevronDown size={13} />
          </button>
          <button style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 12px', border: '1px solid #E5E7EB', borderRadius: '6px', background: '#fff', cursor: 'pointer', fontSize: '13px', color: '#374151' }}>
            Recommended <ChevronDown size={13} />
          </button>
        </div>
      </div>

      {/* ── Filter Tabs ───────────────────── */}
      <div style={{ display: 'flex', gap: '0', padding: '0 24px', borderBottom: '1px solid #E5E7EB', flexShrink: 0 }}>
        {["all", "open", "pending", "escalated", "resolved"].map(f => (
          <button
            key={f}
            onClick={() => setStatusFilter(f)}
            style={{
              padding: '10px 14px', border: 'none', background: 'none', cursor: 'pointer', fontSize: '13px',
              fontWeight: statusFilter === f ? '600' : '400',
              color: statusFilter === f ? '#4F46E5' : '#6B7280',
              borderBottom: statusFilter === f ? '2px solid #4F46E5' : '2px solid transparent',
              textTransform: 'capitalize'
            }}
          >
            {f === 'all' ? 'All' : STATUS_COLORS[f]?.label || f}
          </button>
        ))}
      </div>

      {/* ── Ticket List ───────────────────── */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {loading && <div style={{ padding: '32px', textAlign: 'center', color: '#9CA3AF' }}>Loading...</div>}

        {!loading && filtered.length === 0 && (
          <div style={{ padding: '64px 32px', textAlign: 'center', color: '#9CA3AF' }}>
            <div style={{ fontSize: '32px', marginBottom: '12px' }}>📭</div>
            <div style={{ fontSize: '16px', fontWeight: '600', color: '#374151' }}>No tickets here</div>
            <div style={{ fontSize: '14px', marginTop: '4px' }}>You have no assigned tickets matching this status.</div>
          </div>
        )}

        {!loading && filtered.map((ticket, i) => (
          <Link
            to={`/tickets/${ticket.id}`}
            key={ticket.id}
            style={{ textDecoration: 'none' }}
          >
            <div
              style={{
                display: 'flex', alignItems: 'center', padding: '14px 24px',
                borderBottom: '1px solid #F3F4F6', gap: '14px',
                transition: 'background 0.1s', cursor: 'pointer'
              }}
              onMouseEnter={e => e.currentTarget.style.background = '#F9FAFB'}
              onMouseLeave={e => e.currentTarget.style.background = ''}
            >
              {/* Requester avatar */}
              <div style={{
                width: '36px', height: '36px', borderRadius: '50%',
                background: `hsl(${(ticket.requester || ticket.title).charCodeAt(0) * 13}, 60%, 65%)`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#fff', fontWeight: '700', fontSize: '14px', flexShrink: 0
              }}>
                {(ticket.requester || ticket.title).charAt(0).toUpperCase()}
              </div>

              {/* Main content */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '14px', fontWeight: '600', color: '#111827', marginBottom: '4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {ticket.requester || ticket.title}
                  {ticket.requester && (
                    <span style={{ fontWeight: '400', color: '#6B7280' }}> | {ticket.title}</span>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#9CA3AF' }}>
                  <span
                    style={{
                      display: 'inline-block', padding: '2px 8px', borderRadius: '3px',
                      background: STATUS_COLORS[ticket.status]?.bg || '#F3F4F6',
                      color: STATUS_COLORS[ticket.status]?.color || '#374151',
                      fontWeight: '600', fontSize: '11px'
                    }}
                  >
                    {STATUS_COLORS[ticket.status]?.label || ticket.status}
                  </span>
                  <span style={{ color: '#D1D5DB' }}>•</span>
                  <span style={{ color: PRIORITY_COLORS[ticket.priority], fontWeight: '500', fontSize: '11px' }}>
                    ● {ticket.priority}
                  </span>
                  <span style={{ color: '#D1D5DB' }}>•</span>
                  <span>{formatDate(ticket.created_at)}</span>
                  <span style={{ color: '#D1D5DB' }}>|</span>
                  <span>#{ticket.id}</span>
                </div>
              </div>

              {/* Actions */}
              <button
                onClick={(e) => { e.preventDefault(); }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', padding: '4px', borderRadius: '4px' }}
              >
                <MoreHorizontal size={18} />
              </button>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
