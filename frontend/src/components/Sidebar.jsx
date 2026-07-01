import { useState, useRef, useLayoutEffect } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Ticket, Users, BookOpen, BarChart3,
  Settings, ShieldAlert, PlusCircle,
  Inbox, Tag, Sparkles,
  Activity, HelpCircle, AlertTriangle, MessageSquare,
  TrendingUp, User
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

export default function Sidebar({ collapsed }) {
  const { user, logout } = useAuth();
  const toast = useToast();
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
        { icon: LayoutDashboard, to: '/my-tickets', label: 'Dashboard' },
        { icon: Ticket, to: '/my-tickets/history', label: 'My Tickets' },
        { icon: PlusCircle, to: '/my-tickets/new', label: 'Create Ticket' },
        { icon: Sparkles, to: '/my-tickets/ai-suggestions', label: 'AI Assistant' },
        { icon: Activity, to: '/my-tickets/analytics', label: 'My Activity' },
        { icon: BookOpen, to: '/my-tickets/article/sla-policy', label: 'Help and Support' },
      ]
    : isAgent
    ? [
        { icon: LayoutDashboard, to: '/agent-dashboard', label: 'Dashboard' },
        { icon: Inbox, to: '/agent/my-queue', label: 'My Queue' },
        { icon: Ticket, to: '/tickets', label: 'All Tickets' },

        { icon: Users, to: '/agent/customers', label: 'Customers' },
        { icon: BookOpen, to: '/knowledge-base', label: 'Knowledge Base' },
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
    <div className={`zd-shell ${collapsed ? 'zd-shell--collapsed' : ''} ${isCustomer ? 'customer-sidebar' : ''}`}>
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
          <NavLink to="/profile" className="zd-rail__link" title="Settings">
            <Settings size={20} />
            <span className="zd-rail__label">Settings</span>
          </NavLink>
          <button
            className="zd-rail__avatar"
            onClick={() => setShowUserMenu(!showUserMenu)}
            title={user?.name}
            style={{
              padding: 0,
              overflow: 'hidden',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: user?.avatar ? 'transparent' : undefined
            }}
          >
            {user?.avatar ? (
              <img src={user.avatar} alt={user.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              user?.name?.[0]?.toUpperCase() || 'U'
            )}
          </button>
        </div>
      </div>

      {/* ── User menu popup ─────────────────────────────────── */}
      {showUserMenu && (
        <>
          <div className="zd-user-overlay" onClick={() => setShowUserMenu(false)} />
          <div className="zd-user-menu">
            <div className="zd-user-menu__header">
              <div className="zd-user-menu__avatar" style={{
                overflow: 'hidden',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: user?.avatar ? 'transparent' : undefined
              }}>
                {user?.avatar ? (
                  <img src={user.avatar} alt={user.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  user?.name?.[0]?.toUpperCase()
                )}
              </div>
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
            <button className="zd-user-menu__signout" onClick={() => { logout(); toast.success("Successfully logged out"); setShowUserMenu(false); }}>
              Sign out
            </button>
          </div>
        </>
      )}

      {/* ── Secondary Panel (context nav) ─────────────────── */}
      <div className="zd-panel" ref={panelRef} style={{ position: 'relative' }}>
        {isCustomer ? (
          <div className="zd-panel__brand customer-brand" style={{ display: 'flex', alignItems: 'center', gap: '10px', borderBottom: '1px solid #F1F5F9' }}>
            <div className="customer-logo-mark" style={{
              width: '32px',
              height: '32px',
              background: '#0F172A',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#FBBF24',
              fontWeight: '800',
              fontSize: '18px',
              boxShadow: '0 2px 4px rgba(15, 23, 42, 0.05)'
            }}>S</div>
            <span style={{ color: '#0F172A', fontSize: '18px', fontWeight: '800' }}>SupportAI</span>
          </div>
        ) : (
          <div className="zd-panel__brand" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ color: '#504e51ac', fontSize: '18px' }}>✦</span>
            <span>SupportAI</span>
          </div>
        )}

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
            <div className="zd-panel__section-label">YOUR WORK</div>
            <NavLink to="/my-tickets" end className={({ isActive }) => `zd-panel__link ${isActive ? 'active' : ''}`}>
              <LayoutDashboard size={16} /> Dashboard
            </NavLink>
            <NavLink to="/my-tickets/history" className={({ isActive }) => `zd-panel__link ${isActive && !location.search.includes('range=30') ? 'active' : ''}`}>
              <Ticket size={16} /> My Tickets
            </NavLink>
            <NavLink to="/my-tickets/new" className={({ isActive }) => `zd-panel__link ${isActive ? 'active' : ''}`}>
              <PlusCircle size={16} /> Create Ticket
            </NavLink>
            <NavLink to="/my-tickets/ai-suggestions" className={({ isActive }) => `zd-panel__link ${isActive ? 'active' : ''}`}>
              <Sparkles size={16} /> AI Assistant
            </NavLink>
            <NavLink to="/my-tickets/analytics" className={({ isActive }) => `zd-panel__link ${isActive ? 'active' : ''}`}>
              <Activity size={16} /> My Activity
            </NavLink>

            <div className="zd-panel__section-label" style={{ marginTop: '20px' }}>ACCOUNT & HELP</div>
            <NavLink to="/profile" className={({ isActive }) => `zd-panel__link ${isActive ? 'active' : ''}`}>
              <Settings size={16} /> Settings
            </NavLink>
            <NavLink to="/my-tickets/article/sla-policy" className={({ isActive }) => `zd-panel__link ${isActive ? 'active' : ''}`}>
              <HelpCircle size={16} /> Help and Support
            </NavLink>
          </>
        )}

        {isAgent && (
          <>
            <NavLink to="/agent-dashboard" className={({ isActive }) => `zd-panel__link ${isActive ? 'active' : ''}`}>
              <LayoutDashboard size={16} /> Dashboard
            </NavLink>

            <div className="zd-panel__section-label" style={{ marginTop: '16px' }}>TICKETS</div>
            
            <NavLink to="/agent/my-queue" className={({ isActive }) => `zd-panel__link ${isActive ? 'active' : ''}`}>
              <Inbox size={16} /> My Queue
            </NavLink>

            <NavLink to="/tickets" className={({ isActive }) => `zd-panel__link ${isActive ? 'active' : ''}`}>
              <Ticket size={16} /> All Tickets
            </NavLink>
            

            
            <NavLink to="/escalations" className={({ isActive }) => `zd-panel__link ${isActive ? 'active' : ''}`}>
              <ShieldAlert size={16} /> Escalated Tickets
            </NavLink>

            <div className="zd-panel__section-label" style={{ marginTop: '16px' }}>CUSTOMERS</div>
            <NavLink to="/agent/customers" className={({ isActive }) => `zd-panel__link ${isActive ? 'active' : ''}`}>
              <Users size={16} /> Customers
            </NavLink>
            <NavLink to="/agent/conversations" className={({ isActive }) => `zd-panel__link ${isActive ? 'active' : ''}`}>
              <MessageSquare size={16} /> Conversations
            </NavLink>

            <div className="zd-panel__section-label" style={{ marginTop: '16px' }}>KNOWLEDGE</div>
            <NavLink to="/knowledge-base" className={({ isActive }) => `zd-panel__link ${isActive ? 'active' : ''}`}>
              <BookOpen size={16} /> Knowledge Base
            </NavLink>

            <div className="zd-panel__section-label" style={{ marginTop: '16px' }}>ANALYTICS</div>
            <NavLink to="/reports" className={({ isActive }) => `zd-panel__link ${isActive ? 'active' : ''}`}>
              <BarChart3 size={16} /> Reports & Analytics
            </NavLink>
            <NavLink to="/agent/performance" className={({ isActive }) => `zd-panel__link ${isActive ? 'active' : ''}`}>
              <TrendingUp size={16} /> Performance
            </NavLink>

            <div className="zd-panel__section-label" style={{ marginTop: '16px' }}>ACCOUNT</div>
            <NavLink to="/profile" className={({ isActive }) => `zd-panel__link ${isActive ? 'active' : ''}`}>
              <User size={16} /> Profile
            </NavLink>
            <NavLink to="/profile?tab=security" className={({ isActive }) => `zd-panel__link ${isActive && location.search.includes('tab=security') ? 'active' : ''}`}>
              <Settings size={16} /> Settings
            </NavLink>
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
            <NavLink to="/reports" className={({ isActive }) => `zd-panel__link ${isActive ? 'active' : ''}`}>
              <BarChart3 size={16} /> Reports
            </NavLink>
            <NavLink to="/statistics" className={({ isActive }) => `zd-panel__link ${isActive ? 'active' : ''}`}>
              <Tag size={16} /> Ticket Statistics
            </NavLink>
          </>
        )}
      </div>
      
      <style>{`
        @keyframes pulseGlow {
          0% { transform: scale(0.9); opacity: 0.5; }
          50% { transform: scale(1.1); opacity: 1; }
          100% { transform: scale(0.9); opacity: 0.5; }
        }
        .pulse-dot {
          animation: pulseGlow 1.8s infinite ease-in-out;
        }
      `}</style>
    </div>
  );
}
