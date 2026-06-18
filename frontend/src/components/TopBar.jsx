import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Bell, Sun, Moon, User } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function TopBar({ title }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [darkMode, setDarkMode] = useState(false);
  const [notifications] = useState([
    { id: 1, text: 'Ticket #3311 escalated', time: '2m ago', unread: true },
    { id: 2, text: 'Alice closed Ticket #19', time: '15m ago', unread: true },
    { id: 3, text: 'New ticket from John D.', time: '1h ago', unread: false },
  ]);
  const [showNotif, setShowNotif] = useState(false);
  const unreadCount = notifications.filter(n => n.unread).length;

  return (
    <div className="topbar">
      {/* Left: Page Title */}
      <div className="topbar__left">
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
        {/* Theme toggle */}
        <button className="topbar__icon-btn" onClick={() => setDarkMode(!darkMode)} title="Toggle theme">
          {darkMode ? <Sun size={18} /> : <Moon size={18} />}
        </button>

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
                  <span className="topbar__notif-clear" onClick={() => setShowNotif(false)}>Mark all read</span>
                </div>
                {notifications.map(n => (
                  <div key={n.id} className={`topbar__notif-item ${n.unread ? 'unread' : ''}`}>
                    <div className="topbar__notif-dot" style={{ opacity: n.unread ? 1 : 0 }} />
                    <div>
                      <div className="topbar__notif-text">{n.text}</div>
                      <div className="topbar__notif-time">{n.time}</div>
                    </div>
                  </div>
                ))}
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
