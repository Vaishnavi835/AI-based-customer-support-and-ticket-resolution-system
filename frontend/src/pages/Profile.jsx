import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { usersAPI } from "../api/services";

export default function Profile() {
  const { user, updateUser } = useAuth();
  
  const [name, setName] = useState(user?.name || "");
  const [email, setEmail] = useState(user?.email || "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  const [notificationsEnabled, setNotificationsEnabled] = useState(true);

  if (!user) {
    return <div className="cd-page" style={{ padding: '32px' }}><p>Loading profile...</p></div>;
  }

  const handleUpdateProfile = async () => {
    if (!name || !email) return alert("Name and Email required");
    setIsUpdating(true);
    try {
      await usersAPI.updateProfile(name, email);
      updateUser({ name, email });
      alert("Profile updated successfully!");
    } catch (err) {
      alert("Failed to update profile: " + (err.response?.data?.detail || err.message));
    } finally {
      setIsUpdating(false);
    }
  };

  const handleUpdatePassword = async () => {
    if (!currentPassword || !newPassword) return alert("Both current and new passwords required");
    setIsChangingPassword(true);
    try {
      await usersAPI.updatePassword(currentPassword, newPassword);
      setCurrentPassword("");
      setNewPassword("");
      alert("Password updated successfully!");
    } catch (err) {
      alert("Failed to update password: " + (err.response?.data?.detail || err.message));
    } finally {
      setIsChangingPassword(false);
    }
  };

  return (
    <div className="cd-page" style={{ padding: '32px' }}>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '26px', fontWeight: '800', margin: 0 }}>My Profile</h1>
      </div>

      <div style={{ background: '#fff', padding: '24px', borderRadius: '12px', border: '1px solid #E2E8F0', boxShadow: '0 1px 2px rgba(15,23,42,0.04)', maxWidth: '600px', marginBottom: '24px' }}>
        <h2 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '20px' }}>Personal Details</h2>
        <div style={{
          width: '64px', height: '64px', borderRadius: '50%',
          background: '#6366F1', color: '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '24px', fontWeight: '700', marginBottom: '20px'
        }}>
          {user?.name?.[0]?.toUpperCase()}
        </div>
        <div className="cd-field" style={{ marginBottom: '16px' }}>
          <label>Full Name</label>
          <input type="text" value={name} onChange={e => setName(e.target.value)} style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #CBD5E1' }} />
        </div>
        <div className="cd-field" style={{ marginBottom: '16px' }}>
          <label>Email Address</label>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #CBD5E1' }} />
        </div>
        <div className="cd-field" style={{ marginBottom: '16px' }}>
          <label>Account Role</label>
          <div>
            <span style={{ display: 'inline-block', padding: '4px 10px', borderRadius: '6px', background: '#F1F5F9', color: '#475569', fontWeight: '600', fontSize: '13px', textTransform: 'capitalize' }}>
              {user.role}
            </span>
          </div>
        </div>
        <button className="cd-btn cd-btn--primary" onClick={handleUpdateProfile} disabled={isUpdating}>
          {isUpdating ? "Updating..." : "Save Changes"}
        </button>
      </div>

      <div style={{ background: '#fff', padding: '24px', borderRadius: '12px', border: '1px solid #E2E8F0', boxShadow: '0 1px 2px rgba(15,23,42,0.04)', maxWidth: '600px' }}>
        <h2 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '20px' }}>Change Password</h2>
        
        <div className="cd-field" style={{ marginBottom: '16px' }}>
          <label>Current Password</label>
          <input type="password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #CBD5E1' }} />
        </div>
        <div className="cd-field" style={{ marginBottom: '16px' }}>
          <label>New Password</label>
          <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #CBD5E1' }} />
        </div>
        <button className="cd-btn" onClick={handleUpdatePassword} disabled={isChangingPassword} style={{ background: '#0F172A', color: '#fff', padding: '10px 16px', borderRadius: '8px', fontWeight: '600', border: 'none', cursor: 'pointer' }}>
          {isChangingPassword ? "Updating..." : "Update Password"}
        </button>
      </div>
    </div>
  );
}
