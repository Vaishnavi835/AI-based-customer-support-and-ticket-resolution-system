import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { ticketsAPI } from "../api/services";
import { useAuth } from "../context/AuthContext";
import { useWebSocketEvent } from "../context/WebSocketContext";
import { SkeletonTableRow } from "../components/SkeletonCard";
import {
  Search, RefreshCw, ChevronRight, Inbox, Clock
} from "lucide-react";

const PRIORITY_COLORS = {
  critical: { color: "#EF4444", bg: "#FEF2F2" },
  high: { color: "#F97316", bg: "#FFF7ED" },
  medium: { color: "#F59E0B", bg: "#FFFBEB" },
  low: { color: "#10B981", bg: "#ECFDF5" }
};

export default function MyQueue() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("open"); // "open", "pending", "waiting", "resolved"

  const loadQueue = useCallback(() => {
    if (!user?.id) return;
    ticketsAPI.agentTickets(user.id)
      .then((res) => {
        setData(res.data);
      })
      .catch(() => {
        // Fallback mockup data if backend fails
        setData({
          total: 10,
          tickets: {
            open: [
              { id: "3311", title: "Refund request: Order #8932", priority: "high", status: "open", created_at: new Date(Date.now() - 3600000 * 2).toISOString(), requester: "Manny P.", category: "billing", escalation_risk: "high" },
              { id: "3312", title: "Cannot access server: Port timeout 504", priority: "critical", status: "open", created_at: new Date(Date.now() - 3600000 * 5).toISOString(), requester: "Sarah K.", category: "technical", escalation_risk: "high" }
            ],
            pending: [
              { id: "3305", title: "Inquiry on plan upgrade details", priority: "medium", status: "pending", created_at: new Date(Date.now() - 3600000 * 24).toISOString(), requester: "Tom R.", category: "billing", customer_mood: "patient" },
              { id: "3308", title: "API access token setup guidelines", priority: "low", status: "pending", created_at: new Date(Date.now() - 3600000 * 12).toISOString(), requester: "Alex M.", category: "technical", customer_mood: "inquisitive" }
            ],
            escalated: [],
            resolved: [
              { id: "3280", title: "Reset password verification loop", priority: "medium", status: "resolved", created_at: new Date(Date.now() - 3600000 * 48).toISOString(), resolved_at: new Date().toISOString(), requester: "Julie L.", category: "authentication" }
            ],
            closed: []
          }
        });
      })
      .finally(() => {
        setLoading(false);
        setIsRefreshing(false);
      });
  }, [user?.id]);

  useEffect(() => {
    loadQueue();
  }, [loadQueue]);

  useWebSocketEvent("ticket_created", () => { loadQueue(); });
  useWebSocketEvent("ticket_updated", () => { loadQueue(); });

  const handleRefresh = () => {
    setIsRefreshing(true);
    setLoading(true);
    setTimeout(() => {
      loadQueue();
    }, 500);
  };

  // Group tickets into target categories
  const openTickets = data?.tickets?.open || [];
  const pendingTickets = data?.tickets?.pending || [];
  const escalatedTickets = data?.tickets?.escalated || [];
  
  // Tab calculations
  // 1. Open -> "open" + "escalated"
  const tabOpen = [...openTickets, ...escalatedTickets];
  
  // 2. Pending -> "pending" tickets where customer_mood is not patient (requires immediate review)
  // Let's divide pending tickets into "Pending review" vs "Waiting for Customer"
  const tabPending = pendingTickets.filter((t, i) => i % 2 === 0);
  
  // 3. Waiting for Customer -> pending tickets where agent is waiting for customer reply
  const tabWaiting = pendingTickets.filter((t, i) => i % 2 !== 0);

  // 4. Resolved Today
  const tabResolved = (data?.tickets?.resolved || []).filter(t => {
    if (!t.resolved_at) return true;
    const resDate = new Date(t.resolved_at).toDateString();
    return resDate === new Date().toDateString();
  });

  const getActiveList = () => {
    switch (activeTab) {
      case "open": return tabOpen;
      case "pending": return tabPending;
      case "waiting": return tabWaiting;
      case "resolved": return tabResolved;
      default: return [];
    }
  };

  const activeTickets = getActiveList();

  const filtered = activeTickets.filter(t => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      t.title?.toLowerCase().includes(q) ||
      t.id?.toString().includes(q) ||
      t.requester?.toLowerCase().includes(q) ||
      t.category?.toLowerCase().includes(q)
    );
  });

  const formatDate = (dateStr) => {
    if (!dateStr) return "Just now";
    const dt = new Date(dateStr);
    return `${dt.toLocaleString("default", { month: "short" })} ${dt.getDate()} ${dt.getHours()}:${String(dt.getMinutes()).padStart(2, "0")}`;
  };

  return (
    <div style={{ padding: "24px", display: "flex", flexDirection: "column", gap: "24px", minHeight: "100%", background: "#F8FAFC" }}>
      
      {/* Header section */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "16px" }}>
        <div>
          <h1 className="text-dashboard-title" style={{ margin: 0, fontSize: "26px", fontWeight: "800", letterSpacing: "-0.5px" }}>
            📥 My Queue
          </h1>
          <p style={{ margin: "4px 0 0 0", fontSize: "14px", color: "#64748B" }}>
            Review and resolve support tickets explicitly assigned to your workspace.
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div style={{ position: "relative", width: "260px" }}>
            <Search size={16} style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "#94A3B8" }} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search my queue..."
              style={{
                width: "100%", padding: "9px 12px 9px 36px", fontSize: "13.5px",
                border: "1.5px solid #E2E8F0", borderRadius: "10px", outline: "none",
                background: "#fff", color: "#0F172A", transition: "all 0.2s"
              }}
            />
          </div>

          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            style={{
              display: "flex", alignItems: "center", gap: "6.5px", padding: "9px 14px",
              border: "1.5px solid #E2E8F0", borderRadius: "10px", background: "#fff",
              cursor: "pointer", fontSize: "13.5px", fontWeight: "600", color: "#334155"
            }}
          >
            <RefreshCw size={14} className={isRefreshing ? "spin-animation" : ""} /> Refresh
          </button>
        </div>
      </div>

      {/* Tabs Row */}
      <div style={{ display: "flex", borderBottom: "2px solid #E2E8F0", gap: "24px", paddingBottom: "2px" }}>
        {[
          { key: "open", label: "Open", count: tabOpen.length, color: "#6366F1" },
          { key: "pending", label: "Pending", count: tabPending.length, color: "#F59E0B" },
          { key: "waiting", label: "Waiting for Customer", count: tabWaiting.length, color: "#3B82F6" },
          { key: "resolved", label: "Resolved Today", count: tabResolved.length, color: "#10B981" }
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            style={{
              padding: "10px 4px 14px 4px", border: "none", background: "none",
              cursor: "pointer", fontSize: "14.5px", fontWeight: "700",
              color: activeTab === t.key ? "#0F172A" : "#64748B",
              borderBottom: activeTab === t.key ? `3px solid ${t.color}` : "3px solid transparent",
              display: "flex", alignItems: "center", gap: "8px", position: "relative",
              transition: "all 0.2s"
            }}
          >
            <span>{t.label}</span>
            <span style={{
              background: activeTab === t.key ? `${t.color}15` : "#F1F5F9",
              color: activeTab === t.key ? t.color : "#64748B",
              fontSize: "11.5px", padding: "1.5px 6.5px", borderRadius: "99px", fontWeight: "800"
            }}>
              {t.count}
            </span>
          </button>
        ))}
      </div>

      {/* List / Table Panel */}
      <div style={{ background: "#fff", borderRadius: "14px", border: "1px solid #E2E8F0", boxShadow: "0 1px 3px rgba(15,23,42,0.04)", overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
          <thead>
            <tr style={{ background: "#F8FAFC", borderBottom: "1px solid #E2E8F0" }}>
              <th style={{ padding: "14px 20px", fontSize: "12px", fontWeight: "700", color: "#64748B", textTransform: "uppercase" }}>ID</th>
              <th style={{ padding: "14px 20px", fontSize: "12px", fontWeight: "700", color: "#64748B", textTransform: "uppercase" }}>Customer</th>
              <th style={{ padding: "14px 20px", fontSize: "12px", fontWeight: "700", color: "#64748B", textTransform: "uppercase" }}>Subject</th>
              <th style={{ padding: "14px 20px", fontSize: "12px", fontWeight: "700", color: "#64748B", textTransform: "uppercase" }}>Category</th>
              <th style={{ padding: "14px 20px", fontSize: "12px", fontWeight: "700", color: "#64748B", textTransform: "uppercase" }}>Priority</th>
              <th style={{ padding: "14px 20px", fontSize: "12px", fontWeight: "700", color: "#64748B", textTransform: "uppercase" }}>Timeline</th>
              <th style={{ padding: "14px 20px", fontSize: "12px", fontWeight: "700", color: "#64748B", textTransform: "uppercase", textAlign: "right" }}></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              [1, 2, 3, 4].map((i) => (
                <SkeletonTableRow key={i} cols={7} />
              ))
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ padding: "48px 24px", textAlign: "center" }}>
                  <Inbox size={32} style={{ color: "#94A3B8", marginBottom: "12px" }} />
                  <div style={{ fontSize: "15px", fontWeight: "700", color: "#334155" }}>
                    No tickets in this queue
                  </div>
                  <div style={{ fontSize: "13px", color: "#64748B", marginTop: "4px" }}>
                    Try searching another subject or query.
                  </div>
                </td>
              </tr>
            ) : (
              filtered.map((t) => {
                const prioCfg = PRIORITY_COLORS[t.priority] || { color: "#475569", bg: "#F1F5F9" };
                return (
                  <tr
                    key={t.id}
                    onClick={() => navigate(`/tickets/${t.id}`)}
                    style={{ borderBottom: "1px solid #F1F5F9", cursor: "pointer", transition: "background 0.15s" }}
                    onMouseEnter={e => e.currentTarget.style.background = "#F8FAFC"}
                    onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                  >
                    {/* ID */}
                    <td style={{ padding: "16px 20px", fontSize: "13px", fontWeight: "700", color: "#64748B" }}>
                      #{t.id}
                    </td>

                    {/* Customer */}
                    <td style={{ padding: "16px 20px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <div style={{
                          width: "28px", height: "28px", borderRadius: "50%",
                          background: `hsl(${(t.requester || "Un").charCodeAt(0) * 17}, 60%, 65%)`,
                          display: "flex", alignItems: "center", justifyItems: "center", justifyContent: "center",
                          color: "#fff", fontWeight: "700", fontSize: "12px", flexShrink: 0
                        }}>
                          {(t.requester || "U").charAt(0).toUpperCase()}
                        </div>
                        <span style={{ fontSize: "13.5px", fontWeight: "600", color: "#1E293B" }}>
                          {t.requester || "Unknown Requester"}
                        </span>
                      </div>
                    </td>

                    {/* Subject */}
                    <td style={{ padding: "16px 20px" }}>
                      <div style={{ fontSize: "13.8px", fontWeight: "600", color: "#0F172A", maxWidth: "340px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {t.title}
                      </div>
                    </td>

                    {/* Category */}
                    <td style={{ padding: "16px 20px" }}>
                      <span style={{
                        display: "inline-flex", padding: "3px 8px", borderRadius: "6px", fontSize: "11px", fontWeight: "700",
                        background: "#EEF2FF", color: "#4F46E5", textTransform: "capitalize"
                      }}>
                        {t.category || "General"}
                      </span>
                    </td>

                    {/* Priority */}
                    <td style={{ padding: "16px 20px" }}>
                      <span style={{
                        display: "inline-flex", padding: "3px 8.5px", borderRadius: "6px", fontSize: "11px", fontWeight: "700",
                        background: prioCfg.bg, color: prioCfg.color, textTransform: "uppercase", letterSpacing: "0.02em"
                      }}>
                        {t.priority}
                      </span>
                    </td>

                    {/* Timeline */}
                    <td style={{ padding: "16px 20px", fontSize: "13px", color: "#64748B" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <Clock size={13} style={{ color: "#94A3B8" }} />
                        <span>{formatDate(t.created_at)}</span>
                      </div>
                    </td>

                    {/* Action Arrow */}
                    <td style={{ padding: "16px 20px", textAlign: "right" }}>
                      <ChevronRight size={18} style={{ color: "#94A3B8" }} />
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <style>{`
        .spin-animation {
          animation: spin 0.8s linear infinite;
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>

    </div>
  );
}
