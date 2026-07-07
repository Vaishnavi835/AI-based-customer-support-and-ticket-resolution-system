import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { usersAPI, ticketsAPI, authAPI } from "../api/services";
import { useToast } from "../context/ToastContext";
import { 
  User, Shield, Bell, Lock,
  Calendar, Tag, 
  CheckCircle, Laptop, Smartphone
} from "lucide-react";

export default function Profile() {
  const { user, updateUser, logout } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  /* Tab state */
  const [activeTab, setActiveTab] = useState("profile"); // "profile", "security", "notifications", "privacy"

  /* Profile state fields */
  const [name, setName] = useState(user?.name || "");
  const [email, setEmail] = useState(user?.email || "");
  const [phone, setPhone] = useState(() => localStorage.getItem(`phone_${user?.id}`) || "+1 (555) 019-2834");
  const [organization, setOrganization] = useState(() => localStorage.getItem(`organization_${user?.id}`) || "Acme Support Org");
  const [isUpdating, setIsUpdating] = useState(false);

  /* Password state fields */
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  /* Security and Notification states */
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(() => localStorage.getItem(`2fa_${user?.id}`) === "true");
  const [notifPreferences, setNotifPreferences] = useState(() => {
    const saved = localStorage.getItem(`notifs_${user?.id}`);
    return saved ? JSON.parse(saved) : {
      ticketUpdates: true,
      aiAlerts: true,
      emailNotifications: true,
      securityAlerts: false
    };
  });

  /* Dynamic stats fields */
  const [tickets, setTickets] = useState([]);
  const [loadingStats, setLoadingStats] = useState(true);

  /* Active sessions state */
  const [sessions, setSessions] = useState([]);
  const [loadingSessions, setLoadingSessions] = useState(true);

  /* Security action states */
  const [isLoggingOutOthers, setIsLoggingOutOthers] = useState(false);

  const getDeviceIcon = (deviceStr) => {
    const d = (deviceStr || "").toLowerCase();
    if (d.includes("phone") || d.includes("ios") || d.includes("android") || d.includes("mobile")) {
      return <Smartphone size={18} />;
    }
    return <Laptop size={18} />;
  };

  const formatSessionTime = (active) => {
    if (active === "Now") return "Active Now";
    try {
      const d = new Date(active);
      return `Last active: ${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    } catch {
      return `Last active: ${active}`;
    }
  };

  useEffect(() => {
    if (user) {
      ticketsAPI.list()
        .then(res => setTickets(res.data.tickets || []))
        .catch(() => {})
        .finally(() => setLoadingStats(false));

      authAPI.getSessions()
        .then(res => {
          setSessions(res.data || []);
        })
        .catch(err => {
          console.error("Failed to load active sessions", err);
        })
        .finally(() => setLoadingSessions(false));
    }
  }, [user]);

  if (!user) {
    return <div className="cd-page" style={{ padding: '32px' }}><p>Loading profile...</p></div>;
  }

  /* Password strength calculator */
  const getPasswordStrength = (pass) => {
    if (!pass) return { score: 0, label: "None", color: "#E2E8F0", width: "0%" };
    let score = 0;
    if (pass.length >= 8) score++;
    if (/[0-9]/.test(pass)) score++;
    if (/[^A-Za-z0-9]/.test(pass)) score++;
    
    if (score === 1) return { score: 1, label: "Weak", color: "#EF4444", width: "33%" };
    if (score === 2) return { score: 2, label: "Medium", color: "#F59E0B", width: "66%" };
    if (score === 3) return { score: 3, label: "Strong", color: "#10B981", width: "100%" };
    return { score: 1, label: "Weak", color: "#EF4444", width: "33%" };
  };
  const pwStrength = getPasswordStrength(newPassword);

  /* Event Handlers */
  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    if (!name || !email) return toast.warning("Name and Email are required");
    setIsUpdating(true);
    try {
      await usersAPI.updateProfile(name, email);
      updateUser({ name, email });
      localStorage.setItem(`phone_${user.id}`, phone);
      localStorage.setItem(`organization_${user.id}`, organization);
      toast.success("Profile details updated successfully!");
    } catch (err) {
      toast.error("Failed to update profile: " + (err.response?.data?.detail || err.message));
    } finally {
      setIsUpdating(false);
    }
  };

  const handleUpdatePassword = async (e) => {
    e.preventDefault();
    if (!currentPassword || !newPassword || !confirmPassword) {
      return toast.warning("All password fields are required");
    }
    if (newPassword !== confirmPassword) {
      return toast.error("New password and confirmation do not match");
    }
    if (pwStrength.score < 2) {
      return toast.warning("Please choose a stronger password");
    }
    
    setIsChangingPassword(true);
    try {
      await usersAPI.updatePassword(currentPassword, newPassword);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      toast.success("Password updated successfully!");
    } catch (err) {
      toast.error("Failed to update password: " + (err.response?.data?.detail || err.message));
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleAvatarChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Profile picture must be under 2MB.");
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => {
      updateUser({ avatar: reader.result });
      toast.success("Profile photo updated successfully!");
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveAvatar = () => {
    updateUser({ avatar: null });
    toast.success("Profile photo removed.");
  };

  const handleToggle2FA = () => {
    const nextVal = !twoFactorEnabled;
    setTwoFactorEnabled(nextVal);
    localStorage.setItem(`2fa_${user.id}`, String(nextVal));
    if (nextVal) {
      toast.success("Two-Factor Authentication (2FA) enabled!");
    } else {
      toast.warning("Two-Factor Authentication (2FA) disabled.");
    }
  };

  const handleNotifPreferenceChange = (key) => {
    setNotifPreferences(prev => {
      const next = { ...prev, [key]: !prev[key] };
      localStorage.setItem(`notifs_${user.id}`, JSON.stringify(next));
      return next;
    });
    toast.success("Notification preferences saved.");
  };

  const handleLogoutOtherDevices = async () => {
    setIsLoggingOutOthers(true);
    try {
      await authAPI.logoutOthers();
      setSessions(prev => prev.filter(s => s.active === "Now" || s.is_current));
      toast.success("Successfully logged out other active devices.");
    } catch (err) {
      toast.error("Failed to logout other devices: " + (err.response?.data?.detail || err.message));
    } finally {
      setIsLoggingOutOthers(false);
    }
  };

  const handleExportData = () => {
    const profileMeta = {
      user: { name, email, phone, organization, role: user.role },
      preferences: notifPreferences,
      twoFactorEnabled,
      exportedAt: new Date().toISOString()
    };
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(profileMeta, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `profile_export_${user.id}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    toast.success("Account data metadata exported successfully!");
  };

  const handleDownloadTickets = () => {
    if (tickets.length === 0) {
      return toast.warning("No tickets available to download.");
    }
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(tickets, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `tickets_backup_${user.id}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    toast.success("Tickets backup database backup downloaded successfully!");
  };

  const handleDeleteAccount = async () => {
    if (window.confirm("WARNING: Are you absolutely sure you want to permanently delete your account? This action is irreversible and all tickets will be archived.")) {
      try {
        await usersAPI.deleteOwnAccount();
        toast.success("Your account has been deleted.");
        logout();
        navigate("/register");
      } catch (err) {
        toast.error("Failed to delete account: " + (err.response?.data?.detail || err.message));
      }
    }
  };

  /* Stats calculation variables */
  const openCount = tickets.filter(t => t.status === "open").length;
  const totalCount = tickets.length;

  return (
    <div className="cd-page" style={{ padding: '32px', background: '#F8FAFC', minHeight: 'calc(100vh - 64px)' }}>
      
      {/* Title Header */}
      <div style={{ marginBottom: '24px' }}>
        <h1 className="text-dashboard-title" style={{ margin: 0, fontSize: '26px', fontWeight: '800', letterSpacing: '-0.5px' }}>Account Settings</h1>
        <p style={{ margin: '4px 0 0 0', fontSize: '14.5px', color: '#64748B' }}>
          Manage your personal details, credentials, and notifications
        </p>
      </div>

      {/* Main Grid Wrapper */}
      <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: '32px', alignItems: 'flex-start' }}>
        
        {/* Left column: Sidebar Tabs & Profile Capsule */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* Profile overview capsule card */}
          <div style={{ background: '#ffffff', borderRadius: '16px', border: '1px solid #E2E8F0', padding: '24px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', boxShadow: 'var(--shadow-sm)' }}>
            <div style={{ position: 'relative', width: '92px', height: '92px', marginBottom: '16px' }}>
              <div style={{
                width: '92px', height: '92px', borderRadius: '50%',
                background: 'linear-gradient(135deg, #1E293B 0%, #0F172A 100%)', color: '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '38px', fontWeight: '800', boxShadow: '0 8px 16px rgba(15, 23, 42, 0.15)',
                overflow: 'hidden'
              }}>
                {user.avatar ? (
                  <img src={user.avatar} alt={user.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  user.name?.[0]?.toUpperCase()
                )}
              </div>
              <button 
                onClick={() => fileInputRef.current?.click()}
                style={{ position: 'absolute', bottom: '-4px', right: '-4px', width: '28px', height: '28px', borderRadius: '50%', background: '#0F172A', color: '#fff', border: '2px solid #fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: '13px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}
                title="Change Photo"
              >
                +
              </button>
              <input 
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleAvatarChange}
                style={{ display: 'none' }}
              />
            </div>

            <h3 style={{ fontSize: '17px', fontWeight: '750', color: '#0F172A', margin: 0 }}>{user.name}</h3>
            <span style={{ fontSize: '11px', display: 'inline-block', padding: '2px 10px', borderRadius: '99px', background: '#F1F5F9', color: '#475569', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: '6px' }}>
              {user.role}
            </span>

            <div style={{ display: 'flex', gap: '8px', marginTop: '16px', width: '100%' }}>
              <button 
                onClick={() => fileInputRef.current?.click()}
                style={{ flex: 1, padding: '7px 0', border: '1px solid #CBD5E1', borderRadius: '8px', fontSize: '11.5px', fontWeight: '600', color: '#475569', background: '#fff', cursor: 'pointer' }}
              >
                Upload
              </button>
              {user.avatar && (
                <button 
                  onClick={handleRemoveAvatar}
                  style={{ flex: 1, padding: '7px 0', border: '1px solid #FEE2E2', borderRadius: '8px', fontSize: '11.5px', fontWeight: '600', color: '#EF4444', background: '#FEF2F2', cursor: 'pointer' }}
                >
                  Remove
                </button>
              )}
            </div>
          </div>

          {/* Navigation vertical list menu */}
          <div style={{ background: '#ffffff', borderRadius: '16px', border: '1px solid #E2E8F0', padding: '8px', display: 'flex', flexDirection: 'column', gap: '4px', boxShadow: 'var(--shadow-sm)' }}>
            <button 
              onClick={() => setActiveTab("profile")}
              style={{
                display: 'flex', alignItems: 'center', gap: '10px', width: '100%', padding: '12px 16px', border: 'none', borderRadius: '10px',
                background: activeTab === "profile" ? "#0F172A" : "transparent",
                color: activeTab === "profile" ? "#ffffff" : "#475569",
                fontWeight: activeTab === "profile" ? "700" : "550",
                fontSize: '13.5px', cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s'
              }}
            >
              <User size={16} />
              <span>Profile Settings</span>
            </button>
            <button 
              onClick={() => setActiveTab("security")}
              style={{
                display: 'flex', alignItems: 'center', gap: '10px', width: '100%', padding: '12px 16px', border: 'none', borderRadius: '10px',
                background: activeTab === "security" ? "#0F172A" : "transparent",
                color: activeTab === "security" ? "#ffffff" : "#475569",
                fontWeight: activeTab === "security" ? "700" : "550",
                fontSize: '13.5px', cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s'
              }}
            >
              <Shield size={16} />
              <span>Security & Devices</span>
            </button>
            <button 
              onClick={() => setActiveTab("notifications")}
              style={{
                display: 'flex', alignItems: 'center', gap: '10px', width: '100%', padding: '12px 16px', border: 'none', borderRadius: '10px',
                background: activeTab === "notifications" ? "#0F172A" : "transparent",
                color: activeTab === "notifications" ? "#ffffff" : "#475569",
                fontWeight: activeTab === "notifications" ? "700" : "550",
                fontSize: '13.5px', cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s'
              }}
            >
              <Bell size={16} />
              <span>Notifications Alerts</span>
            </button>
            <button 
              onClick={() => setActiveTab("privacy")}
              style={{
                display: 'flex', alignItems: 'center', gap: '10px', width: '100%', padding: '12px 16px', border: 'none', borderRadius: '10px',
                background: activeTab === "privacy" ? "#0F172A" : "transparent",
                color: activeTab === "privacy" ? "#ffffff" : "#475569",
                fontWeight: activeTab === "privacy" ? "700" : "550",
                fontSize: '13.5px', cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s'
              }}
            >
              <Lock size={16} />
              <span>Privacy & Actions</span>
            </button>
          </div>
        </div>

        {/* Right column: Content Window */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>

          {/* TAB 1: PROFILE TAB */}
          {activeTab === "profile" && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: '28px', alignItems: 'flex-start' }} className="cd-fade-in">
              {/* Profile Details Form */}
              <div style={{ background: '#ffffff', borderRadius: '16px', border: '1px solid #E2E8F0', padding: '32px', boxShadow: 'var(--shadow-sm)' }}>
                <h2 style={{ fontSize: '18px', fontWeight: '750', color: '#0F172A', borderBottom: '1px solid #F1F5F9', paddingBottom: '12px', marginBottom: '20px' }}>
                  Personal Information
                </h2>
                
                <form onSubmit={handleUpdateProfile} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '18px' }}>
                    <div className="cd-field">
                      <label style={{ fontSize: '13px', fontWeight: '600', color: '#475569', marginBottom: '6px', display: 'block' }}>Full Name</label>
                      <input 
                        type="text" 
                        value={name} 
                        onChange={e => setName(e.target.value)} 
                        style={{ width: '100%', padding: '11px 14px', borderRadius: '8px', border: '1.5px solid #CBD5E1', fontSize: '14.5px', color: '#0F172A', outline: 'none', transition: 'border-color 0.2s' }} 
                        className="profile-input-light"
                      />
                    </div>
                    
                    <div className="cd-field">
                      <label style={{ fontSize: '13px', fontWeight: '600', color: '#475569', marginBottom: '6px', display: 'block' }}>Email Address</label>
                      <input 
                        type="email" 
                        value={email} 
                        onChange={e => setEmail(e.target.value)} 
                        style={{ width: '100%', padding: '11px 14px', borderRadius: '8px', border: '1.5px solid #CBD5E1', fontSize: '14.5px', color: '#0F172A', outline: 'none', transition: 'border-color 0.2s' }} 
                        className="profile-input-light"
                      />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '18px' }}>
                    <div className="cd-field">
                      <label style={{ fontSize: '13px', fontWeight: '600', color: '#475569', marginBottom: '6px', display: 'block' }}>Phone Number</label>
                      <input 
                        type="text" 
                        value={phone} 
                        onChange={e => setPhone(e.target.value)} 
                        style={{ width: '100%', padding: '11px 14px', borderRadius: '8px', border: '1.5px solid #CBD5E1', fontSize: '14.5px', color: '#0F172A', outline: 'none', transition: 'border-color 0.2s' }} 
                        placeholder="+1 (555) 019-2834"
                        className="profile-input-light"
                      />
                    </div>
                    
                    <div className="cd-field">
                      <label style={{ fontSize: '13px', fontWeight: '600', color: '#475569', marginBottom: '6px', display: 'block' }}>Organization</label>
                      <input 
                        type="text" 
                        value={organization} 
                        onChange={e => setOrganization(e.target.value)} 
                        style={{ width: '100%', padding: '11px 14px', borderRadius: '8px', border: '1.5px solid #CBD5E1', fontSize: '14.5px', color: '#0F172A', outline: 'none', transition: 'border-color 0.2s' }} 
                        placeholder="Organization Name"
                        className="profile-input-light"
                      />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '18px' }}>
                    <div className="cd-field">
                      <label style={{ fontSize: '13px', fontWeight: '600', color: '#94A3B8', marginBottom: '6px', display: 'block' }}>Member Since</label>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '11px 14px', borderRadius: '8px', background: '#F8FAFC', border: '1px solid #E2E8F0', color: '#475569', fontSize: '14.5px' }}>
                        <Calendar size={15} style={{ color: '#94A3B8' }} />
                        <span>June 2026</span>
                      </div>
                    </div>
                    
                    <div className="cd-field">
                      <label style={{ fontSize: '13px', fontWeight: '600', color: '#94A3B8', marginBottom: '6px', display: 'block' }}>Role</label>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '11px 14px', borderRadius: '8px', background: '#F8FAFC', border: '1px solid #E2E8F0', color: '#475569', fontSize: '14.5px', textTransform: 'capitalize' }}>
                        <Tag size={15} style={{ color: '#94A3B8' }} />
                        <span>{user.role}</span>
                      </div>
                    </div>
                  </div>

                  <button 
                    type="submit" 
                    disabled={isUpdating} 
                    style={{
                      width: 'fit-content', background: '#0F172A', color: '#fff', border: 'none', borderRadius: '8px',
                      padding: '12px 24px', fontSize: '14px', fontWeight: '700', cursor: isUpdating ? 'not-allowed' : 'pointer',
                      transition: 'background 0.2s', alignSelf: 'flex-start', marginTop: '10px'
                    }}
                  >
                    {isUpdating ? "Saving Changes..." : "Save Profile Details"}
                  </button>
                </form>
              </div>

              {/* Account Summary Side Card */}
              <div style={{ background: '#ffffff', borderRadius: '16px', border: '1px solid #E2E8F0', padding: '24px', boxShadow: 'var(--shadow-sm)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <h3 style={{ fontSize: '15px', fontWeight: '750', color: '#0F172A', borderBottom: '1px solid #F1F5F9', paddingBottom: '10px', margin: 0 }}>
                  Account Summary
                </h3>
                {loadingStats ? (
                  <div style={{ fontSize: '13px', color: '#64748B' }}>Loading summary statistics...</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13.5px' }}>
                      <span style={{ color: '#64748B', fontWeight: '500' }}>Active Status</span>
                      <span style={{ color: '#10B981', fontWeight: '700' }}>Active Now</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13.5px' }}>
                      <span style={{ color: '#64748B', fontWeight: '500' }}>Open Tickets</span>
                      <span style={{ color: '#0F172A', fontWeight: '700' }}>{openCount}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13.5px' }}>
                      <span style={{ color: '#64748B', fontWeight: '500' }}>Total Tickets</span>
                      <span style={{ color: '#0F172A', fontWeight: '700' }}>{totalCount}</span>
                    </div>

                    <div style={{ marginTop: '8px', background: '#F8FAFC', border: '1px solid #E2E8F0', padding: '12px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <CheckCircle size={16} style={{ color: '#10B981', flexShrink: 0 }} />
                      <span style={{ fontSize: '11.5px', color: '#475569', lineHeight: 1.3 }}>Account compliant with SLA policies.</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: SECURITY TAB */}
          {activeTab === "security" && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: '28px', alignItems: 'flex-start' }} className="cd-fade-in">
              
              {/* Security Forms Column */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
                
                {/* Password Change Form */}
                <div style={{ background: '#ffffff', borderRadius: '16px', border: '1px solid #E2E8F0', padding: '32px', boxShadow: 'var(--shadow-sm)' }}>
                  <h2 style={{ fontSize: '18px', fontWeight: '750', color: '#0F172A', borderBottom: '1px solid #F1F5F9', paddingBottom: '12px', marginBottom: '20px' }}>
                    Credentials & Password
                  </h2>
                  
                  <form onSubmit={handleUpdatePassword} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div className="cd-field">
                      <label style={{ fontSize: '13px', fontWeight: '600', color: '#475569', marginBottom: '6px', display: 'block' }}>Current Password</label>
                      <input 
                        type="password" 
                        value={currentPassword} 
                        onChange={e => setCurrentPassword(e.target.value)} 
                        style={{ width: '100%', padding: '11px 14px', borderRadius: '8px', border: '1.5px solid #CBD5E1', fontSize: '14.5px', outline: 'none' }} 
                        placeholder="••••••••" 
                        className="profile-input-light"
                      />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '18px' }}>
                      <div className="cd-field">
                        <label style={{ fontSize: '13px', fontWeight: '600', color: '#475569', marginBottom: '6px', display: 'block' }}>New Password</label>
                        <input 
                          type="password" 
                          value={newPassword} 
                          onChange={e => setNewPassword(e.target.value)} 
                          style={{ width: '100%', padding: '11px 14px', borderRadius: '8px', border: '1.5px solid #CBD5E1', fontSize: '14.5px', outline: 'none' }} 
                          placeholder="Minimum 8 characters" 
                          className="profile-input-light"
                        />
                      </div>
                      
                      <div className="cd-field">
                        <label style={{ fontSize: '13px', fontWeight: '600', color: '#475569', marginBottom: '6px', display: 'block' }}>Confirm New Password</label>
                        <input 
                          type="password" 
                          value={confirmPassword} 
                          onChange={e => setConfirmPassword(e.target.value)} 
                          style={{ width: '100%', padding: '11px 14px', borderRadius: '8px', border: '1.5px solid #CBD5E1', fontSize: '14.5px', outline: 'none' }} 
                          placeholder="Re-type new password" 
                          className="profile-input-light"
                        />
                      </div>
                    </div>

                    {/* Password Strength Indicator */}
                    {newPassword && (
                      <div style={{ background: '#F8FAFC', padding: '12px 16px', borderRadius: '8px', border: '1px solid #E2E8F0', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px' }}>
                          <span style={{ color: '#64748B', fontWeight: '600' }}>Password Strength:</span>
                          <span style={{ color: pwStrength.color, fontWeight: '800' }}>{pwStrength.label}</span>
                        </div>
                        <div style={{ background: '#E2E8F0', height: '6px', borderRadius: '3px', overflow: 'hidden' }}>
                          <div style={{ background: pwStrength.color, width: pwStrength.width, height: '100%', transition: 'width 0.3s ease' }} />
                        </div>
                      </div>
                    )}

                    <button 
                      type="submit" 
                      disabled={isChangingPassword} 
                      style={{
                        width: 'fit-content', background: '#0F172A', color: '#fff', border: 'none', borderRadius: '8px',
                        padding: '12px 24px', fontSize: '14px', fontWeight: '700', cursor: isChangingPassword ? 'not-allowed' : 'pointer',
                        transition: 'background 0.2s', alignSelf: 'flex-start', marginTop: '10px'
                      }}
                    >
                      {isChangingPassword ? "Saving..." : "Update Password"}
                    </button>
                  </form>
                </div>

                {/* Logged in Active Sessions list */}
                <div style={{ background: '#ffffff', borderRadius: '16px', border: '1px solid #E2E8F0', padding: '32px', boxShadow: 'var(--shadow-sm)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #F1F5F9', paddingBottom: '12px', marginBottom: '20px' }}>
                    <h2 style={{ fontSize: '18px', fontWeight: '750', color: '#0F172A', margin: 0 }}>
                      Active Logged In Sessions
                    </h2>
                    {sessions.length > 1 && (
                      <button 
                        onClick={handleLogoutOtherDevices}
                        disabled={isLoggingOutOthers}
                        style={{ background: 'none', border: 'none', color: '#EF4444', fontWeight: '700', fontSize: '13px', cursor: isLoggingOutOthers ? 'not-allowed' : 'pointer' }}
                      >
                        {isLoggingOutOthers ? "Logging out..." : "Logout Other Devices"}
                      </button>
                    )}
                  </div>
                  
                  {loadingSessions ? (
                    <div style={{ fontSize: '13.5px', color: '#64748B' }}>Loading active sessions...</div>
                  ) : sessions.length === 0 ? (
                    <div style={{ fontSize: '13.5px', color: '#64748B' }}>No active sessions found.</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                      {sessions.map(s => (
                        <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#F8FAFC', padding: '14px 18px', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '36px', height: '36px', background: '#E2E8F0', color: '#0F172A', borderRadius: '8px' }}>
                              {getDeviceIcon(s.device)}
                            </span>
                            <div>
                              <div style={{ fontSize: '14px', fontWeight: '700', color: '#1E293B' }}>{s.device}</div>
                              <div style={{ fontSize: '12px', color: '#64748B' }}>{s.browser} • {s.ip_address || "127.0.0.1"}</div>
                            </div>
                          </div>
                          <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
                            <span style={{ fontSize: '12px', fontWeight: '700', color: s.active === 'Now' ? '#10B981' : '#64748B' }}>
                              {s.active === 'Now' ? 'Active Now' : formatSessionTime(s.active)}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

              </div>

              {/* Security Center checklist Sidebar */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                {/* 2FA Card */}
                <div style={{ background: '#ffffff', borderRadius: '16px', border: '1px solid #E2E8F0', padding: '24px', boxShadow: 'var(--shadow-sm)' }}>
                  <h3 style={{ fontSize: '15px', fontWeight: '750', color: '#0F172A', borderBottom: '1px solid #F1F5F9', paddingBottom: '10px', marginBottom: '16px', margin: 0 }}>
                    Two-Factor Auth (2FA)
                  </h3>
                  
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                    <span style={{ fontSize: '13px', color: '#475569', fontWeight: '500' }}>2FA Security Shield</span>
                    <label className="profile-toggle">
                      <input 
                        type="checkbox" 
                        checked={twoFactorEnabled} 
                        onChange={handleToggle2FA} 
                      />
                      <span className="profile-slider" />
                    </label>
                  </div>
                  <span style={{ fontSize: '12px', color: '#64748B', display: 'block', lineHeight: 1.4 }}>
                    Provides an extra layer of defense by requiring an authentication token on sign in.
                  </span>
                </div>

                {/* Security Center list summary */}
                <div style={{ background: '#ffffff', borderRadius: '16px', border: '1px solid #E2E8F0', padding: '24px', boxShadow: 'var(--shadow-sm)', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <h3 style={{ fontSize: '15px', fontWeight: '750', color: '#0F172A', borderBottom: '1px solid #F1F5F9', paddingBottom: '10px', margin: 0 }}>
                    Security Center
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
                      <span style={{ color: '#10B981', fontWeight: 'bold' }}>✓</span>
                      <span style={{ color: '#1E293B', fontWeight: '500' }}>Email verified</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
                      <span style={{ color: '#10B981', fontWeight: 'bold' }}>✓</span>
                      <span style={{ color: '#1E293B', fontWeight: '500' }}>Strong Password set</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
                      <span style={{ color: twoFactorEnabled ? '#10B981' : '#94A3B8', fontWeight: 'bold' }}>
                        {twoFactorEnabled ? '✓' : '○'}
                      </span>
                      <span style={{ color: twoFactorEnabled ? '#1E293B' : '#64748B', fontWeight: '500' }}>
                        2FA Shield {twoFactorEnabled ? 'Active' : 'Disabled'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

            </div>
          )}

          {/* TAB 3: NOTIFICATIONS TAB */}
          {activeTab === "notifications" && (
            <div style={{ background: '#ffffff', borderRadius: '16px', border: '1px solid #E2E8F0', padding: '32px', boxShadow: 'var(--shadow-sm)', maxWidth: '640px' }} className="cd-fade-in">
              <h2 style={{ fontSize: '18px', fontWeight: '750', color: '#0F172A', borderBottom: '1px solid #F1F5F9', paddingBottom: '12px', marginBottom: '24px' }}>
                Notification Preferences
              </h2>
              
              <div className="profile-pref-list" style={{ display: 'flex', flexDirection: 'column' }}>
                
                <div className="profile-pref-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 0', borderBottom: '1px solid #F1F5F9' }}>
                  <div className="profile-pref-info">
                    <span className="profile-pref-title" style={{ fontSize: '14.5px', fontWeight: '700', color: '#1E293B' }}>Ticket Updates</span>
                    <span className="profile-pref-desc" style={{ fontSize: '12.5px', color: '#64748B', display: 'block', marginTop: '3px' }}>
                      Get alerts whenever an agent updates, assigns, or replies to your tickets.
                    </span>
                  </div>
                  <label className="profile-toggle">
                    <input 
                      type="checkbox" 
                      checked={notifPreferences.ticketUpdates}
                      onChange={() => handleNotifPreferenceChange("ticketUpdates")}
                    />
                    <span className="profile-slider" />
                  </label>
                </div>

                <div className="profile-pref-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 0', borderBottom: '1px solid #F1F5F9' }}>
                  <div className="profile-pref-info">
                    <span className="profile-pref-title" style={{ fontSize: '14.5px', fontWeight: '700', color: '#1E293B' }}>AI Resolution Alerts</span>
                    <span className="profile-pref-desc" style={{ fontSize: '12.5px', color: '#64748B', display: 'block', marginTop: '3px' }}>
                      Receive immediate responses and automated solutions formulated by RAG Autopilot.
                    </span>
                  </div>
                  <label className="profile-toggle">
                    <input 
                      type="checkbox" 
                      checked={notifPreferences.aiAlerts}
                      onChange={() => handleNotifPreferenceChange("aiAlerts")}
                    />
                    <span className="profile-slider" />
                  </label>
                </div>

                <div className="profile-pref-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 0', borderBottom: '1px solid #F1F5F9' }}>
                  <div className="profile-pref-info">
                    <span className="profile-pref-title" style={{ fontSize: '14.5px', fontWeight: '700', color: '#1E293B' }}>Email Notifications</span>
                    <span className="profile-pref-desc" style={{ fontSize: '12.5px', color: '#64748B', display: 'block', marginTop: '3px' }}>
                      Forward all conversation updates and resolution logs directly to your inbox.
                    </span>
                  </div>
                  <label className="profile-toggle">
                    <input 
                      type="checkbox" 
                      checked={notifPreferences.emailNotifications}
                      onChange={() => handleNotifPreferenceChange("emailNotifications")}
                    />
                    <span className="profile-slider" />
                  </label>
                </div>

                <div className="profile-pref-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 0' }}>
                  <div className="profile-pref-info">
                    <span className="profile-pref-title" style={{ fontSize: '14.5px', fontWeight: '700', color: '#1E293B' }}>Security Alerts</span>
                    <span className="profile-pref-desc" style={{ fontSize: '12.5px', color: '#64748B', display: 'block', marginTop: '3px' }}>
                      Get notified of login attempts from unfamiliar devices or modifications to password credentials.
                    </span>
                  </div>
                  <label className="profile-toggle">
                    <input 
                      type="checkbox" 
                      checked={notifPreferences.securityAlerts}
                      onChange={() => handleNotifPreferenceChange("securityAlerts")}
                    />
                    <span className="profile-slider" />
                  </label>
                </div>

              </div>
            </div>
          )}

          {/* TAB 4: PRIVACY TAB */}
          {activeTab === "privacy" && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '28px', maxWidth: '680px' }} className="cd-fade-in">
              
              {/* Backups and Exports Card */}
              <div style={{ background: '#ffffff', borderRadius: '16px', border: '1px solid #E2E8F0', padding: '32px', boxShadow: 'var(--shadow-sm)' }}>
                <h2 style={{ fontSize: '18px', fontWeight: '750', color: '#0F172A', borderBottom: '1px solid #F1F5F9', paddingBottom: '12px', marginBottom: '20px' }}>
                  Privacy & Data Portability
                </h2>
                <p style={{ fontSize: '13.5px', color: '#64748B', marginBottom: '24px', lineHeight: 1.5 }}>
                  Download a copy of your account profile metadata settings, or pull a complete offline JSON database backup of all your created tickets and conversation message logs.
                </p>
                
                <div style={{ display: 'flex', gap: '16px' }}>
                  <button 
                    onClick={handleExportData}
                    style={{
                      background: '#fff', color: '#0F172A', border: '1px solid #CBD5E1', borderRadius: '8px',
                      padding: '12px 20px', fontSize: '13.5px', fontWeight: '700', cursor: 'pointer',
                      transition: 'all 0.15s'
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = '#F8FAFC'; e.currentTarget.style.borderColor = '#94A3B8'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.borderColor = '#CBD5E1'; }}
                  >
                    📥 Export Profile Metadata
                  </button>
                  
                  <button 
                    onClick={handleDownloadTickets}
                    style={{
                      background: '#fff', color: '#0F172A', border: '1px solid #CBD5E1', borderRadius: '8px',
                      padding: '12px 20px', fontSize: '13.5px', fontWeight: '700', cursor: 'pointer',
                      transition: 'all 0.15s'
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = '#F8FAFC'; e.currentTarget.style.borderColor = '#94A3B8'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.borderColor = '#CBD5E1'; }}
                  >
                    📥 Backup Tickets History
                  </button>
                </div>
              </div>

              {/* Danger Zone Account Deletion */}
              <div style={{ background: '#ffffff', borderRadius: '16px', border: '1px solid #FCA5A5', padding: '32px', boxShadow: 'var(--shadow-sm)' }}>
                <h2 style={{ fontSize: '18px', fontWeight: '750', color: '#EF4444', borderBottom: '1px solid #FEE2E2', paddingBottom: '12px', marginBottom: '20px' }}>
                  Danger Zone
                </h2>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '24px', flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: '240px' }}>
                    <div style={{ fontSize: '14.5px', fontWeight: '700', color: '#991B1B' }}>Permanently Delete Account</div>
                    <p style={{ fontSize: '13px', color: '#C2410C', marginTop: '6px', lineHeight: 1.4 }}>
                      Once you delete your account, your profile is permanently removed, active tokens are revoked, and all historical tickets will be archived. This process cannot be undone.
                    </p>
                  </div>
                  <button 
                    onClick={handleDeleteAccount}
                    style={{
                      background: '#EF4444', color: '#ffffff', border: 'none', borderRadius: '8px',
                      padding: '12px 24px', fontSize: '13.5px', fontWeight: '700', cursor: 'pointer',
                      transition: 'background 0.2s', flexShrink: 0
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = '#DC2626'}
                    onMouseLeave={e => e.currentTarget.style.background = '#EF4444'}
                  >
                    Delete Account
                  </button>
                </div>
              </div>

            </div>
          )}

        </div>

      </div>

    </div>
  );
}
