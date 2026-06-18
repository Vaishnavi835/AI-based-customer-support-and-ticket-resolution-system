import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { Search, UserPlus, Shield, UserCheck, User, MoreVertical, Mail } from "lucide-react";

const MOCK_USERS = [
  { id: 1, name: "Admin Setup", email: "admin@example.com", role: "admin", status: "online", created_at: "2026-06-01" },
  { id: 2, name: "John Agent", email: "agent@support.com", role: "support_agent", status: "away", created_at: "2026-06-05" },
  { id: 3, name: "Jane Customer", email: "jane@customer.com", role: "customer", status: "online", created_at: "2026-06-10" },
  { id: 4, name: "Bob Developer", email: "bob@dev.com", role: "customer", status: "offline", created_at: "2026-06-12" },
  { id: 5, name: "Alice Escalations", email: "alice@support.com", role: "support_agent", status: "online", created_at: "2026-06-15" },
  { id: 6, name: "Carol Admin", email: "carol@admin.com", role: "admin", status: "offline", created_at: "2026-06-16" },
];

const ROLE_CONFIG = {
  admin: { label: "Admin", color: "#7C3AED", bg: "#F5F3FF", icon: Shield },
  support_agent: { label: "Support Agent", color: "#1D4ED8", bg: "#EFF6FF", icon: UserCheck },
  customer: { label: "Customer", color: "#065F46", bg: "#ECFDF5", icon: User },
};

const STATUS_DOT = {
  online: "#10B981", away: "#F59E0B", offline: "#D1D5DB"
};

function RolePill({ role }) {
  const cfg = ROLE_CONFIG[role] || ROLE_CONFIG.customer;
  const Icon = cfg.icon;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '4px 10px', borderRadius: '8px', background: cfg.bg, color: cfg.color, fontSize: '12px', fontWeight: '700' }}>
      <Icon size={12} /> {cfg.label}
    </span>
  );
}

