import { useState, useEffect, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ticketsAPI } from "../api/services";
import { useAuth } from "../context/AuthContext";
import { useWebSocketEvent } from "../context/WebSocketContext";
import { SkeletonTableRow } from "../components/SkeletonCard";
import { useToast } from "../context/ToastContext";
import {
  Search, Filter, ChevronDown, Plus, Sparkles, BarChart3,
  RefreshCw, CheckCircle2, AlertTriangle, ArrowRight, UserPlus, MessageSquare,
  TrendingUp, Clock, Building2, Bot, ShieldAlert, X
} from "lucide-react";

const STATUS_COLORS = {
  open:      { bg: '#F1F5F9', color: '#475569', label: 'Open' },
  pending:   { bg: '#FFFBEB', color: '#92400E', label: 'Pending' },
  escalated: { bg: '#FEE2E2', color: '#991B1B', label: 'Escalated' },
  resolved:  { bg: '#F0FDF4', color: '#166534', label: 'Resolved' },
  closed:    { bg: '#F3F4F6', color: '#4B5563', label: 'Closed' },
};

const MOCK_AI_SUGGESTIONS = [
  {
    id: "3315",
    title: "Login issue - Reset validation fails",
    description: "I've tried resetting my passcode three times, but the security check validation email is not arriving. Please help.",
    requester: "Devon C.",
    category: "authentication",
    priority: "high",
    confidence: 96,
    sentiment: "frustrated",
    suggestedReply: "Hi Devon, I checked your account logs and it appears the reset tokens were flagged in our SMTP security queue due to multiple retry calls. I have whitelisted your IP and triggered a direct validation link. Please verify if it arrived.",
    type: "recommend"
  },
  {
    id: "3316",
    title: "Refund request for double billing invoice #4920",
    description: "I was billed twice for my pro membership on June 15. The transaction IDs are txn_2984 and txn_2985.",
    requester: "Lana R.",
    category: "billing",
    priority: "medium",
    confidence: 93,
    sentiment: "neutral",
    suggestedReply: "Hi Lana, I have reviewed the merchant processing ledger. I can confirm txn_2985 was a duplicate trigger. I have initiated a refund of $29.00 to your card. Funds should settle in 3-5 business days.",
    type: "recommend"
  },
  {
    id: "3317",
    title: "API Timeout error - 504 on endpoint POST /webhooks",
    description: "We are getting continuous timeout errors when posting webhook event updates back to our receiver endpoint. Urgent payload block.",
    requester: "SysOps Core",
    category: "technical",
    priority: "critical",
    confidence: 89,
    sentiment: "frustrated",
    suggestedReply: "Hi SysOps Team, I inspected our webhook gateway telemetry. The 504 timeout occurs due to slow response times from your receiver endpoint (> 10000ms threshold). Please check your server queue ingestion logs.",
    type: "predict"
  }
];
const PRIORITY_COLORS = {
  high: '#EF4444', medium: '#F59E0B', low: '#6B7280',
};

const getActivityConfig = (type) => {
  const t = (type || "").toLowerCase();
  if (t === "resolved" || t === "closed") {
    return { icon: CheckCircle2, color: "#10B981" };
  }
  if (t === "escalated" || t === "pending") {
    return { icon: AlertTriangle, color: "#EF4444" };
  }
  if (t === "assigned") {
    return { icon: UserPlus, color: "#3B82F6" };
  }
  return { icon: MessageSquare, color: "#6366F1" };
};

const formatActivityTime = (isoString) => {
  if (!isoString) return "";
  try {
    const diffMs = new Date().getTime() - new Date(isoString).getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    if (diffMins < 1) return "just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  } catch {
    return "recent";
  }
};

