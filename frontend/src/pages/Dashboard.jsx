import { useState, useEffect } from "react";
import { ticketsAPI } from "../api/services";
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

function StatCard({ icon: Icon, label, value, delta, color, bg }) {
  const isUp = delta >= 0;
  return (
    <div style={{
      background: '#fff', borderRadius: '14px', padding: '20px',
      border: '1px solid #E4E7EC', boxShadow: '0 1px 3px rgba(15,23,42,0.06)',
      display: 'flex', flexDirection: 'column', gap: '12px',
      transition: 'transform 0.25s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.25s, border-color 0.25s', cursor: 'default'
    }}
      onMouseEnter={e => {
        e.currentTarget.style.transform = 'translateY(-3.5px)';
        e.currentTarget.style.boxShadow = '0 12px 24px rgba(15,23,42,0.07), 0 4px 8px rgba(15,23,42,0.03)';
        e.currentTarget.style.borderColor = '#6366F1';
      }}
      onMouseLeave={e => {
        e.currentTarget.style.transform = 'none';
        e.currentTarget.style.boxShadow = '0 1px 3px rgba(15,23,42,0.06)';
        e.currentTarget.style.borderColor = '#E4E7EC';
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon size={22} color={color} />
        </div>
        <span style={{
          display: 'flex', alignItems: 'center', gap: '3px', fontSize: '12px', fontWeight: '600',
          color: isUp ? '#10B981' : '#EF4444',
          background: isUp ? '#F0FDF4' : '#FEF2F2', borderRadius: '6px', padding: '3px 7px'
        }}>
          {isUp ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />} {Math.abs(delta)}%
        </span>
      </div>
      <div>
        <div style={{ fontSize: '28px', fontWeight: '800', color: '#0F172A', letterSpacing: '-0.5px' }}>{value}</div>
        <div style={{ fontSize: '13px', color: '#64748B', marginTop: '2px', fontWeight: '500' }}>{label}</div>
      </div>
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
      <div style={{ height: '8px', background: '#F3F4F6', borderRadius: '99px', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: '99px', transition: 'width 0.6s ease' }} />
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("inboxes");

  const loadStats = () => {
    setLoading(true);
    ticketsAPI.stats()
      .then((res) => setStats(res.data))
      .catch(() => setStats({ total: 154, open: 42, pending: 18, escalated: 12, resolved: 82, closed: 64, high_priority: 15 }))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadStats(); }, []);

  const total = stats?.total || 0;

  return (
    <div style={{ padding: '28px', display: 'flex', flexDirection: 'column', gap: '24px' }}>

      {/* ── Header ──────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 className="text-dashboard-title" style={{ margin: 0, fontSize: '26px', fontWeight: '800', letterSpacing: '-0.5px' }}>Dashboard</h1>
          <p style={{ margin: '4px 0 0 0', fontSize: '14.5px', color: '#64748B' }}>
            Good morning, {user?.name?.split(' ')[0]}! Here's what's happening across your support platform today.
          </p>
        </div>
        <button onClick={loadStats} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '9px 16px', border: '1.5px solid #E4E7EC', borderRadius: '10px', background: '#fff', cursor: 'pointer', fontSize: '13px', fontWeight: '600', color: '#374151', transition: 'border-color 0.15s' }}>
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {/* ── KPI Stat Cards ──────────────────────────────── */}
      {!loading && stats && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '16px' }}>
          <StatCard icon={Inbox}       label="Open Tickets"        value={stats.open}         delta={+8}  color="#475569" bg="#F1F5F9" />
          <StatCard icon={Clock}       label="Pending"             value={stats.pending}      delta={-3}  color="#F59E0B" bg="#FFFBEB" />
          <StatCard icon={ShieldAlert} label="Escalated"           value={stats.escalated}    delta={+2}  color="#EF4444" bg="#FEF2F2" />
          <StatCard icon={CheckCircle} label="Resolved Today"      value={stats.resolved}     delta={+14} color="#10B981" bg="#ECFDF5" />
          <StatCard icon={Users}       label="Agents Online"       value={7}                  delta={0}   color="#6C63FF" bg="#EEEDFF" />
          <StatCard icon={Star}        label="Satisfaction"        value="94%"                delta={+1}  color="#F59E0B" bg="#FFFBEB" />
        </div>
      )}

      {/* ── Two-column section ──────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>

        {/* Ticket Status Distribution */}
        <div style={{ background: '#fff', borderRadius: '14px', border: '1px solid #E4E7EC', padding: '22px', boxShadow: '0 1px 3px rgba(15,23,42,0.06)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h3 style={{ fontSize: '15px', fontWeight: '700', color: '#0F172A' }}>Ticket Status Chart</h3>
            <TrendingUp size={18} color="#9CA3AF" />
          </div>
          {stats && (
            <>
              <MiniBar label="Open"      value={stats.open}      max={total} color="#3B82F6" />
              <MiniBar label="Pending"   value={stats.pending}   max={total} color="#F59E0B" />
              <MiniBar label="Escalated" value={stats.escalated} max={total} color="#EF4444" />
              <MiniBar label="Resolved"  value={stats.resolved}  max={total} color="#10B981" />
              <MiniBar label="Closed"    value={stats.closed}    max={total} color="#94A3B8" />
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
              { label: 'First Response Time', value: '26m 50s', status: 'good', pct: 80 },
              { label: 'Resolution Time', value: '4h 12m', status: 'warn', pct: 55 },
              { label: 'Customer Satisfaction', value: '94%', status: 'good', pct: 94 },
              { label: 'SLA Miss Rate', value: '8%', status: 'danger', pct: 8 },
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
          <span style={{ fontSize: '12px', color: '#6C63FF', fontWeight: '600', cursor: 'pointer' }}>View all</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {MOCK_ACTIVITY.map(item => (
            <div key={item.id} style={{
              display: 'flex', alignItems: 'center', gap: '14px', padding: '10px 12px',
              borderRadius: '10px', transition: 'background 0.1s', cursor: 'pointer'
            }}
              onMouseEnter={e => e.currentTarget.style.background = '#F9FAFB'}
              onMouseLeave={e => e.currentTarget.style.background = ''}
            >
              <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: item.color + '18', display: 'flex', alignItems: 'center', justifyContent: 'center', color: item.color, fontWeight: '800', fontSize: '13px', flexShrink: 0 }}>
                {item.actor.charAt(0)}
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