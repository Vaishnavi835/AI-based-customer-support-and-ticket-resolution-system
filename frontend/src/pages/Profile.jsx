import { useState } from "react";
import { useAuth } from "../context/AuthContext";

export default function Profile() {
  const { user } = useAuth();
  
  // Example state for "other options" that the mentor requested
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);

  if (!user) {
    return <div className="page"><p>Loading profile...</p></div>;
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1>My Profile</h1>
      </div>

      <div className="form-card" style={{ maxWidth: '600px' }}>
        <h2>Personal Details</h2>
        <div className="form-group" style={{ marginBottom: '16px' }}>
          <label>Full Name</label>
          <input type="text" value={user.name} disabled />
        </div>
        <div className="form-group" style={{ marginBottom: '16px' }}>
          <label>Email Address</label>
          <input type="email" value={user.email} disabled />
        </div>
        <div className="form-group" style={{ marginBottom: '16px' }}>
          <label>Account Role</label>
          <div>
            <span className={`role-badge role-badge--${user.role}`}>
              {user.role}
            </span>
          </div>
        </div>
      </div>

      <div className="form-card" style={{ maxWidth: '600px', marginTop: '24px' }}>
        <h2>Other Options</h2>
        
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid var(--color-border)' }}>
          <div>
            <div style={{ fontWeight: '600', color: 'var(--color-text)' }}>Email Notifications</div>
            <div style={{ fontSize: '0.85rem', color: 'var(--color-muted)' }}>Receive updates when your tickets change status.</div>
          </div>
          <button 
            className={`btn ${notificationsEnabled ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setNotificationsEnabled(!notificationsEnabled)}
          >
            {notificationsEnabled ? 'Enabled' : 'Disabled'}
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0' }}>
          <div>
            <div style={{ fontWeight: '600', color: 'var(--color-text)' }}>Change Password</div>
            <div style={{ fontSize: '0.85rem', color: 'var(--color-muted)' }}>Update your account password securely.</div>
          </div>
          <button className="btn btn-ghost" onClick={() => alert("Password reset functionality to be implemented.")}>
            Update
          </button>
        </div>
      </div>
    </div>
  );
}