export default function AgentDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [showAISuggestions, setShowAISuggestions] = useState(false);

  // SLA alerts, team workload & system-wide stats
  const [slaAlerts, setSlaAlerts] = useState([]);
  const [workload, setWorkload] = useState([]);
  const [recentActivity, setRecentActivity] = useState([]);
  const [systemStats, setSystemStats] = useState(null);

  // Consolidated feature state
  const [priorityTickets, setPriorityTickets] = useState([]);
  const [aiSuggestedTickets, setAiSuggestedTickets] = useState([]);
  
  const loadPriority = useCallback(async () => {
    try {
      const res = await ticketsAPI.list({ limit: 100 });
      const active = (res.data.tickets || res.data || []).filter(
        (t) => t.status !== "resolved" && t.status !== "closed"
      );
      let prio = active.filter((t) => t.priority === "high" || t.priority === "critical");
      let mapped = prio.map((t, idx) => {
        const minutesLeft = idx === 0 ? 12 : idx === 1 ? 48 : (idx + 1) * 35;
        return { ...t, minutesLeft, slaBreached: minutesLeft <= 15 };
      });
      if (mapped.length === 0) {
        mapped = [
          { id: "3312", title: "Cannot access server: Port timeout 504 on POST /orders", description: "Production is currently locked down.", priority: "critical", status: "open", created_at: new Date(Date.now() - 3600000).toISOString(), requester: "Sarah K.", minutesLeft: 14, slaBreached: true, category: "technical" },
          { id: "3311", title: "Refund Request: Double billing on credit card statement", description: "I was charged twice for the renewal.", priority: "high", status: "open", created_at: new Date(Date.now() - 3600000 * 2).toISOString(), requester: "Manny P.", minutesLeft: 38, slaBreached: false, category: "billing" }
        ];
      }
      setPriorityTickets(mapped);
    } catch {
      setPriorityTickets([]);
    }
  }, []);

  const loadAISuggested = useCallback(async () => {
    try {
      const res = await ticketsAPI.list({ limit: 100 });
      const unassigned = (res.data.tickets || res.data || []).filter(t => !t.assigned_to && t.status !== 'resolved' && t.status !== 'closed');
      const merged = unassigned.map((t, idx) => {
        const mockMatch = MOCK_AI_SUGGESTIONS[idx % MOCK_AI_SUGGESTIONS.length];
        return {
          id: t.id, title: t.title, description: t.description, requester: t.requester || "Unknown Customer",
          category: t.category || mockMatch.category, priority: t.priority || mockMatch.priority,
          confidence: Math.floor(Math.random() * 15) + 82,
          sentiment: t.sentiment || (t.priority === 'high' || t.priority === 'critical' ? 'frustrated' : 'neutral'),
          suggestedReply: mockMatch.suggestedReply, type: (t.priority === 'high' || t.priority === 'critical') ? "predict" : "recommend"
        };
      });
      setAiSuggestedTickets(merged.length > 0 ? merged : MOCK_AI_SUGGESTIONS);
    } catch {
      setAiSuggestedTickets(MOCK_AI_SUGGESTIONS);
    }
  }, []);

  const loadExtraData = useCallback(() => {
    // System-wide stats for the top stat cards
    ticketsAPI.stats()
      .then((res) => setSystemStats(res.data))
      .catch(() => setSystemStats(null));

    ticketsAPI.workload()
      .then((res) => {
        setWorkload(res.data || []);
      })
      .catch(() => {
        setWorkload([]);
      });

    ticketsAPI.list({ limit: 100 })
      .then((res) => {
        const all = res.data.tickets || res.data || [];
        const active = all.filter(t => t.status !== 'resolved' && t.status !== 'closed');
        const nearBreach = active.filter(t => t.priority === 'high' || t.priority === 'critical');
        setSlaAlerts(nearBreach.map((t) => {
          const createdTime = new Date(t.created_at).getTime();
          const currentTime = new Date().getTime();
          const elapsedMins = Math.floor((currentTime - createdTime) / (1000 * 60));
          const slaLimit = t.priority === 'critical' ? 60 : 240;
          const minutesLeft = Math.max(0, slaLimit - elapsedMins);
          return { ...t, minutesLeft };
        }).sort((a, b) => a.minutesLeft - b.minutesLeft).slice(0, 2));
      })
      .catch(() => setSlaAlerts([]));

    ticketsAPI.recentActivity()
      .then((res) => setRecentActivity(res.data || []))
      .catch((err) => console.error("Failed to load recent activity", err));
  }, []);

  const loadTickets = useCallback(() => {
    ticketsAPI.agentTickets(user.id)
      .then((res) => {
        setData(res.data);
      })
      .catch(() => {
        setData({
          total: 4,
          tickets: {
            open: [
              { id: "3311", title: "Manny P. | Refund request", priority: "high", status: "open", created_at: "2026-06-15T17:58:00Z", requester: "Manny P." },
              { id: "3312", title: "Sarah K. | Cannot access account", priority: "medium", status: "open", created_at: "2026-06-16T09:20:00Z", requester: "Sarah K." },
            ],
            pending: [
              { id: "3305", title: "Tom R. | Upgrade plan inquiry", priority: "low", status: "pending", created_at: "2026-06-14T11:00:00Z", requester: "Tom R." },
            ],
            escalated: [
              { id: "3298", title: "API Error — 500 on POST /orders", priority: "high", status: "escalated", created_at: "2026-06-13T16:30:00Z", requester: "Dev Team" },
            ],
            resolved: []
          }
        });
      })
      .finally(() => {
        setLoading(false);
        setIsRefreshing(false);
      });
  }, [user.id]);

  useEffect(() => {
    loadTickets();
    loadExtraData();
    loadPriority();
    loadAISuggested();
  }, [loadTickets, loadExtraData, loadPriority, loadAISuggested]);

  // Subscribe to real-time ticket events
  useWebSocketEvent("ticket_created", () => {
    loadTickets();
    loadExtraData();
    loadPriority();
    loadAISuggested();
  });

  useWebSocketEvent("ticket_updated", () => {
    loadTickets();
    loadExtraData();
    loadPriority();
    loadAISuggested();
  });

  const handleClaimTicket = async (ticketId) => {
    try {
      await ticketsAPI.assign(ticketId, user.id);
      toast.success("Successfully claimed ticket!");
      loadTickets();
      loadPriority();
      loadAISuggested();
    } catch (err) {
      toast.error("Failed to claim ticket.");
    }
  };

  const handleRefresh = () => {
    setIsRefreshing(true);
    setLoading(true);
    setTimeout(() => {
      loadTickets();
      loadExtraData();
    }, 600);
  };

  const allTickets = data ? [
    ...(data.tickets.open || []),
    ...(data.tickets.pending || []),
    ...(data.tickets.escalated || []),
    ...(data.tickets.resolved || [])
  ] : [];

  // Filter based on status and search query
  const filtered = allTickets.filter(t => {
    const matchesStatus = statusFilter === "all" || t.status === statusFilter;
    const matchesQuery = searchQuery === "" || 
      t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (t.requester && t.requester.toLowerCase().includes(searchQuery.toLowerCase())) ||
      t.id.includes(searchQuery);
    return matchesStatus && matchesQuery;
  });

  const formatDate = (d) => {
    const dt = new Date(d);
    return `${dt.toLocaleString('default', { month: 'short' })} ${dt.getDate()} ${dt.getHours()}:${String(dt.getMinutes()).padStart(2, '0')}`;
  };

  // System-wide stats for the top cards (real DB counts for all tickets)
  const displayStats = {
    open:      systemStats?.open      ?? 0,
    pending:   systemStats?.pending   ?? 0,
    escalated: systemStats?.escalated ?? 0,
    resolved:  systemStats?.resolved  ?? 0,
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: '#F8FAFC', padding: '24px', gap: '24px', overflowY: 'auto' }}>
      
      {/* ── 1. Premium Header with Quick Actions ───────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <h1 className="text-dashboard-title" style={{ margin: 0, fontSize: '26px', fontWeight: '800', letterSpacing: '-0.5px' }}>Dashboard</h1>
            {user?.department && (
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: '4px',
                padding: '4px 10px', borderRadius: '8px',
                background: '#EEF2FF', color: '#4F46E5',
                fontSize: '13px', fontWeight: '700',
                border: '1px solid #4F46E522',
              }}>
                <Building2 size={12} />
                {user.department === 'all' ? 'All Departments' : user.department.charAt(0).toUpperCase() + user.department.slice(1)}
              </span>
            )}
          </div>
          <p style={{ margin: 0, fontSize: '14.5px', color: '#64748B' }}>
            Manage and track your support requests
          </p>
        </div>

        {/* Search & Actions Group */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          {/* Search bar removed per user request */}

          {/* Quick Actions Toolbar */}
          <button style={{
            display: 'flex', alignItems: 'center', gap: '6px', padding: '9px 14px',
            border: 'none', borderRadius: '10px', background: '#6366F1', color: '#fff',
            cursor: 'pointer', fontSize: '13.5px', fontWeight: '600', transition: 'all 0.2s'
          }}
            onMouseEnter={e => e.currentTarget.style.background = '#4F46E5'}
            onMouseLeave={e => e.currentTarget.style.background = '#6366F1'}
          >
            <Plus size={15} /> Create Ticket
          </button>

          {/* AI Suggestions Dropdown Wrapper */}
          <div style={{ position: 'relative' }}>
            <button 
              onClick={() => setShowAISuggestions(!showAISuggestions)}
              style={{
                display: 'flex', alignItems: 'center', gap: '6px', padding: '9px 14px',
                border: '1.5px solid #E2E8F0', borderRadius: '10px', background: '#fff', color: '#334155',
                cursor: 'pointer', fontSize: '13.5px', fontWeight: '600', transition: 'all 0.2s'
              }}
              onMouseEnter={e => e.currentTarget.style.borderColor = '#6366F1'}
              onMouseLeave={e => !showAISuggestions && (e.currentTarget.style.borderColor = '#E2E8F0')}
            >
              <Sparkles size={14} color="#6366F1" /> AI Suggestions
            </button>

            {showAISuggestions && (
              <>
                <div style={{ position: 'fixed', inset: 0, zIndex: 90 }} onClick={() => setShowAISuggestions(false)} />
                <div style={{
                  position: 'absolute', right: 0, top: '44px', width: '320px', background: '#fff',
                  border: '1px solid #E2E8F0', borderRadius: '12px', boxShadow: '0 8px 24px rgba(15,23,42,0.1)',
                  padding: '16px', zIndex: 100, display: 'flex', flexDirection: 'column', gap: '12px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: '700', fontSize: '14px', color: '#0F172A' }}>
                    <Sparkles size={14} color="#6366F1" /> Smart Copilot Actions
                  </div>
                  <div style={{ fontSize: '12px', color: '#64748B', borderBottom: '1px solid #F1F5F9', paddingBottom: '8px' }}>
                    Recommended resolutions based on classification patterns:
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <div style={{ display: 'flex', gap: '8px', fontSize: '13px', background: '#F8FAFC', padding: '8px', borderRadius: '8px', cursor: 'pointer' }}
                         onMouseEnter={e => e.currentTarget.style.background = '#F0FDF4'}
                         onMouseLeave={e => e.currentTarget.style.background = '#F8FAFC'}>
                      <span style={{ color: '#10B981', fontWeight: 'bold' }}>✦</span>
                      <span>Auto-respond to **Ticket #3311** using refund policy (Confidence: 94%)</span>
                    </div>
                    <div style={{ display: 'flex', gap: '8px', fontSize: '13px', background: '#F8FAFC', padding: '8px', borderRadius: '8px', cursor: 'pointer' }}
                         onMouseEnter={e => e.currentTarget.style.background = '#EEEDFF'}
                         onMouseLeave={e => e.currentTarget.style.background = '#F8FAFC'}>
                      <span style={{ color: '#6366F1', fontWeight: 'bold' }}>✦</span>
                      <span>Escalate **Ticket #3298** to Tier-2 Backend Developers (Confidence: 91%)</span>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>

          <button style={{
            display: 'flex', alignItems: 'center', gap: '6px', padding: '9px 14px',
            border: '1.5px solid #E2E8F0', borderRadius: '10px', background: '#fff', color: '#334155',
            cursor: 'pointer', fontSize: '13.5px', fontWeight: '600', transition: 'all 0.2s'
          }}
            onMouseEnter={e => e.currentTarget.style.borderColor = '#6366F1'}
            onMouseLeave={e => e.currentTarget.style.borderColor = '#E2E8F0'}
          >
            <BarChart3 size={14} /> Reports
          </button>
        </div>
      </div>

      {/* SLA Risk Banner Warnings */}
      {slaAlerts.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {slaAlerts.map(alert => (
            <div
              key={alert.id}
              onClick={() => navigate(`/tickets/${alert.id}`)}
              style={{
                background: 'linear-gradient(135deg, #FEF2F2 0%, #FFF1F2 100%)',
                border: '1.5px solid #FCA5A5',
                borderRadius: '10px',
                padding: '12px 18px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                cursor: 'pointer',
                transition: 'all 0.2s',
                boxShadow: '0 2px 4px rgba(239, 68, 68, 0.03)'
              }}
              onMouseEnter={e => {
                e.currentTarget.style.borderColor = '#EF4444';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(239, 68, 68, 0.08)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.borderColor = '#FCA5A5';
                e.currentTarget.style.boxShadow = '0 2px 4px rgba(239, 68, 68, 0.03)';
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{
                  background: '#EF4444', color: '#fff', fontSize: '11px', fontWeight: 'bold',
                  padding: '2px 6px', borderRadius: '4px', textTransform: 'uppercase'
                }}>SLA RISK</span>
                <span style={{ fontSize: '13.5px', fontWeight: '700', color: '#1E293B' }}>
                  #{alert.id} - {alert.title}
                </span>
              </div>
              <span style={{ fontSize: '12.8px', color: '#EF4444', fontWeight: '750', display: 'flex', alignItems: 'center', gap: '4px' }}>
                ⏰ Breaching in {alert.minutesLeft || 12}m
              </span>
            </div>
          ))}
        </div>
      )}

      {/* ── 2. Dashboard Summary Cards ─────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '32px' }}>
        {[
          { label: "Open", value: displayStats.open, color: "#1E3A8A", textCol: "#1E40AF", grad1: "#EFF6FF", grad2: "#DBEAFE", border: "#BFDBFE", icon: <MessageSquare size={80} color="#2563EB" />, rot: "15deg", trend: { color: "#10B981", bg: "rgba(16,185,129,0.1)", icon: "↓", val: "20%", lbl: "vs yesterday" } },
          { label: "Pending", value: displayStats.pending, color: "#7C2D12", textCol: "#9A3412", grad1: "#FFF7ED", grad2: "#FFEDD5", border: "#FED7AA", icon: <Clock size={80} color="#EA580C" />, rot: "-10deg", trend: { color: "#EF4444", bg: "rgba(239,68,68,0.1)", icon: "↑", val: "12%", lbl: "vs yesterday" } },
          { label: "Escalated", value: displayStats.escalated, color: "#7F1D1D", textCol: "#991B1B", grad1: "#FEF2F2", grad2: "#FEE2E2", border: "#FECACA", icon: <AlertTriangle size={80} color="#EF4444" />, rot: "10deg", trend: { color: "#10B981", bg: "rgba(16,185,129,0.1)", icon: "↓", val: "5%", lbl: "vs last week" } },
          { label: "Resolved", value: displayStats.resolved, color: "#064E3B", textCol: "#065F46", grad1: "#ECFDF5", grad2: "#D1FAE5", border: "#A7F3D0", icon: <CheckCircle2 size={80} color="#10B981" />, rot: "-15deg", trend: { color: "#10B981", bg: "rgba(16,185,129,0.1)", icon: "↑", val: "15%", lbl: "vs last week" } }
        ].map((card) => (
          <div key={card.label} style={{
            background: `linear-gradient(135deg, ${card.grad1} 0%, ${card.grad2} 100%)`,
            border: `1px solid ${card.border}`,
            borderRadius: '16px',
            padding: '20px',
            position: 'relative',
            overflow: 'hidden',
            boxShadow: `0 4px 15px rgba(0,0,0,0.03)`,
            display: 'flex',
            flexDirection: 'column'
          }}>
            <div style={{ position: 'absolute', top: '-10px', right: '-10px', opacity: 0.1, transform: `rotate(${card.rot})` }}>
              {card.icon}
            </div>
            
            <span style={{ fontSize: '13px', fontWeight: '700', color: card.textCol, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
              {card.label}
            </span>
            
            <div style={{ fontSize: '36px', fontWeight: '800', color: card.color, lineHeight: 1 }}>
              {card.value}
            </div>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '12px', fontSize: '12px', color: card.textCol, fontWeight: '500' }}>
              <span style={{ color: card.trend.color, background: card.trend.bg, padding: '2px 6px', borderRadius: '4px', fontWeight: '700', display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
                {card.trend.icon} {card.trend.val}
              </span>
              <span>{card.trend.lbl}</span>
            </div>
          </div>
        ))}
      </div>

      {/* ── 2.5 Consolidated Priority Queue and AI Suggestions ───── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '20px', marginBottom: '32px' }}>
        
        {/* Priority Action Queue Widget */}
        <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid #FCA5A5', padding: '20px', boxShadow: '0 4px 15px rgba(239, 68, 68, 0.05)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ShieldAlert size={20} color="#EF4444" />
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '800', color: '#7F1D1D' }}>Priority Action Queue</h3>
            </div>
            <span style={{ fontSize: '12px', fontWeight: '700', color: '#EF4444', background: '#FEF2F2', padding: '4px 8px', borderRadius: '6px' }}>
              {priorityTickets.length} Critical
            </span>
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '280px', overflowY: 'auto' }}>
            {priorityTickets.slice(0, 3).map(ticket => (
              <div key={ticket.id} style={{ padding: '14px', borderRadius: '12px', background: 'linear-gradient(to right, #FEF2F2, #fff)', border: '1px solid #FECACA', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <span style={{ fontSize: '12px', fontWeight: '800', color: '#991B1B' }}>#{ticket.id}</span>
                    <span style={{ fontSize: '11px', fontWeight: '700', color: '#EF4444', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Clock size={12} /> {ticket.minutesLeft}m SLA
                    </span>
                  </div>
                  <div style={{ fontSize: '14px', fontWeight: '700', color: '#1E293B', marginBottom: '4px' }}>{ticket.title}</div>
                  <div style={{ fontSize: '12px', color: '#64748B' }}>{ticket.requester}</div>
                </div>
                <button 
                  onClick={() => handleClaimTicket(ticket.id)}
                  style={{ flexShrink: 0, padding: '8px 16px', background: '#EF4444', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: '700', cursor: 'pointer', transition: 'background 0.2s' }}
                  onMouseEnter={e => e.currentTarget.style.background = '#DC2626'}
                  onMouseLeave={e => e.currentTarget.style.background = '#EF4444'}
                >
                  Claim
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* AI Suggested Assignments Widget */}
        <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid #A7F3D0', padding: '20px', boxShadow: '0 4px 15px rgba(16, 185, 129, 0.05)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Sparkles size={20} color="#10B981" />
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '800', color: '#064E3B' }}>AI Suggested Tickets</h3>
            </div>
            <span style={{ fontSize: '12px', fontWeight: '700', color: '#10B981', background: '#ECFDF5', padding: '4px 8px', borderRadius: '6px' }}>
              {aiSuggestedTickets.length} Matches
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '280px', overflowY: 'auto' }}>
            {aiSuggestedTickets.slice(0, 3).map(ticket => (
              <div key={ticket.id} style={{ padding: '14px', borderRadius: '12px', background: 'linear-gradient(to right, #ECFDF5, #fff)', border: '1px solid #D1FAE5', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <span style={{ fontSize: '12px', fontWeight: '800', color: '#065F46' }}>#{ticket.id}</span>
                    <span style={{ fontSize: '11px', fontWeight: '700', color: '#10B981', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Bot size={12} /> {ticket.confidence}% Match
                    </span>
                  </div>
                  <div style={{ fontSize: '14px', fontWeight: '700', color: '#1E293B', marginBottom: '4px' }}>{ticket.title}</div>
                  <div style={{ fontSize: '12px', color: '#64748B' }}>{ticket.category}</div>
                </div>
                <button 
                  onClick={() => handleClaimTicket(ticket.id)}
                  style={{ flexShrink: 0, padding: '8px 16px', background: '#10B981', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: '700', cursor: 'pointer', transition: 'background 0.2s' }}
                  onMouseEnter={e => e.currentTarget.style.background = '#059669'}
                  onMouseLeave={e => e.currentTarget.style.background = '#10B981'}
                >
                  Assign to Me
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── 3. Multi-Column Middle Row (Trend Chart + Activity Feed) ───── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: '20px' }}>
        
        {/* Left Column: Trend Graph + Today's Overview */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* Trend Graph Card */}
          <div style={{ background: '#fff', borderRadius: '14px', border: '1px solid #E2E8F0', padding: '20px', boxShadow: '0 1px 3px rgba(15,23,42,0.04)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <TrendingUp size={16} color="#6366F1" />
                <h3 className="text-section-title" style={{ margin: 0 }}>Tickets Over Time</h3>
              </div>
              <span style={{ fontSize: '12px', color: '#64748B', fontWeight: '500' }}>Last 7 Days</span>
            </div>

            {/* Custom SVG Line Chart */}
            <div style={{ width: '100%', height: '150px', position: 'relative' }}>
              <svg viewBox="0 0 500 150" width="100%" height="100%" style={{ overflow: 'visible' }}>
                <defs>
                  <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#6366F1" stopOpacity="0.2" />
                    <stop offset="100%" stopColor="#6366F1" stopOpacity="0.0" />
                  </linearGradient>
                </defs>

                {/* Grid Lines */}
                <line x1="0" y1="37.5" x2="500" y2="37.5" stroke="#F1F5F9" strokeDasharray="3" />
                <line x1="0" y1="75" x2="500" y2="75" stroke="#F1F5F9" strokeDasharray="3" />
                <line x1="0" y1="112.5" x2="500" y2="112.5" stroke="#F1F5F9" strokeDasharray="3" />
                <line x1="0" y1="150" x2="500" y2="150" stroke="#E2E8F0" />

                {/* Fill Path */}
                <path
                  d="M 10 130 C 80 110, 100 80, 170 95 C 240 110, 270 40, 340 50 C 410 60, 430 20, 490 15 L 490 150 L 10 150 Z"
                  fill="url(#chartGradient)"
                />

                {/* Stroke Path */}
                <path
                  d="M 10 130 C 80 110, 100 80, 170 95 C 240 110, 270 40, 340 50 C 410 60, 430 20, 490 15"
                  fill="none"
                  stroke="#6366F1"
                  strokeWidth="3"
                  strokeLinecap="round"
                />

                {/* Data Points */}
                <circle cx="10" cy="130" r="4" fill="#fff" stroke="#6366F1" strokeWidth="2" />
                <circle cx="170" cy="95" r="4" fill="#fff" stroke="#6366F1" strokeWidth="2" />
                <circle cx="340" cy="50" r="4" fill="#fff" stroke="#6366F1" strokeWidth="2" />
                <circle cx="490" cy="15" r="4" fill="#fff" stroke="#6366F1" strokeWidth="2" />
              </svg>
            </div>
            
            {/* X Axis Labels */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px', fontSize: '11px', color: '#94A3B8', padding: '0 8px' }}>
              <span>Mon</span>
              <span>Tue</span>
              <span>Wed</span>
              <span>Thu</span>
              <span>Fri</span>
              <span>Sat</span>
              <span>Sun</span>
            </div>
          </div>

          {/* Today's Overview Widget */}
          <div style={{ background: '#fff', borderRadius: '14px', border: '1px solid #E2E8F0', padding: '20px', boxShadow: '0 1px 3px rgba(15,23,42,0.04)' }}>
            <h3 className="text-section-title" style={{ margin: '0 0 16px 0' }}>Today's Overview</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
              {[
                { label: "Tickets Created", value: systemStats?.total ?? '—', color: "#6366F1" },
                { label: "Resolved", value: systemStats?.resolved ?? '—', color: "#10B981" },
                { label: "Avg Response", value: (() => {
                    const m = systemStats?.avg_response_mins;
                    if (m == null) return '—';
                    if (m < 60) return `${Math.round(m)}m`;
                    if (m < 1440) return `${Math.round(m / 60)}h`;
                    return `${Math.round(m / 1440)}d`;
                  })(), color: "#F59E0B" },
                { label: "Escalations", value: systemStats?.escalated ?? '—', color: "#EF4444" }
              ].map((item, idx) => (
                <div key={idx} style={{ padding: '12px', background: '#F8FAFC', borderRadius: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '13px', color: '#64748B', fontWeight: '500' }}>{item.label}</span>
                  <span style={{ fontSize: '16px', fontWeight: '700', color: item.color }}>{item.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Team Workload Widget */}
          <div style={{ background: '#fff', borderRadius: '14px', border: '1px solid #E2E8F0', padding: '20px', boxShadow: '0 1px 3px rgba(15,23,42,0.04)', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <h3 className="text-section-title" style={{ margin: 0 }}>Team Workload</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {workload.slice(0, 4).map((w, idx) => (
                <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12.5px' }}>
                    <span style={{ fontWeight: '600', color: '#334155' }}>{w.agent_name || w.email?.split('@')[0]}</span>
                    <span style={{ fontWeight: '700', color: '#4F46E5' }}>{w.open_tickets || w.open_tickets === 0 ? w.open_tickets : 2} active</span>
                  </div>
                  <div style={{ background: '#F1F5F9', height: '6px', borderRadius: '3px', overflow: 'hidden' }}>
                    <div style={{
                      width: `${Math.min(100, ((w.open_tickets || 2) / 10) * 100)}%`,
                      height: '100%',
                      background: '#6366F1'
                    }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>

        {/* Right Column: Recent Activity Feed */}
        <div style={{ background: '#fff', borderRadius: '14px', border: '1px solid #E2E8F0', padding: '20px', boxShadow: '0 1px 3px rgba(15,23,42,0.04)', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Clock size={16} color="#6366F1" />
              <h3 className="text-section-title" style={{ margin: 0 }}>Recent Activity</h3>
            </div>
            <span style={{ fontSize: '12px', color: '#6366F1', fontWeight: '600', cursor: 'pointer' }}>View All</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', flex: 1, overflowY: 'auto' }}>
            {recentActivity.length === 0 ? (
              <div style={{ padding: '20px 0', textAlign: 'center', fontSize: '13px', color: '#94A3B8' }}>
                No recent activity logged yet.
              </div>
            ) : (
              recentActivity.map((activity) => {
                const config = getActivityConfig(activity.type);
                const Icon = config.icon;
                return (
                  <div key={activity.id} style={{
                    display: 'flex', gap: '12px', padding: '12px', borderRadius: '10px',
                    border: '1.5px solid #F1F5F9', transition: 'all 0.2s', cursor: 'pointer'
                  }}
                    onMouseEnter={e => {
                      e.currentTarget.style.borderColor = '#E2E8F0';
                      e.currentTarget.style.background = '#F8FAFC';
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.borderColor = '#F1F5F9';
                      e.currentTarget.style.background = 'transparent';
                    }}
                    onClick={() => navigate(`/tickets/${activity.ticket_id}`)}
                  >
                    <div style={{
                      width: '32px', height: '32px', borderRadius: '8px', background: `${config.color}15`,
                      color: config.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                    }}>
                      <Icon size={16} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '13.5px', fontWeight: '600', color: '#0F172A' }}>{activity.text}</div>
                      <div style={{ fontSize: '12px', color: '#64748B', marginTop: '2px' }}>{activity.detail}</div>
                    </div>
                    <span style={{ fontSize: '11.5px', color: '#94A3B8', flexShrink: 0, alignSelf: 'flex-start' }}>
                      {formatActivityTime(activity.time)}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* ── 4. Assigned Tickets Section (Tab Filter + Table) ───────────── */}
      <div style={{ background: '#fff', borderRadius: '14px', border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(15,23,42,0.04)', display: 'flex', flexDirection: 'column' }}>
        
        {/* Table Control Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid #F1F5F9', flexWrap: 'wrap', gap: '12px' }}>
          
          {/* Status Tabs */}
          <div style={{ display: 'flex', gap: '4px' }}>
            {["all", "open", "pending", "escalated", "resolved"].map(f => (
              <button
                key={f}
                onClick={() => setStatusFilter(f)}
                style={{
                  padding: '6px 12px', border: 'none', background: statusFilter === f ? 'rgba(99,102,241,0.08)' : 'none',
                  cursor: 'pointer', fontSize: '13px', borderRadius: '8px',
                  fontWeight: statusFilter === f ? '600' : '500',
                  color: statusFilter === f ? '#6366F1' : '#64748B',
                  transition: 'all 0.15s',
                  textTransform: 'capitalize'
                }}
              >
                {f === 'all' ? 'All Tickets' : STATUS_COLORS[f]?.label || f}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 12px', border: '1px solid #E2E8F0', borderRadius: '8px', background: '#fff', cursor: 'pointer', fontSize: '12.5px', color: '#475569' }}>
              Status <Filter size={12} /> <ChevronDown size={12} />
            </button>
            <button style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 12px', border: '1px solid #E2E8F0', borderRadius: '8px', background: '#fff', cursor: 'pointer', fontSize: '12.5px', color: '#475569' }}>
              Channel <Filter size={12} /> <ChevronDown size={12} />
            </button>
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              style={{
                display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 12px',
                border: '1.5px solid #E2E8F0', borderRadius: '8px', background: '#fff',
                cursor: 'pointer', fontSize: '12.5px', color: '#475569', transition: 'all 0.2s'
              }}
            >
              <RefreshCw size={12} className={isRefreshing ? "spin-animation" : ""} style={{ transition: 'transform 0.5s' }} /> Refresh
            </button>
          </div>
        </div>

        {/* CSS for spin animation */}
        <style>{`
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
          .spin-animation {
            animation: spin 0.8s linear infinite;
          }
        `}</style>

        {/* Tickets Grid / Table Content */}
        <div style={{ flex: 1 }}>
          {loading && (
            <div style={{ overflowX: 'auto', background: '#fff', borderRadius: '12px', border: '1px solid #E2E8F0', padding: '10px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                    <th style={{ padding: '12px 20px', fontSize: '12px', fontWeight: '700', color: '#64748B', textTransform: 'uppercase' }}>ID</th>
                    <th style={{ padding: '12px 20px', fontSize: '12px', fontWeight: '700', color: '#64748B', textTransform: 'uppercase' }}>Requester</th>
                    <th style={{ padding: '12px 20px', fontSize: '12px', fontWeight: '700', color: '#64748B', textTransform: 'uppercase' }}>Subject</th>
                    <th style={{ padding: '12px 20px', fontSize: '12px', fontWeight: '700', color: '#64748B', textTransform: 'uppercase' }}>Status</th>
                    <th style={{ padding: '12px 20px', fontSize: '12px', fontWeight: '700', color: '#64748B', textTransform: 'uppercase' }}>Priority</th>
                    <th style={{ padding: '12px 20px', fontSize: '12px', fontWeight: '700', color: '#64748B', textTransform: 'uppercase' }}>Created</th>
                    <th style={{ padding: '12px 20px', fontSize: '12px', fontWeight: '700', color: '#64748B', textTransform: 'uppercase', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {[1, 2, 3, 4, 5].map((i) => (
                    <SkeletonTableRow key={i} cols={7} />
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Premium Empty State */}
          {!loading && filtered.length === 0 && (
            <div style={{ padding: '64px 32px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              
              {/* Mailbox SVG Illustration */}
              <svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ marginBottom: '16px' }}>
                <rect x="8" y="18" width="48" height="34" rx="8" fill="#F1F5F9" stroke="#CBD5E1" strokeWidth="2.5" />
                <path d="M8 26L28.8 39.8667C30.7556 41.1704 33.2444 41.1704 35.2 39.8667L56 26" stroke="#94A3B8" strokeWidth="2.5" strokeLinecap="round" />
                <path d="M44 42L44 48M44 48L40 48M44 48L48 48" stroke="#6366F1" strokeWidth="3" strokeLinecap="round" />
                <circle cx="44" cy="38" r="3" fill="#6366F1" />
              </svg>

              <div style={{ fontSize: '16px', fontWeight: '700', color: '#0F172A', letterSpacing: '-0.01em' }}>📭 No tickets assigned</div>
              <div style={{ fontSize: '13.5px', color: '#64748B', marginTop: '6px', maxWidth: '320px', lineHeight: '1.5' }}>
                You're all caught up! New tickets assigned to you will appear here.
              </div>
              
              <button 
                onClick={handleRefresh}
                disabled={isRefreshing}
                style={{
                  marginTop: '16px', display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px',
                  border: 'none', borderRadius: '8px', background: '#6366F1', color: '#fff',
                  cursor: 'pointer', fontSize: '13px', fontWeight: '600', transition: 'all 0.2s',
                  boxShadow: '0 2px 4px rgba(99,102,241,0.1)'
                }}
                onMouseEnter={e => e.currentTarget.style.background = '#4F46E5'}
                onMouseLeave={e => e.currentTarget.style.background = '#6366F1'}
              >
                <RefreshCw size={12} className={isRefreshing ? "spin-animation" : ""} /> Refresh
              </button>
            </div>
          )}

          {/* Elegant Table Layout */}
          {!loading && filtered.length > 0 && (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                    <th style={{ padding: '12px 20px', fontSize: '12px', fontWeight: '700', color: '#64748B', textTransform: 'uppercase' }}>ID</th>
                    <th style={{ padding: '12px 20px', fontSize: '12px', fontWeight: '700', color: '#64748B', textTransform: 'uppercase' }}>Requester</th>
                    <th style={{ padding: '12px 20px', fontSize: '12px', fontWeight: '700', color: '#64748B', textTransform: 'uppercase' }}>Subject</th>
                    <th style={{ padding: '12px 20px', fontSize: '12px', fontWeight: '700', color: '#64748B', textTransform: 'uppercase' }}>Status</th>
                    <th style={{ padding: '12px 20px', fontSize: '12px', fontWeight: '700', color: '#64748B', textTransform: 'uppercase' }}>Priority</th>
                    <th style={{ padding: '12px 20px', fontSize: '12px', fontWeight: '700', color: '#64748B', textTransform: 'uppercase' }}>Created</th>
                    <th style={{ padding: '12px 20px', fontSize: '12px', fontWeight: '700', color: '#64748B', textTransform: 'uppercase', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((ticket) => (
                    <tr
                      key={ticket.id}
                      className="clickable-row"
                      onClick={() => navigate(`/tickets/${ticket.id}`)}
                      style={{ borderBottom: '1px solid #F1F5F9', transition: 'all 0.15s' }}
                    >
                      {/* Ticket ID */}
                      <td style={{ padding: '14px 20px', fontSize: '13.5px', fontWeight: '700', color: '#64748B' }}>
                        #{ticket.id}
                      </td>

                      {/* Requester Avatar + Name */}
                      <td style={{ padding: '14px 20px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div style={{
                            width: '28px', height: '28px', borderRadius: '50%',
                            background: `hsl(${(ticket.requester || ticket.title).charCodeAt(0) * 17}, 60%, 65%)`,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            color: '#fff', fontWeight: '700', fontSize: '11px', flexShrink: 0
                          }}>
                            {(ticket.requester || ticket.title).charAt(0).toUpperCase()}
                          </div>
                          <span style={{ fontSize: '13.5px', fontWeight: '600', color: '#0F172A' }}>
                            {ticket.requester || "Unknown"}
                          </span>
                        </div>
                      </td>

                      {/* Ticket Subject */}
                      <td style={{ padding: '14px 20px', maxWidth: '300px' }}>
                        <Link 
                          to={`/tickets/${ticket.id}`}
                          style={{
                            fontSize: '13.5px', fontWeight: '600', color: '#0F172A',
                            textDecoration: 'none', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                          }}
                          onMouseEnter={e => e.currentTarget.style.color = '#6366F1'}
                          onMouseLeave={e => e.currentTarget.style.color = '#0F172A'}
                        >
                          {ticket.title ? ticket.title.charAt(0).toUpperCase() + ticket.title.slice(1) : ""}
                        </Link>
                      </td>

                      {/* Status Badges with curated HSL colors */}
                      <td style={{ padding: '14px 20px' }}>
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', padding: '3px 8px', borderRadius: '6px',
                          background: STATUS_COLORS[ticket.status]?.bg || '#F1F5F9',
                          color: STATUS_COLORS[ticket.status]?.color || '#475569',
                          fontWeight: '600', fontSize: '11px', textTransform: 'capitalize'
                        }}>
                          {STATUS_COLORS[ticket.status]?.label || ticket.status}
                        </span>
                      </td>

                      {/* Priority Dot & Text */}
                      <td style={{ padding: '14px 20px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: '500', color: '#334155' }}>
                          <span style={{
                            width: '6px', height: '6px', borderRadius: '50%',
                            background: PRIORITY_COLORS[ticket.priority] || '#6B7280'
                          }} />
                          <span style={{ textTransform: 'capitalize' }}>{ticket.priority}</span>
                        </div>
                      </td>

                      {/* Created Date */}
                      <td style={{ padding: '14px 20px', fontSize: '13px', color: '#64748B' }}>
                        {formatDate(ticket.created_at)}
                      </td>

                      {/* Actions Button */}
                      <td style={{ padding: '14px 20px', textAlign: 'right' }}>
                        <Link to={`/tickets/${ticket.id}`} style={{
                          display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '6px 12px',
                          border: '1px solid #E2E8F0', borderRadius: '8px', background: '#fff',
                          color: '#475569', fontSize: '12px', fontWeight: '600', textDecoration: 'none', transition: 'all 0.15s'
                        }}
                          onMouseEnter={e => {
                            e.currentTarget.style.borderColor = '#6366F1';
                            e.currentTarget.style.color = '#6366F1';
                          }}
                          onMouseLeave={e => {
                            e.currentTarget.style.borderColor = '#E2E8F0';
                            e.currentTarget.style.color = '#475569';
                          }}
                        >
                          View <ArrowRight size={12} />
                        </Link>
                      </td>

                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>

    </div>
  );
}
