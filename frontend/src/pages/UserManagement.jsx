import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { Search, UserPlus, Shield, UserCheck, User, Mail, Trash2, Building2 } from "lucide-react";
import { usersAPI, authAPI } from "../api/services";
import { SkeletonTableRow } from "../components/SkeletonCard";

const ROLE_CONFIG = {
  admin:         { label: "Admin",         color: "#7C3AED", bg: "#F5F3FF", icon: Shield },
  support_agent: { label: "Support Agent", color: "#1D4ED8", bg: "#EFF6FF", icon: UserCheck },
  customer:      { label: "Customer",      color: "#065F46", bg: "#ECFDF5", icon: User },
};

const STATUS_DOT = {
  online: "#10B981", away: "#F59E0B", offline: "#D1D5DB"
};

// Department config — mirrors backend DEPARTMENT_CHOICES
const DEPARTMENT_CONFIG = {
  authentication: { label: "Authentication", color: "#7C3AED", bg: "#F5F3FF" },
  billing:        { label: "Billing",        color: "#D97706", bg: "#FFFBEB" },
  technical:      { label: "Technical",      color: "#2563EB", bg: "#EFF6FF" },
  account:        { label: "Account",        color: "#059669", bg: "#ECFDF5" },
  finance:        { label: "Finance",        color: "#0891B2", bg: "#ECFEFF" },
  general:        { label: "General",        color: "#64748B", bg: "#F8FAFC" },
  all:            { label: "All Depts",      color: "#4F46E5", bg: "#EEF2FF" },
};

const DEPARTMENT_CHOICES = ["authentication", "billing", "technical", "account", "finance", "general", "all"];

function RolePill({ role }) {
  const cfg = ROLE_CONFIG[role] || ROLE_CONFIG.customer;
  const Icon = cfg.icon;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '4px 10px', borderRadius: '8px', background: cfg.bg, color: cfg.color, fontSize: '12px', fontWeight: '700' }}>
      <Icon size={12} /> {cfg.label}
    </span>
  );
}

function DepartmentBadge({ department }) {
  if (!department) return <span style={{ color: '#94A3B8', fontSize: '12px', fontStyle: 'italic' }}>Not set</span>;
  const cfg = DEPARTMENT_CONFIG[department] || DEPARTMENT_CONFIG.general;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '4px',
      padding: '3px 9px', borderRadius: '6px',
      background: cfg.bg, color: cfg.color,
      fontSize: '11.5px', fontWeight: '700',
      border: `1px solid ${cfg.color}22`,
    }}>
      <Building2 size={10} />
      {cfg.label}
    </span>
  );
}

