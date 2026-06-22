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
  const { user } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [showNotif, setShowNotif] = useState(false);

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
          placeholder="Search tickets, users, articles..."
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

        {/* Profile */}
        <button
          className="topbar__profile"
          onClick={() => navigate('/profile')}
          title="Profile"
        >
          <div className="topbar__avatar">
            {user?.name?.[0]?.toUpperCase() || 'U'}
          </div>
          <div className="topbar__profile-info">
            <span className="topbar__profile-name">{user?.name}</span>
            <span className="topbar__profile-role">{user?.role?.replace('_', ' ')}</span>
          </div>
        </button>
      </div>
    </div>
  );
}