export default function UserManagement() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");

  useEffect(() => {
    setTimeout(() => { setUsers(MOCK_USERS); setLoading(false); }, 500);
  }, []);

  const handleRoleChange = (userId, newRole) => {
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u));
  };

  const filtered = users.filter(u => {
    const matchSearch = u.name.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase());
    const matchRole = roleFilter === "all" || u.role === roleFilter;
    return matchSearch && matchRole;
  });

  const counts = {
    total: users.length,
    admin: users.filter(u => u.role === "admin").length,
    agent: users.filter(u => u.role === "support_agent").length,
    customer: users.filter(u => u.role === "customer").length,
  };

  return (
    <div style={{ padding: '28px', display: 'flex', flexDirection: 'column', gap: '24px' }}>

      {/* ── Premium Hero ───────────────────────────────────── */}
      <div style={{
        background: 'linear-gradient(135deg, #4F46E5 0%, #6C63FF 50%, #7C3AED 100%)',
        borderRadius: '16px', padding: '28px 32px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        boxShadow: '0 8px 32px rgba(108,99,255,0.25)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
          <div style={{ width: '64px', height: '64px', background: 'rgba(255,255,255,0.15)', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(8px)' }}>
            <Shield size={32} color="#fff" />
          </div>
          <div>
            <h2 style={{ fontSize: '22px', fontWeight: '800', color: '#fff', letterSpacing: '-0.4px' }}>👥 User Management</h2>
            <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.75)', marginTop: '4px' }}>
              Manage users, permissions, roles and access control across the platform.
            </p>
          </div>
        </div>
        <button style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', background: '#fff', border: 'none', borderRadius: '10px', cursor: 'pointer', fontSize: '14px', fontWeight: '700', color: '#4F46E5', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
          <UserPlus size={16} /> Invite User
        </button>
      </div>

      {/* ── Summary Tiles ───────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px' }}>
        {[
          { label: 'Total Users', value: counts.total, color: '#6C63FF', bg: '#EEEDFF' },
          { label: 'Admins', value: counts.admin, color: '#7C3AED', bg: '#F5F3FF' },
          { label: 'Support Agents', value: counts.agent, color: '#1D4ED8', bg: '#EFF6FF' },
          { label: 'Customers', value: counts.customer, color: '#065F46', bg: '#ECFDF5' },
        ].map(t => (
          <div key={t.label} style={{ background: '#fff', borderRadius: '12px', border: '1px solid #E4E7EC', padding: '16px 20px', boxShadow: '0 1px 3px rgba(15,23,42,0.06)' }}>
            <div style={{ fontSize: '28px', fontWeight: '800', color: '#0F172A' }}>{t.value}</div>
            <div style={{ fontSize: '13px', color: '#64748B', fontWeight: '500', marginTop: '2px' }}>{t.label}</div>
            <div style={{ height: '3px', borderRadius: '99px', background: t.color, marginTop: '12px', width: '40px' }} />
          </div>
        ))}
      </div>

      {/* ── Table Card ──────────────────────────────────── */}
      <div style={{ background: '#fff', borderRadius: '14px', border: '1px solid #E4E7EC', boxShadow: '0 1px 3px rgba(15,23,42,0.06)', overflow: 'hidden' }}>
        
        {/* Toolbar */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #F1F3F6', display: 'flex', gap: '12px', alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: 1, maxWidth: '320px' }}>
            <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#9CA3AF' }} />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name or email..."
              style={{ width: '100%', padding: '9px 12px 9px 36px', borderRadius: '10px', border: '1.5px solid #E4E7EC', fontSize: '13.5px', outline: 'none', fontFamily: 'inherit', background: '#F9FAFB' }} />
          </div>
          {/* Role filter pills */}
          <div style={{ display: 'flex', gap: '6px' }}>
            {["all", "admin", "support_agent", "customer"].map(r => (
              <button key={r} onClick={() => setRoleFilter(r)} style={{
                padding: '6px 12px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: '600',
                background: roleFilter === r ? '#6C63FF' : '#F3F4F6',
                color: roleFilter === r ? '#fff' : '#374151',
                transition: 'all 0.15s'
              }}>
                {r === "all" ? "All" : r === "support_agent" ? "Agents" : r.charAt(0).toUpperCase() + r.slice(1) + "s"}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#FAFAFA', borderBottom: '1px solid #F1F3F6' }}>
              {['User', 'Email', 'Role', 'Status', 'Joined', 'Actions'].map(h => (
                <th key={h} style={{ padding: '12px 20px', textAlign: 'left', fontSize: '11px', fontWeight: '700', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} style={{ padding: '40px', textAlign: 'center', color: '#9CA3AF' }}>Loading users...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={6} style={{ padding: '40px', textAlign: 'center', color: '#9CA3AF' }}>No users found.</td></tr>
            ) : filtered.map(u => (
              <tr key={u.id} style={{ borderBottom: '1px solid #F9FAFB', transition: 'background 0.1s' }}
                onMouseEnter={e => e.currentTarget.style.background = '#FAFBFF'}
                onMouseLeave={e => e.currentTarget.style.background = ''}>
                <td style={{ padding: '14px 20px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: '#6C63FF22', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '800', color: '#6C63FF', fontSize: '14px', flexShrink: 0 }}>
                      {u.name.charAt(0)}
                    </div>
                    <span style={{ fontWeight: '600', color: '#0F172A', fontSize: '14px' }}>{u.name}</span>
                  </div>
                </td>
                <td style={{ padding: '14px 20px', fontSize: '13px', color: '#64748B' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Mail size={13} /> {u.email}
                  </div>
                </td>
                <td style={{ padding: '14px 20px' }}>
                  <select value={u.role} onChange={e => handleRoleChange(u.id, e.target.value)}
                    disabled={u.id === currentUser?.id}
                    style={{ border: 'none', background: 'none', cursor: u.id === currentUser?.id ? 'not-allowed' : 'pointer', fontFamily: 'inherit', fontSize: '13px' }}>
                    <option value="customer">Customer</option>
                    <option value="support_agent">Support Agent</option>
                    <option value="admin">Admin</option>
                  </select>
                  {' '}<RolePill role={u.role} />
                </td>
                <td style={{ padding: '14px 20px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '7px', fontSize: '13px', color: '#374151', fontWeight: '500' }}>
                    <span style={{ width: '9px', height: '9px', borderRadius: '50%', background: STATUS_DOT[u.status], flexShrink: 0, boxShadow: u.status === 'online' ? '0 0 0 3px #D1FAE5' : 'none' }} />
                    {u.status.charAt(0).toUpperCase() + u.status.slice(1)}
                  </div>
                </td>
                <td style={{ padding: '14px 20px', fontSize: '13px', color: '#9CA3AF' }}>{u.created_at}</td>
                <td style={{ padding: '14px 20px', textAlign: 'right' }}>
                  <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', padding: '4px', borderRadius: '6px', transition: 'background 0.1s' }}
                    onMouseEnter={e => e.currentTarget.style.background = '#F3F4F6'}
                    onMouseLeave={e => e.currentTarget.style.background = 'none'}>
                    <MoreVertical size={17} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