export default function UserManagement() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [deptSaving, setDeptSaving] = useState({});  // { userId: true/false }
  
  // Invite Modal State
  const [isInviting, setIsInviting] = useState(false);
  const [inviteData, setInviteData] = useState({ name: "", email: "", password: "", role: "customer", department: "" });
  const [inviting, setInviting] = useState(false);

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const res = await usersAPI.list();
        const usersWithStatus = res.data.map(u => ({
          ...u,
          status: "offline",
          created_at: u.created_at ? u.created_at.split("T")[0] : "N/A"
        }));
        setUsers(usersWithStatus);
      } catch (err) {
        console.error("Failed to load users:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchUsers();
  }, []);

  const handleRoleChange = async (userId, newRole) => {
    try {
      await usersAPI.updateRole(userId, newRole);
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u));
    } catch (err) {
      alert("Failed to update user role: " + (err.response?.data?.detail || err.message));
    }
  };

  const handleDepartmentChange = async (userId, newDept) => {
    setDeptSaving(prev => ({ ...prev, [userId]: true }));
    try {
      await usersAPI.setDepartment(userId, newDept);
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, department: newDept } : u));
    } catch (err) {
      alert("Failed to update department: " + (err.response?.data?.detail || err.message));
    } finally {
      setDeptSaving(prev => ({ ...prev, [userId]: false }));
    }
  };

  const handleDeleteUser = async (userId) => {
    if (!window.confirm("Are you sure you want to delete this user?")) return;
    try {
      await usersAPI.delete(userId);
      setUsers(prev => prev.filter(u => u.id !== userId));
    } catch (err) {
      alert("Failed to delete user: " + (err.response?.data?.detail || err.message));
    }
  };

  const handleInviteSubmit = async (e) => {
    e.preventDefault();
    setInviting(true);
    try {
      // Create user
      const { data } = await authAPI.register(inviteData.name, inviteData.email, inviteData.password, inviteData.role);
      
      // If agent and dept selected, set dept
      if ((inviteData.role === 'support_agent' || inviteData.role === 'admin') && inviteData.department) {
        await usersAPI.setDepartment(data.user_id, inviteData.department);
      }
      
      alert("User successfully invited!");
      setIsInviting(false);
      setInviteData({ name: "", email: "", password: "", role: "customer", department: "" });
      
      // Refresh list
      const res = await usersAPI.list();
      const usersWithStatus = res.data.map(u => ({ ...u, status: "offline", created_at: u.created_at ? u.created_at.split("T")[0] : "N/A" }));
      setUsers(usersWithStatus);
    } catch (err) {
      alert("Failed to invite user: " + (err.response?.data?.detail || err.message));
    } finally {
      setInviting(false);
    }
  };

  const filtered = users.filter(u => {
    const nameMatch  = (u.name  || "").toLowerCase().includes(search.toLowerCase());
    const emailMatch = (u.email || "").toLowerCase().includes(search.toLowerCase());
    const matchSearch = nameMatch || emailMatch;
    const matchRole   = roleFilter === "all" || u.role === roleFilter;
    return matchSearch && matchRole;
  });

  const counts = {
    total:    users.length,
    admin:    users.filter(u => u.role === "admin").length,
    agent:    users.filter(u => u.role === "support_agent").length,
    customer: users.filter(u => u.role === "customer").length,
  };

  // Dept coverage: how many of the 6 real departments have at least 1 agent
  const agentDepts = new Set(
    users
      .filter(u => u.role === "support_agent" && u.department && u.department !== "all")
      .map(u => u.department)
  );
  const deptCoverage = agentDepts.size;

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
              Manage users, roles, departments, and access control.
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          {/* Dept coverage indicator */}
          <div style={{ textAlign: 'right', color: 'rgba(255,255,255,0.85)' }}>
            <div style={{ fontSize: '22px', fontWeight: '800' }}>{deptCoverage} / 6</div>
            <div style={{ fontSize: '12px', opacity: 0.75 }}>Departments covered</div>
          </div>
          <button 
            onClick={() => setIsInviting(true)}
            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', background: '#fff', border: 'none', borderRadius: '10px', cursor: 'pointer', fontSize: '14px', fontWeight: '700', color: '#4F46E5', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
            <UserPlus size={16} /> Invite User
          </button>
        </div>
      </div>

      {/* ── Invite User Modal ─────────────────────────────── */}
      {isInviting && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15,23,42,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(4px)' }}>
          <div style={{ background: '#fff', padding: '36px', borderRadius: '16px', width: '100%', maxWidth: '580px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
            <h3 style={{ fontSize: '22px', fontWeight: '800', color: '#0F172A', marginBottom: '8px' }}>Invite New User</h3>
            <p style={{ fontSize: '14px', color: '#64748B', marginBottom: '24px' }}>Create an account for a new team member or customer.</p>
            
            <form onSubmit={handleInviteSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>Full Name</label>
                <input required value={inviteData.name} onChange={e => setInviteData({...inviteData, name: e.target.value})} style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '14px' }} placeholder="Jane Doe" />
              </div>
              
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>Email Address</label>
                <input required type="email" value={inviteData.email} onChange={e => setInviteData({...inviteData, email: e.target.value})} style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '14px' }} placeholder="jane@company.com" />
              </div>
              
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>Temporary Password</label>
                <input required type="text" value={inviteData.password} onChange={e => setInviteData({...inviteData, password: e.target.value})} style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '14px' }} placeholder="Password123!" />
              </div>

              <div style={{ display: 'flex', gap: '12px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>Role</label>
                  <select value={inviteData.role} onChange={e => setInviteData({...inviteData, role: e.target.value})} style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '14px', background: '#fff' }}>
                    <option value="customer">Customer</option>
                    <option value="support_agent">Support Agent</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
                {(inviteData.role === 'support_agent' || inviteData.role === 'admin') && (
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>Department</label>
                    <select value={inviteData.department} onChange={e => setInviteData({...inviteData, department: e.target.value})} style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '14px', background: '#fff' }}>
                      <option value="">None (Optional)</option>
                      {DEPARTMENT_CHOICES.map(d => <option key={d} value={d}>{DEPARTMENT_CONFIG[d]?.label}</option>)}
                    </select>
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '16px' }}>
                <button type="button" onClick={() => setIsInviting(false)} style={{ padding: '10px 16px', borderRadius: '8px', border: 'none', background: '#F1F5F9', color: '#475569', fontWeight: '600', cursor: 'pointer' }}>Cancel</button>
                <button type="submit" disabled={inviting} style={{ padding: '10px 16px', borderRadius: '8px', border: 'none', background: '#4F46E5', color: '#fff', fontWeight: '600', cursor: inviting ? 'not-allowed' : 'pointer' }}>
                  {inviting ? "Inviting..." : "Send Invite"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Summary Tiles ───────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px' }}>
        {[
          { label: 'Total Users',    value: counts.total,    color: '#6C63FF', bg: '#EEEDFF' },
          { label: 'Admins',         value: counts.admin,    color: '#7C3AED', bg: '#F5F3FF' },
          { label: 'Support Agents', value: counts.agent,    color: '#1D4ED8', bg: '#EFF6FF' },
          { label: 'Customers',      value: counts.customer, color: '#065F46', bg: '#ECFDF5' },
        ].map(t => (
          <div key={t.label} style={{ background: '#fff', borderRadius: '12px', border: '1px solid #E4E7EC', padding: '16px 20px', boxShadow: '0 1px 3px rgba(15,23,42,0.06)' }}>
            <div style={{ fontSize: '28px', fontWeight: '800', color: '#0F172A' }}>{t.value}</div>
            <div style={{ fontSize: '13px', color: '#64748B', fontWeight: '500', marginTop: '2px' }}>{t.label}</div>
            <div style={{ height: '3px', borderRadius: '99px', background: t.color, marginTop: '12px', width: '40px' }} />
          </div>
        ))}
      </div>

      {/* ── Department Coverage Map ──────────────────────── */}
      <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #E4E7EC', padding: '20px 24px', boxShadow: '0 1px 3px rgba(15,23,42,0.04)' }}>
        <div style={{ fontSize: '13px', fontWeight: '700', color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Building2 size={14} /> Department Coverage
        </div>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          {DEPARTMENT_CHOICES.filter(d => d !== 'all').map(dept => {
            const cfg = DEPARTMENT_CONFIG[dept];
            const agentsInDept = users.filter(u => u.role === 'support_agent' && u.department === dept);
            const covered = agentsInDept.length > 0;
            return (
              <div key={dept} style={{
                padding: '8px 14px',
                borderRadius: '10px',
                background: covered ? cfg.bg : '#F8FAFC',
                border: `1.5px solid ${covered ? cfg.color + '44' : '#E2E8F0'}`,
                display: 'flex', flexDirection: 'column', gap: '4px',
                minWidth: '120px',
              }}>
                <span style={{ fontSize: '12px', fontWeight: '700', color: covered ? cfg.color : '#94A3B8' }}>
                  {cfg.label}
                </span>
                <span style={{ fontSize: '11px', color: covered ? cfg.color + 'CC' : '#CBD5E1' }}>
                  {covered ? `${agentsInDept.length} agent${agentsInDept.length > 1 ? 's' : ''}` : 'No agent assigned'}
                </span>
              </div>
            );
          })}
        </div>
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

        {/* Table wrapper for horizontal scroll */}
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#FAFAFA', borderBottom: '1px solid #F1F3F6' }}>
                {['User', 'Email', 'Role', 'Department', 'Status', 'Joined', 'Actions'].map(h => (
                  <th key={h} style={{
                    padding: '12px 20px',
                    textAlign: h === 'Actions' ? 'right' : 'left',
                    fontSize: '11px',
                    fontWeight: '700',
                    color: '#9CA3AF',
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    whiteSpace: 'nowrap',
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                [1, 2, 3, 4, 5].map(i => (
                  <SkeletonTableRow key={i} cols={7} />
                ))
              ) : filtered.length === 0 ? (
                <tr><td colSpan={7} style={{ padding: '40px', textAlign: 'center', color: '#9CA3AF' }}>No users found.</td></tr>
              ) : filtered.map(u => (
                <tr key={u.id} style={{ borderBottom: '1px solid #F9FAFB', transition: 'background 0.1s' }}
                  onMouseEnter={e => e.currentTarget.style.background = '#FAFBFF'}
                  onMouseLeave={e => e.currentTarget.style.background = ''}>
                  {/* User */}
                  <td style={{ padding: '14px 20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: '#6C63FF22', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '800', color: '#6C63FF', fontSize: '14px', flexShrink: 0 }}>
                        {u.name.charAt(0).toUpperCase()}
                      </div>
                      <span style={{ fontWeight: '600', color: '#0F172A', fontSize: '14px' }}>{u.name}</span>
                    </div>
                  </td>
                  {/* Email */}
                  <td style={{ padding: '14px 20px', fontSize: '13px', color: '#64748B' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Mail size={13} /> {u.email}
                    </div>
                  </td>
                  {/* Role */}
                  <td style={{ padding: '14px 20px' }}>
                    <select value={u.role} onChange={e => handleRoleChange(u.id, e.target.value)}
                      disabled={u.id === currentUser?.id}
                      style={{ border: 'none', background: 'none', cursor: u.id === currentUser?.id ? 'not-allowed' : 'pointer', fontFamily: 'inherit', fontSize: '13px', marginRight: '6px' }}>
                      <option value="customer">Customer</option>
                      <option value="support_agent">Support Agent</option>
                      <option value="admin">Admin</option>
                    </select>
                    <RolePill role={u.role} />
                  </td>
                  {/* Department — only shown for agents/admins */}
                  <td style={{ padding: '14px 20px', minWidth: '160px' }}>
                    {(u.role === 'support_agent' || u.role === 'admin') ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <select
                          value={u.department || ''}
                          onChange={e => handleDepartmentChange(u.id, e.target.value)}
                          disabled={deptSaving[u.id]}
                          style={{
                            padding: '5px 8px',
                            border: '1.5px solid #E2E8F0',
                            borderRadius: '7px',
                            fontSize: '12.5px',
                            fontFamily: 'inherit',
                            background: '#F8FAFC',
                            color: '#334155',
                            cursor: 'pointer',
                            outline: 'none',
                          }}
                        >
                          <option value="" disabled>Set dept…</option>
                          {DEPARTMENT_CHOICES.map(d => (
                            <option key={d} value={d}>{DEPARTMENT_CONFIG[d]?.label || d}</option>
                          ))}
                        </select>
                        <DepartmentBadge department={u.department} />
                        {deptSaving[u.id] && <span style={{ fontSize: '11px', color: '#6366F1' }}>Saving…</span>}
                      </div>
                    ) : (
                      <span style={{ color: '#CBD5E1', fontSize: '12px' }}>—</span>
                    )}
                  </td>
                  {/* Status */}
                  <td style={{ padding: '14px 20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '7px', fontSize: '13px', color: '#374151', fontWeight: '500' }}>
                      <span style={{ width: '9px', height: '9px', borderRadius: '50%', background: STATUS_DOT[u.status], flexShrink: 0, boxShadow: u.status === 'online' ? '0 0 0 3px #D1FAE5' : 'none' }} />
                      {u.status.charAt(0).toUpperCase() + u.status.slice(1)}
                    </div>
                  </td>
                  {/* Joined */}
                  <td style={{ padding: '14px 20px', fontSize: '13px', color: '#9CA3AF' }}>{u.created_at}</td>
                  {/* Actions */}
                  <td style={{ padding: '14px 20px', textAlign: 'right' }}>
                    {u.id !== currentUser?.id && (
                      <button
                        onClick={() => handleDeleteUser(u.id)}
                        style={{
                          background: 'none', border: 'none', cursor: 'pointer', color: '#EF4444',
                          padding: '6px', borderRadius: '6px', transition: 'background 0.15s',
                          display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '13px'
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = '#FEF2F2'}
                        onMouseLeave={e => e.currentTarget.style.background = 'none'}
                        title="Delete User"
                      >
                        <Trash2 size={15} /> Delete
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
