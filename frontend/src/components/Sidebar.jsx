import { useState, useRef, useLayoutEffect } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Ticket, Users, BookOpen, BarChart3,
  Settings, ShieldAlert, PlusCircle,
  Home, Inbox, Clock, CheckCircle, Tag, AtSign
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function Sidebar({ collapsed }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const panelRef = useRef(null);
  const [indicatorStyle, setIndicatorStyle] = useState({ top: 0, height: 0, opacity: 0 });

  useLayoutEffect(() => {
    if (panelRef.current) {
      const activeEl = panelRef.current.querySelector('.zd-panel__link.active');
      if (activeEl) {
        setIndicatorStyle({
          top: activeEl.offsetTop,
          height: activeEl.offsetHeight,
          opacity: 1
        });
      } else {
        setIndicatorStyle(prev => ({ ...prev, opacity: 0 }));
      }
    }
  }, [location.pathname, user?.role]);

  const isAgent = user?.role === 'support_agent';
  const isAdmin = user?.role === 'admin';
  const isCustomer = user?.role === 'customer';

  // Icon rail items differ per role
  const railItems = isCustomer
    ? [
        { icon: Home, to: '/my-tickets', label: 'Home' },
        { icon: PlusCircle, to: '/my-tickets/new', label: 'New Ticket' },
        { icon: Clock, to: '/my-tickets/history', label: 'History' },
      ]
    : isAgent
    ? [
        { icon: Inbox, to: '/agent-dashboard', label: 'Inbox' },
        { icon: Ticket, to: '/tickets', label: 'Tickets' },
        { icon: ShieldAlert, to: '/escalations', label: 'Escalations' },
        { icon: BarChart3, to: '/reports', label: 'Reports' },
      ]
    : [
        { icon: LayoutDashboard, to: '/dashboard', label: 'Dashboard' },
        { icon: Ticket, to: '/tickets', label: 'Tickets' },
        { icon: Users, to: '/users', label: 'Users' },
        { icon: BookOpen, to: '/knowledge-base', label: 'Knowledge Base' },
        { icon: BarChart3, to: '/reports', label: 'Reports' },
      ];

  return (
    <div className={`zd-shell ${collapsed ? 'zd-shell--collapsed' : ''}`}>
      {/* ── Icon Rail ─────────────────────────────────────── */}
      <div className="zd-rail">
        {/* Logo */}
        <div className="zd-rail__logo">
          <div className="zd-logo-mark" style={{ background: 'linear-gradient(135deg, #C4683D, #E8A87C)', color: '#fff', fontSize: '20px' }}>✦</div>
        </div>

        {/* Nav icons */}
        <nav className="zd-rail__nav">
          {railItems.map(({ icon: Icon, to, label }) => (
            <NavLink key={to} to={to} className={({ isActive }) => `zd-rail__link ${isActive ? 'active' : ''}`} title={label}>
              <Icon size={20} />
              <span className="zd-rail__label">{label}</span>
            </NavLink>
          ))}
        </nav>

        {/* Bottom: settings + avatar */}
        <div className="zd-rail__bottom">
          <NavLink to="/settings" className="zd-rail__link" title="Settings">
            <Settings size={20} />
            <span className="zd-rail__label">Settings</span>
          </NavLink>
          <button
            className="zd-rail__avatar"
            onClick={() => setShowUserMenu(!showUserMenu)}
            title={user?.name}
          >
            {user?.name?.[0]?.toUpperCase() || 'U'}
          </button>
        </div>
      </div>

      {/* ── User menu popup ─────────────────────────────────── */}
      {showUserMenu && (
        <>
          <div className="zd-user-overlay" onClick={() => setShowUserMenu(false)} />
          <div className="zd-user-menu">
            <div className="zd-user-menu__header">
              <div className="zd-user-menu__avatar">{user?.name?.[0]?.toUpperCase()}</div>
              <div>
                <div className="zd-user-menu__name">{user?.name}</div>
                <div className="zd-user-menu__role">{user?.role?.replace('_', ' ')}</div>
              </div>
            </div>
            <div className="zd-user-menu__divider" />
            <div className="zd-user-menu__status-list">
              <div className="zd-status-item"><span className="zd-dot zd-dot--green" /> Online</div>
              <div className="zd-status-item"><span className="zd-dot zd-dot--yellow" /> Away</div>
              <div className="zd-status-item"><span className="zd-dot zd-dot--gray" /> Offline</div>
            </div>
            <div className="zd-user-menu__divider" />
            <button className="zd-user-menu__item" onClick={() => { navigate('/profile'); setShowUserMenu(false); }}>Manage profile</button>
            <div className="zd-user-menu__divider" />
            <button className="zd-user-menu__signout" onClick={() => { logout(); setShowUserMenu(false); }}>
              Sign out
            </button>
          </div>
        </>
      )}

      {/* ── Secondary Panel (context nav) ─────────────────── */}
      <div className="zd-panel" ref={panelRef} style={{ position: 'relative' }}>
        <div className="zd-panel__brand" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ color: '#504e51ac', fontSize: '18px' }}>✦</span>
          <span>SupportAI</span>
        </div>

        {/* Sliding active background indicator */}
        <div className="zd-panel__indicator" style={{
          position: 'absolute',
          left: 0,
          right: 0,
          height: `${indicatorStyle.height}px`,
          top: `${indicatorStyle.top}px`,
          background: 'rgba(67, 67, 75, 0.12)',
          borderLeft: '3px solid #1e1921',
          transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
          pointerEvents: 'none',
          opacity: indicatorStyle.opacity,
          zIndex: 0
        }} />

        {isCustomer && (
          <>
            <div className="zd-panel__section-label">Your work</div>
            <NavLink to="/my-tickets" end className={({ isActive }) => `zd-panel__link ${isActive ? 'active' : ''}`}>
              <Ticket size={16} /> Tickets
            </NavLink>
            <NavLink to="/my-tickets/new" className={({ isActive }) => `zd-panel__link ${isActive ? 'active' : ''}`}>
              <PlusCircle size={16} /> New Ticket
            </NavLink>

            <div className="zd-panel__section-label" style={{ marginTop: '20px' }}>Completed work</div>
            <NavLink to="/my-tickets/history" className={({ isActive }) => `zd-panel__link ${isActive ? 'active' : ''}`}>
              <Clock size={16} /> Last 30 days
            </NavLink>
          </>
        )}

        {isAgent && (
          <>
            <div className="zd-panel__section-label">Your work</div>
            <NavLink to="/agent-dashboard" className={({ isActive }) => `zd-panel__link ${isActive ? 'active' : ''}`}>
              <Inbox size={16} /> Dashboard
            </NavLink>
            <NavLink to="/tickets" className={({ isActive }) => `zd-panel__link ${isActive ? 'active' : ''}`}>
              <Ticket size={16} /> All Tickets
            </NavLink>

            <div className="zd-panel__section-label" style={{ marginTop: '20px' }}>Shared work</div>
            <NavLink to="/escalations" className={({ isActive }) => `zd-panel__link ${isActive ? 'active' : ''}`}>
              <ShieldAlert size={16} /> Escalations
            </NavLink>
            <div className="zd-panel__link muted"><AtSign size={16} /> CC'd</div>

            <div className="zd-panel__section-label" style={{ marginTop: '20px' }}>Completed work</div>
            <div className="zd-panel__link muted"><CheckCircle size={16} /> Last 30 days</div>
          </>
        )}

        {isAdmin && (
          <>
            <div className="zd-panel__section-label">Overview</div>
            <NavLink to="/dashboard" className={({ isActive }) => `zd-panel__link ${isActive ? 'active' : ''}`}>
              <LayoutDashboard size={16} /> Dashboard
            </NavLink>
            <NavLink to="/tickets" className={({ isActive }) => `zd-panel__link ${isActive ? 'active' : ''}`}>
              <Ticket size={16} /> All Tickets
            </NavLink>
            <NavLink to="/escalations" className={({ isActive }) => `zd-panel__link ${isActive ? 'active' : ''}`}>
              <ShieldAlert size={16} /> Escalations
            </NavLink>

            <div className="zd-panel__section-label" style={{ marginTop: '20px' }}>Management</div>
            <NavLink to="/users" className={({ isActive }) => `zd-panel__link ${isActive ? 'active' : ''}`}>
              <Users size={16} /> Users
            </NavLink>
            <NavLink to="/knowledge-base" className={({ isActive }) => `zd-panel__link ${isActive ? 'active' : ''}`}>
              <BookOpen size={16} /> Knowledge Base
            </NavLink>

            <div className="zd-panel__section-label" style={{ marginTop: '20px' }}>Analytics</div>
            <div className="zd-panel__link muted"><BarChart3 size={16} /> Reports</div>
            <div className="zd-panel__link muted"><Tag size={16} /> Ticket Statistics</div>
          </>
        )}
      </div>
    </div>
  );
}
