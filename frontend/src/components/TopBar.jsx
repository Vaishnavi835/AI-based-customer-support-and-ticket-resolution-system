import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Bell, Menu } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { notificationsAPI } from '../api/services';
import { useWebSocketEvent } from '../context/WebSocketContext';

const formatTime = (isoString) => {
  if (!isoString) return '';
  const m = Math.floor((Date.now() - new Date(isoString)) / 60_000);
  if (m < 1) return 'Just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
};

export default function TopBar({ title, onToggleSidebar }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [showNotif, setShowNotif] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);

  useEffect(() => {
    if (user) {
      notificationsAPI.list()
        .then((res) => setNotifications(res.data || []))
        .catch((err) => console.error("Failed to load notifications", err));
    }
  }, [user]);

  // Subscribe to real-time notification push events
  useWebSocketEvent("notification", (data) => {
    if (data.notification) {
      setNotifications((prev) => [data.notification, ...prev]);
    }
  });

  const handleMarkAllRead = async () => {
    try {
      await notificationsAPI.markAllRead();
      setNotifications((prev) => prev.map(n => ({ ...n, unread: false })));
    } catch (err) {
      console.error("Failed to mark all notifications as read", err);
    }
  };

  const handleMarkRead = async (notificationId) => {
    try {
      await notificationsAPI.markRead(notificationId);
      setNotifications((prev) =>
        prev.map(n => n.id === notificationId ? { ...n, unread: false } : n)
      );
    } catch (err) {
      console.error("Failed to mark notification as read", err);
    }
  };


  const unreadCount = notifications.filter(n => n.unread).length;

  return (
    <div className="topbar">
      {/* Left: Page Title & Sidebar Toggle */}
      <div className="topbar__left" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <button 
          onClick={onToggleSidebar}
          style={{ 
            background: 'none', border: 'none', cursor: 'pointer', color: '#64748B', 
            display: 'flex', alignItems: 'center', padding: '6px', borderRadius: '6px',
            transition: 'background 0.15s, color 0.15s'
          }}
          onMouseEnter={e => e.currentTarget.style.background = '#F1F5F9'}
          onMouseLeave={e => e.currentTarget.style.background = 'none'}
          title="Toggle sidebar"
        >
          <Menu size={20} />
        </button>
        <h1 className="topbar__title">{title || 'Dashboard'}</h1>
      </div>

      {/* Center: Search */}
      <div className="topbar__search">
        <Search size={16} className="topbar__search-icon" />
        <input
          className="topbar__search-input"
          placeholder="Search..."
        />
        <span className="topbar__search-kbd">⌘K</span>
      </div>

      {/* Right: Actions */}
      <div className="topbar__right">

        {/* Notifications */}
        <div style={{ position: 'relative' }}>
          <button className="topbar__icon-btn" onClick={() => setShowNotif(!showNotif)} title="Notifications">
            <Bell size={18} />
            {unreadCount > 0 && (
              <span className="topbar__badge">{unreadCount}</span>
            )}
          </button>

          {showNotif && (
            <>
              <div style={{ position: 'fixed', inset: 0, zIndex: 98 }} onClick={() => setShowNotif(false)} />
              <div className="topbar__notif-panel">
                <div className="topbar__notif-header">
                  <span>Notifications</span>
                  <span className="topbar__notif-clear" onClick={handleMarkAllRead}>Mark all read</span>
                </div>
                {notifications.length === 0 ? (
                  <div style={{ padding: '16px', textAlign: 'center', color: '#9CA3AF', fontSize: '13px' }}>
                    No notifications
                  </div>
                ) : (
                  notifications.map(n => (
                    <div
                      key={n.id}
                      className={`topbar__notif-item ${n.unread ? 'unread' : ''}`}
                      onClick={() => handleMarkRead(n.id)}
                      style={{ cursor: 'pointer' }}
                    >
                      <div className="topbar__notif-dot" style={{ opacity: n.unread ? 1 : 0 }} />
                      <div>
                        <div className="topbar__notif-text">{n.text}</div>
                        <div className="topbar__notif-time">{formatTime(n.created_at)}</div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </>
          )}
        </div>

        {/* Profile Capsule Menu */}
        <div style={{ position: 'relative' }}>
          <button
            className="topbar__profile-capsule"
            onClick={() => setShowProfileMenu(!showProfileMenu)}
            style={{
              background: '#0F172A',
              border: 'none',
              borderRadius: '100px',
              padding: '4px 12px 4px 4px',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              cursor: 'pointer',
              color: '#ffffff',
              transition: 'background 0.2s',
            }}
            onMouseEnter={e => e.currentTarget.style.background = '#1E293B'}
            onMouseLeave={e => { if(!showProfileMenu) e.currentTarget.style.background = '#0F172A' }}
            title="Profile"
          >
            <div className="topbar__avatar-circle" style={{
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              background: '#FBBF24',
              color: '#0F172A',
              fontWeight: '800',
              fontSize: '14px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              userSelect: 'none'
            }}>
              {user?.name?.[0]?.toUpperCase() || 'U'}
            </div>
            <span style={{ color: 'rgba(255,255,255,0.25)', userSelect: 'none', fontSize: '14px' }}>|</span>
            <span style={{ fontSize: '18px', fontWeight: 'bold', color: '#94A3B8', display: 'flex', alignItems: 'center', userSelect: 'none' }}>⋮</span>
          </button>

          {showProfileMenu && (
            <>
              <div style={{ position: 'fixed', inset: 0, zIndex: 98 }} onClick={() => setShowProfileMenu(false)} />
              <div className="topbar__profile-dropdown" style={{
                position: 'absolute',
                top: 'calc(100% + 8px)',
                right: 0,
                width: '180px',
                background: '#ffffff',
                border: '1px solid #E2E8F0',
                borderRadius: '12px',
                boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -2px rgba(0,0,0,0.05)',
                padding: '8px 0',
                zIndex: 99,
                display: 'flex',
                flexDirection: 'column'
              }}>
                <div style={{ padding: '8px 16px', borderBottom: '1px solid #F1F5F9', marginBottom: '4px' }}>
                  <div style={{ fontSize: '13px', fontWeight: '600', color: '#0F172A' }}>{user?.name}</div>
                  <div style={{ fontSize: '11px', color: '#64748B', textTransform: 'capitalize' }}>{user?.role?.replace('_', ' ')}</div>
                </div>
                <button 
                  onClick={() => { navigate('/profile'); setShowProfileMenu(false); }}
                  style={{
                    background: 'none', border: 'none', textAlign: 'left', padding: '8px 16px',
                    fontSize: '13px', color: '#334155', cursor: 'pointer', width: '100%', fontFamily: 'inherit'
                  }}
                  className="dropdown-menu-item"
                >
                  Manage Profile
                </button>
                <button 
                  onClick={() => { logout(); setShowProfileMenu(false); }}
                  style={{
                    background: 'none', border: 'none', textAlign: 'left', padding: '8px 16px',
                    fontSize: '13px', color: '#EF4444', cursor: 'pointer', width: '100%', fontWeight: '500', fontFamily: 'inherit'
                  }}
                  className="dropdown-menu-item dropdown-menu-item--danger"
                >
                  Sign Out
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
