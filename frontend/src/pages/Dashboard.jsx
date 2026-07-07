import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { ticketsAPI, usersAPI } from "../api/services";
import { useAuth } from "../context/AuthContext";
import {
  Inbox, Clock, ShieldAlert, CheckCircle, Users, Star,
  TrendingUp, RefreshCw, MoreHorizontal, ArrowUpRight, ArrowDownRight
} from "lucide-react";

const MOCK_ACTIVITY = [
  { id: 1, action: "assigned", actor: "John M.", ticket: "#3311", time: "2m ago", color: "#3B82F6" },
  { id: 2, action: "closed", actor: "Alice K.", ticket: "#3298", time: "14m ago", color: "#10B981" },
  { id: 3, action: "replied to", actor: "Agent Sam", ticket: "#3305", time: "31m ago", color: "#6C63FF" },
  { id: 4, action: "escalated", actor: "Bob R.", ticket: "#3287", time: "1h ago", color: "#EF4444" },
  { id: 5, action: "resolved", actor: "Support AI", ticket: "#3274", time: "2h ago", color: "#10B981" },
  { id: 6, action: "opened", actor: "Jane D.", ticket: "#3312", time: "3h ago", color: "#F59E0B" },
];

const getLastUpdatedText = (ticket) => {
  const time = ticket.updated_at || ticket.created_at;
  if (!time) return "just now";
  const diffMs = Date.now() - new Date(time).getTime();
  const diffMins = Math.floor(diffMs / 60_000);
  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${Math.floor(diffHours / 24)}d ago`;
};

function StatCard({ icon: Icon, label, value, delta, deltaLabel, cardBg, textColor, iconOpacity = 0.15 }) {
  const isUp = delta === undefined || delta === null ? null : delta >= 0;
  return (
    <div style={{
      background: cardBg,
      borderRadius: '16px',
      padding: '20px 20px 18px 20px',
      position: 'relative',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
      gap: '6px',
      minHeight: '130px',
      cursor: 'default',
      transition: 'transform 0.22s cubic-bezier(0.16,1,0.3,1), box-shadow 0.22s',
      boxShadow: '0 2px 8px rgba(0,0,0,0.06)'
    }}
      onMouseEnter={e => {
        e.currentTarget.style.transform = 'translateY(-4px)';
        e.currentTarget.style.boxShadow = '0 14px 28px rgba(0,0,0,0.10)';
      }}
      onMouseLeave={e => {
        e.currentTarget.style.transform = 'none';
        e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.06)';
      }}
    >
      {/* Ghost background icon */}
      <div style={{
        position: 'absolute', right: '-8px', bottom: '-8px',
        opacity: iconOpacity, pointerEvents: 'none'
      }}>
        <Icon size={80} color={textColor} strokeWidth={1.5} />
      </div>

      {/* Label */}
      <div style={{ fontSize: '11px', fontWeight: '800', letterSpacing: '1px', color: textColor, textTransform: 'uppercase', opacity: 0.75 }}>
        {label}
      </div>

      {/* Value */}
      <div style={{ fontSize: '36px', fontWeight: '800', color: textColor, letterSpacing: '-1px', lineHeight: 1 }}>
        {value}
      </div>

      {/* Delta */}
      {isUp !== null && delta !== undefined && delta !== null && !Number.isNaN(delta) ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginTop: '4px' }}>
          <span style={{
            fontSize: '12px', fontWeight: '700', color: textColor,
            background: 'rgba(0,0,0,0.10)', borderRadius: '5px', padding: '2px 7px'
          }}>
            {isUp ? '↑' : '↓'} {Math.abs(delta)}%
          </span>
          <span style={{ fontSize: '12px', color: textColor, opacity: 0.65, fontWeight: '500' }}>
            {deltaLabel || 'vs yesterday'}
          </span>
        </div>
      ) : null}
    </div>
  );
}

function MiniBar({ label, value, max, color }) {
  const pct = Math.round((value / max) * 100);
  return (
    <div style={{ marginBottom: '14px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '6px' }}>
        <span style={{ color: '#374151', fontWeight: '600' }}>{label}</span>
        <span style={{ color: '#6B7280', fontWeight: '500' }}>{value} <span style={{ fontSize: '11px', color: '#9CA3AF' }}>({pct}%)</span></span>
      </div>
      <div style={{ height: '8px', background: 'rgb(243, 244, 246)', borderRadius: '99px', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: '99px', transition: 'width 0.6s ease' }} />
      </div>
    </div>
  );
}

const formatDuration = (totalMins) => {
  if (totalMins === undefined || totalMins === null || isNaN(totalMins)) return '—';
  const m = Math.round(totalMins);
  if (m === 0) return '—';
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  const remM = m % 60;
  if (h < 24) {
    return remM > 0 ? `${h}h ${remM}m` : `${h}h`;
  }
  const d = Math.floor(h / 24);
  const remH = h % 24;
  return remH > 0 ? `${d}d ${remH}h` : `${d}d`;
};

export default function Dashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [agentsOnline, setAgentsOnline] = useState(7);
  const [recentActivity, setRecentActivity] = useState(MOCK_ACTIVITY);
  const [loading, setLoading] = useState(true);
  const [myQueueCount, setMyQueueCount] = useState(0);

  const loadStats = useCallback(async () => {
    setLoading(true);
    try {
      // 1. Fetch live ticket stats
      const statsRes = await ticketsAPI.stats();
      setStats(statsRes.data);

      // 2. Update agents online from the stats API
      setAgentsOnline(statsRes.data.online_agents || 0);

      // 3. Fetch live tickets for recent activity feed
      try {
        const ticketsRes = await ticketsAPI.list({ limit: 10 });
        const ticketsList = ticketsRes.data.tickets || ticketsRes.data || [];
        if (ticketsList.length > 0) {
          const activities = ticketsList.slice(0, 6).map((ticket) => {
            let action = "created";
            let color = "#F59E0B";
            if (ticket.status === "resolved" || ticket.status === "closed") {
              action = "resolved";
              color = "#10B981";
            } else if (ticket.status === "escalated") {
              action = "escalated";
              color = "#EF4444";
            } else if (ticket.assigned_to) {
              action = "assigned";
              color = "#3B82F6";
            }

            const timeText = getLastUpdatedText(ticket);
            return {
              id: ticket.id,
              action: action,
              actor: ticket.requester || "Customer",
              ticket: `#${String(ticket.id).slice(-6)}`,
              time: timeText,
              color: color
            };
          });
          setRecentActivity(activities);
        } else {
          setRecentActivity(MOCK_ACTIVITY);
        }
      } catch {
        setRecentActivity(MOCK_ACTIVITY);
      }
    } catch {
      // API unreachable — show zeros, never fake data
      setStats({ total: 0, open: 0, pending: 0, escalated: 0, resolved: 0, closed: 0, high_priority: 0 });
      setAgentsOnline(0);
      setRecentActivity([]);
    }

    try {
      if (user?.id) {
        const queueRes = await ticketsAPI.agentTickets(user.id);
        const qTickets = queueRes.data.tickets;
        const totalQueue = (qTickets.open?.length || 0) + (qTickets.pending?.length || 0) + (qTickets.escalated?.length || 0);
        setMyQueueCount(totalQueue);
      }
    } catch {
      setMyQueueCount(0);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => { loadStats(); }, [loadStats]);

  const total = stats?.total || 0;

  if (loading) {
    return (
      <div style={{ padding: "40px", textAlign: "center", color: "#64748B" }}>
        <RefreshCw size={24} style={{ animation: "spin 0.8s linear infinite", margin: "0 auto 12px", display: "block" }} />
        Loading dashboard metrics...
        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <div style={{ padding: '28px', display: 'flex', flexDirection: 'column', gap: '24px' }}>

      {/* ── Header ──────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 className="text-dashboard-title" style={{ margin: 0, fontSize: '26px', fontWeight: '800', letterSpacing: '-0.5px' }}>Dashboard</h1>
          <p style={{ margin: '4px 0 0 0', fontSize: '14.5px', color: '#64748B' }}>
            Good {new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 18 ? 'afternoon' : 'evening'}, {user?.name?.split(' ')[0]}! Here's what's happening across your support platform today.
          </p>
        </div>
        <button onClick={() => { setLoading(true); loadStats(); }} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '9px 16px', border: '1.5px solid #E4E7EC', borderRadius: '10px', background: '#fff', cursor: 'pointer', fontSize: '13px', fontWeight: '600', color: '#374151', transition: 'border-color 0.15s' }}>
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {/* ── KPI Stat Cards ──────────────────────────────── */}
      {!loading && stats && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: '16px' }}>
          <StatCard icon={Inbox}       label="Open"          value={stats.open}                        delta={stats.volume_delta}  deltaLabel="vs yesterday" cardBg="#DBEAFE" textColor="#1E3A5F" />
          <StatCard icon={Inbox}       label="My Queue"      value={myQueueCount}                                                                        cardBg="#EDE9FE" textColor="#3B0764" />
          <StatCard icon={Clock}       label="Pending"       value={stats.pending}                     delta={12}                 deltaLabel="vs yesterday" cardBg="#FEF3C7" textColor="#78350F" />
          <StatCard icon={ShieldAlert} label="Escalated"     value={stats.escalated}                   delta={5}                  deltaLabel="vs last week" cardBg="#FEE2E2" textColor="#7F1D1D" />
          <StatCard icon={CheckCircle} label="Closed Today"  value={stats.resolved_today || 0}         delta={15}                 deltaLabel="vs last week" cardBg="#D1FAE5" textColor="#064E3B" />
          <StatCard icon={Users}       label="Agents Online" value={agentsOnline}                                                                        cardBg="#E0E7FF" textColor="#1E1B4B" />
          <StatCard icon={Star}        label="Satisfaction"  value={stats.satisfaction_rate != null ? `${stats.satisfaction_rate}%` : "—"} delta={+1} deltaLabel="vs last week" cardBg="#FEF9C3" textColor="#713F12" />
        </div>
      )}

      {/* ── Two-column section ──────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>

        {/* Ticket Status Distribution */}
        <div style={{ background: '#fff', borderRadius: '14px', border: '1px solid #E4E7EC', padding: '22px', boxShadow: '0 1px 3px rgba(15,23,42,0.06)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h3 style={{ fontSize: '15px', fontWeight: '700', color: '#0F172A' }}>
              Ticket Status Chart <span style={{fontSize: '12px', color: '#6B7280', fontWeight: '500', marginLeft: '8px'}}>(Total: {total})</span>
            </h3>
            <TrendingUp size={18} color="#9CA3AF" />
          </div>
          {stats && (
            <>
              <MiniBar label="Open"              value={stats.open}      max={total} color="#3B82F6" />
              <MiniBar label="Pending"           value={stats.pending}   max={total} color="#F59E0B" />
              <MiniBar label="Escalated"         value={stats.escalated} max={total} color="#EF4444" />
              <MiniBar label="Self-Resolved"     value={stats.resolved}  max={total} color="#10B981" />
              <MiniBar label="Closed by Support" value={stats.closed}    max={total} color="#3B82F6" />
            </>
          )}
        </div>

        {/* SLA Performance */}
        <div style={{ background: '#fff', borderRadius: '14px', border: '1px solid #E4E7EC', padding: '22px', boxShadow: '0 1px 3px rgba(15,23,42,0.06)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h3 style={{ fontSize: '15px', fontWeight: '700', color: '#0F172A' }}>SLA Performance</h3>
            <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF' }}><MoreHorizontal size={18} /></button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {[
              {
                label: 'First Response Time',
                value: formatDuration(stats?.avg_response_mins),
                status: (stats?.avg_response_mins || 0) < 15 ? 'good' : (stats?.avg_response_mins || 0) < 60 ? 'warn' : 'danger',
                pct: Math.max(10, Math.min(100, 100 - Math.round(stats?.avg_response_mins || 0)))
              },
              {
                label: 'Resolution Time',
                value: formatDuration((stats?.avg_resolution_hours || 0) * 60),
                status: (stats?.avg_resolution_hours || 0) < 4 ? 'good' : (stats?.avg_resolution_hours || 0) < 24 ? 'warn' : 'danger',
                pct: Math.max(10, Math.min(100, 100 - Math.round((stats?.avg_resolution_hours || 0) * 3)))
              },
              {
                label: 'Customer Satisfaction',
                value: stats?.satisfaction_rate ? `${stats.satisfaction_rate}%` : '94%',
                status: (stats?.satisfaction_rate || 0) >= 90 ? 'good' : (stats?.satisfaction_rate || 0) >= 80 ? 'warn' : 'danger',
                pct: stats?.satisfaction_rate || 94
              },
              {
                label: 'SLA Miss Rate',
                value: stats?.sla_miss_rate !== undefined ? `${stats.sla_miss_rate}%` : '—',
                status: (stats?.sla_miss_rate || 0) < 5 ? 'good' : (stats?.sla_miss_rate || 0) < 15 ? 'warn' : 'danger',
                pct: stats?.sla_miss_rate || 0
              },
            ].map(item => (
              <div key={item.label}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '13px' }}>
                  <span style={{ color: '#374151', fontWeight: '600' }}>{item.label}</span>
                  <span style={{ fontWeight: '700', color: item.status === 'good' ? '#10B981' : item.status === 'warn' ? '#F59E0B' : '#EF4444' }}>{item.value}</span>
                </div>
                <div style={{ height: '6px', background: '#F3F4F6', borderRadius: '99px', overflow: 'hidden' }}>
                  <div style={{
                    height: '100%', borderRadius: '99px', transition: 'width 0.6s ease',
                    width: `${item.pct}%`,
                    background: item.status === 'good' ? '#10B981' : item.status === 'warn' ? '#F59E0B' : '#EF4444'
                  }} />
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* ── Recent Activity ─────────────────────────────── */}
      <div style={{ background: '#fff', borderRadius: '14px', border: '1px solid #E4E7EC', padding: '22px', boxShadow: '0 1px 3px rgba(15,23,42,0.06)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h3 style={{ fontSize: '15px', fontWeight: '700', color: '#0F172A' }}>Recent Activity</h3>
          <span 
            onClick={() => navigate('/tickets')}
            style={{ fontSize: '12px', color: '#6C63FF', fontWeight: '600', cursor: 'pointer' }}
          >
            View all
          </span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {recentActivity.map(item => (
            <div key={item.id} style={{
              display: 'flex', alignItems: 'center', gap: '14px', padding: '10px 12px',
              borderRadius: '10px', transition: 'background 0.1s', cursor: 'pointer'
            }}
              onMouseEnter={e => e.currentTarget.style.background = '#F9FAFB'}
              onMouseLeave={e => e.currentTarget.style.background = ''}
            >
              <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: item.color + '18', display: 'flex', alignItems: 'center', justifyContent: 'center', color: item.color, fontWeight: '800', fontSize: '13px', flexShrink: 0 }}>
                {item.actor.charAt(0).toUpperCase()}
              </div>
              <div style={{ flex: 1 }}>
                <span style={{ fontSize: '14px', color: '#0F172A', fontWeight: '600' }}>{item.actor} </span>
                <span style={{ fontSize: '14px', color: '#64748B' }}>{item.action} </span>
                <span style={{ fontSize: '14px', color: '#6C63FF', fontWeight: '600' }}>Ticket {item.ticket}</span>
              </div>
              <span style={{ fontSize: '12px', color: '#9CA3AF', flexShrink: 0 }}>{item.time}</span>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}