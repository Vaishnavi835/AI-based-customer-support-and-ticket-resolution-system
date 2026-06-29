import { useState, useEffect, useCallback } from "react";
import { ticketsAPI } from "../api/services";
import { useAuth } from "../context/AuthContext";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  BarChart, Bar, Cell, PieChart, Pie
} from "recharts";
import { CheckCircle2, Clock, ThumbsUp, RotateCcw, Award, RefreshCw } from "lucide-react";

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Format a duration in minutes to a readable string like "2.4m" or "1h 3m" */
function fmtMinutes(mins) {
  if (!mins || isNaN(mins)) return "—";
  if (mins < 60) return `${mins.toFixed(1)}m`;
  const h = Math.floor(mins / 60);
  const m = Math.round(mins % 60);
  return `${h}h ${m}m`;
}


/** Build last-7-days resolution trend from resolved/closed tickets */
function buildResolutionTrend(allTickets) {
  const now = new Date();
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    days.push({
      label: ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][d.getDay()],
      date: d.toISOString().slice(0, 10)
    });
  }

  return days.map(({ label, date }) => {
    const count = allTickets.filter(t => {
      const resolved = t.resolved_at || t.updated_at;
      return resolved && resolved.slice(0, 10) === date &&
        (t.status === "resolved" || t.status === "closed");
    }).length;
    return { day: label, Closed: count, Target: 5 };
  });
}

/** Build first-response speed chart (minutes between created_at and first reply)
 *  Uses updated_at as a proxy since we don't store first_response_at separately. */
function buildResponseTrend(allTickets) {
  const now = new Date();
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    days.push({
      label: ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][d.getDay()],
      date: d.toISOString().slice(0, 10)
    });
  }

  return days.map(({ label, date }) => {
    const dayTickets = allTickets.filter(t =>
      t.created_at && t.created_at.slice(0, 10) === date && t.updated_at
    );
    if (dayTickets.length === 0) return { day: label, Time: 0 };
    const avgMins = dayTickets.reduce((sum, t) => {
      const diffMs = new Date(t.updated_at) - new Date(t.created_at);
      return sum + diffMs / 60000;
    }, 0) / dayTickets.length;
    return { day: label, Time: parseFloat(avgMins.toFixed(1)) };
  });
}

/** Build category distribution from all tickets */
function buildCategoryDist(allTickets) {
  const COLORS = ["#6366F1", "#10B981", "#F59E0B", "#EC4899", "#3B82F6", "#8B5CF6"];
  const counts = {};
  allTickets.forEach(t => {
    const cat = t.category || "general";
    counts[cat] = (counts[cat] || 0) + 1;
  });
  const total = allTickets.length || 1;
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, value], i) => ({
      name: name.charAt(0).toUpperCase() + name.slice(1),
      value: Math.round((value / total) * 100),
      color: COLORS[i % COLORS.length]
    }));
}

/** Determine performance tier based on resolved count */
function getTier(resolved) {
  if (resolved >= 100) return { label: "Elite Specialist", color: "#6366F1" };
  if (resolved >= 50)  return { label: "Senior Agent", color: "#10B981" };
  if (resolved >= 20)  return { label: "Specialist", color: "#F59E0B" };
  return { label: "Trainee", color: "#94A3B8" };
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function AgentPerformance() {
  const { user } = useAuth();

  const [metrics, setMetrics] = useState(null);
  const [resolutionTrend, setResolutionTrend] = useState([]);
  const [responseTrend, setResponseTrend] = useState([]);
  const [categoryDist, setCategoryDist] = useState([]);
  const [slaCompliance, setSlaCompliance] = useState({ firstResponse: 0, reopen: 0, escalated: 0 });
  const [loading, setLoading] = useState(true);

  const compute = useCallback(async () => {
    setLoading(true);
    try {
      const res = await ticketsAPI.agentTickets(user.id);
      const ticketsObj = res.data.tickets || {};

      const open      = ticketsObj.open      || [];
      const pending   = ticketsObj.pending   || [];
      const escalated = ticketsObj.escalated || [];
      const resolved  = ticketsObj.resolved  || [];
      const closed    = ticketsObj.closed    || [];

      const allTickets = [...open, ...pending, ...escalated, ...resolved, ...closed];
      const doneTickets = [...resolved, ...closed];
      const activeTickets = [...open, ...pending, ...escalated];

      // ── Tickets Closed ──────────────────────────────────────────────
      const closedCount = doneTickets.length;

      // ── Avg Response Time (created → updated, proxy for first reply) ─
      const withTimes = allTickets.filter(t => t.created_at && t.updated_at);
      const avgResponseMins = withTimes.length > 0
        ? withTimes.reduce((sum, t) => {
            const ms = new Date(t.updated_at) - new Date(t.created_at);
            return sum + ms / 60000;
          }, 0) / withTimes.length
        : null;

      // ── CSAT from ratings ────────────────────────────────────────────
      const rated = allTickets.filter(t => t.rating);
      const avgRating = rated.length > 0
        ? rated.reduce((s, t) => s + t.rating, 0) / rated.length
        : null;
      const csat = avgRating !== null ? Math.round((avgRating / 5) * 100) : null;

      // ── Reopen Rate (tickets that went open → resolved multiple times)
      // Proxy: tickets in "open" that were previously resolved (have resolved_at)
      const reopenedCount = allTickets.filter(
        t => t.status === "open" && t.resolved_at
      ).length;
      const reopenRate = allTickets.length > 0
        ? ((reopenedCount / allTickets.length) * 100).toFixed(1)
        : "0.0";

      // ── SLA Compliance ───────────────────────────────────────────────
      // First response SLA: updated within 15 mins of creation
      const slaFirstResponse = withTimes.length > 0
        ? Math.round(
            (withTimes.filter(t => {
              const ms = new Date(t.updated_at) - new Date(t.created_at);
              return ms / 60000 <= 15;
            }).length / withTimes.length) * 100
          )
        : 100;

      // Reopen SLA compliance
      const slaReopen = parseFloat(reopenRate) <= 5 ? 100 : Math.round((5 / parseFloat(reopenRate)) * 100);

      // Escalated SLA: escalated tickets that were eventually resolved
      const escalatedResolved = doneTickets.filter(t => t.escalated || t.status === "escalated").length;
      const escalatedTotal = escalated.length + escalatedResolved;
      const slaEscalated = escalatedTotal > 0
        ? Math.round((escalatedResolved / escalatedTotal) * 100)
        : 100;

      // ── Charts ───────────────────────────────────────────────────────
      setResolutionTrend(buildResolutionTrend(allTickets));
      setResponseTrend(buildResponseTrend(allTickets));
      setCategoryDist(buildCategoryDist(allTickets));

      setSlaCompliance({
        firstResponse: slaFirstResponse,
        reopen: slaReopen,
        escalated: slaEscalated
      });

      setMetrics({
        closed: closedCount,
        total: allTickets.length,
        active: activeTickets.length,
        responseTime: fmtMinutes(avgResponseMins),
        csat: csat !== null ? csat : "—",
        csatRatings: rated.length,
        reopenRate: `${reopenRate}%`,
        tier: getTier(closedCount)
      });
    } catch (err) {
      console.error("Performance load failed:", err);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => { compute(); }, [compute]);

  if (loading) return (
    <div style={{ padding: "40px", textAlign: "center", color: "#64748B" }}>
      <RefreshCw size={24} style={{ animation: "spin 0.8s linear infinite", margin: "0 auto 12px", display: "block" }} />
      Loading performance data...
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  if (!metrics) return (
    <div style={{ padding: "40px", textAlign: "center", color: "#94A3B8" }}>
      Could not load performance data.
    </div>
  );

  const kpiCards = [
    {
      label: "Tickets Closed",
      value: metrics.closed,
      sub: `${metrics.total} total assigned`,
      color: "#10B981", bg: "rgba(16,185,129,0.08)", icon: CheckCircle2
    },
    {
      label: "Avg Response Time",
      value: metrics.responseTime,
      sub: "SLA target: < 15m",
      color: "#6366F1", bg: "rgba(99,102,241,0.08)", icon: Clock
    },
    {
      label: "CSAT Score",
      value: metrics.csat !== "—" ? `${metrics.csat}%` : "—",
      sub: metrics.csatRatings > 0 ? `From ${metrics.csatRatings} ratings` : "No ratings yet",
      color: "#F59E0B", bg: "rgba(245,158,11,0.08)", icon: ThumbsUp
    },
    {
      label: "Reopen Rate",
      value: metrics.reopenRate,
      sub: "SLA target: < 5%",
      color: "#EC4899", bg: "rgba(236,72,153,0.08)", icon: RotateCcw
    }
  ];

  return (
    <div style={{ padding: "24px", display: "flex", flexDirection: "column", gap: "24px", minHeight: "100%", background: "#F8FAFC" }}>

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h1 className="text-dashboard-title" style={{ margin: 0, fontSize: "26px", fontWeight: "800", letterSpacing: "-0.5px" }}>
            📈 Performance
          </h1>
          <p style={{ margin: "4px 0 0 0", fontSize: "14.5px", color: "#64748B" }}>
            Your personal CSAT index, ticket resolution counts, and SLA compliance — all real data.
          </p>
        </div>
        <div style={{ display: "flex", gap: "10px" }}>
          <button
            onClick={compute}
            style={{ border: "1.5px solid #E2E8F0", background: "#fff", borderRadius: "8px", padding: "7px 10px", cursor: "pointer", color: "#64748B", display: "flex", alignItems: "center" }}
            title="Refresh"
          >
            <RefreshCw size={14} />
          </button>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", background: "#EEF2FF", padding: "8px 14px", borderRadius: "10px", border: `1px solid ${metrics.tier.color}33` }}>
            <Award size={16} color={metrics.tier.color} />
            <span style={{ fontSize: "13px", fontWeight: "800", color: metrics.tier.color }}>
              {metrics.tier.label}
            </span>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "16px" }}>
        {kpiCards.map((c) => {
          const Icon = c.icon;
          return (
            <div
              key={c.label}
              style={{
                background: "#fff", border: "1px solid #E2E8F0", borderRadius: "14px", padding: "20px",
                display: "flex", flexDirection: "column", gap: "10px",
                boxShadow: "0 1px 3px rgba(15,23,42,0.03)", borderLeft: `4px solid ${c.color}`
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "12.8px", color: "#64748B", fontWeight: "700", textTransform: "uppercase" }}>{c.label}</span>
                <div style={{ width: "30px", height: "30px", borderRadius: "8px", background: c.bg, display: "flex", alignItems: "center", justifyContent: "center", color: c.color }}>
                  <Icon size={14} />
                </div>
              </div>
              <div>
                <div style={{ fontSize: "26px", fontWeight: "800", color: "#0F172A", letterSpacing: "-0.5px" }}>{c.value}</div>
                <div style={{ fontSize: "11.5px", color: "#64748B", marginTop: "3px" }}>{c.sub}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Charts */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(420px, 1fr))", gap: "24px" }}>

        {/* Weekly Closed Tickets Area Chart */}
        <div style={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: "14px", padding: "24px", boxShadow: "0 1px 3px rgba(15,23,42,0.03)" }}>
          <h3 style={{ margin: "0 0 4px 0", fontSize: "15.5px", fontWeight: "800", color: "#0F172A" }}>
            Weekly Ticket Resolution (Last 7 Days)
          </h3>
          <p style={{ margin: "0 0 16px 0", fontSize: "12px", color: "#94A3B8" }}>Based on your resolved/closed tickets by date</p>
          <div style={{ width: "100%", height: "240px" }}>
            <ResponsiveContainer>
              <AreaChart data={resolutionTrend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="areaColor" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10B981" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                <XAxis dataKey="day" tick={{ fontSize: 11, fill: "#6B7280" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "#6B7280" }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip contentStyle={{ borderRadius: "8px", border: "none", boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }} />
                <Area type="monotone" dataKey="Closed" stroke="#10B981" strokeWidth={3} fillOpacity={1} fill="url(#areaColor)" />
                <Area type="monotone" dataKey="Target" stroke="#CBD5E1" strokeWidth={1.5} strokeDasharray="5 5" fill="none" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Response Time Bar Chart */}
        <div style={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: "14px", padding: "24px", boxShadow: "0 1px 3px rgba(15,23,42,0.03)" }}>
          <h3 style={{ margin: "0 0 4px 0", fontSize: "15.5px", fontWeight: "800", color: "#0F172A" }}>
            Avg Response Time Per Day (mins)
          </h3>
          <p style={{ margin: "0 0 16px 0", fontSize: "12px", color: "#94A3B8" }}>Time from ticket creation to first update</p>
          <div style={{ width: "100%", height: "240px" }}>
            <ResponsiveContainer>
              <BarChart data={responseTrend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                <XAxis dataKey="day" tick={{ fontSize: 11, fill: "#6B7280" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "#6B7280" }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ borderRadius: "8px", border: "none", boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }} />
                <Bar dataKey="Time" radius={[4, 4, 0, 0]}>
                  {responseTrend.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.Time <= 15 ? "#10B981" : "#EF4444"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Bottom: SLA + Category */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: "24px", alignItems: "flex-start" }}>

        {/* SLA Compliance */}
        <div style={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: "14px", padding: "24px", boxShadow: "0 1px 3px rgba(15,23,42,0.03)", display: "flex", flexDirection: "column", gap: "16px" }}>
          <h3 style={{ margin: 0, fontSize: "15.5px", fontWeight: "800", color: "#0F172A" }}>
            SLA Policy Compliance
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            {[
              { label: "First Response (≤15m)", value: slaCompliance.firstResponse, target: 95 },
              { label: "Reopen Rate (≤5%)", value: slaCompliance.reopen, target: 95 },
              { label: "Escalation Resolution", value: slaCompliance.escalated, target: 90 }
            ].map(({ label, value, target }) => {
              const pass = value >= target;
              return (
                <div key={label}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px", marginBottom: "6px" }}>
                    <span style={{ display: "flex", alignItems: "center", gap: "8px", color: "#334155", fontWeight: "600" }}>
                      <span style={{ color: pass ? "#10B981" : "#EF4444", fontWeight: "bold", fontSize: "15px" }}>
                        {pass ? "✓" : "✗"}
                      </span>
                      {label}
                    </span>
                    <span style={{ fontWeight: "800", color: pass ? "#10B981" : "#EF4444" }}>{value}%</span>
                  </div>
                  <div style={{ background: "#F1F5F9", borderRadius: "6px", height: "7px", overflow: "hidden" }}>
                    <div style={{
                      width: `${Math.min(value, 100)}%`, height: "100%",
                      background: pass ? "#10B981" : "#EF4444",
                      borderRadius: "6px", transition: "width 0.6s ease"
                    }} />
                  </div>
                  <div style={{ fontSize: "11px", color: "#94A3B8", marginTop: "3px" }}>Target: ≥ {target}%</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Category Pie */}
        <div style={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: "14px", padding: "24px", boxShadow: "0 1px 3px rgba(15,23,42,0.03)", display: "flex", flexDirection: "column", gap: "12px" }}>
          <h3 style={{ margin: 0, fontSize: "15.5px", fontWeight: "800", color: "#0F172A" }}>
            Ticket Category Split
          </h3>
          {categoryDist.length === 0 ? (
            <div style={{ fontSize: "13px", color: "#94A3B8", textAlign: "center", padding: "20px" }}>No category data yet.</div>
          ) : (
            <>
              <div style={{ width: "100%", height: "160px" }}>
                <ResponsiveContainer>
                  <PieChart>
                    <Pie
                      data={categoryDist}
                      cx="50%" cy="50%"
                      innerRadius={45} outerRadius={65}
                      paddingAngle={4} dataKey="value"
                    >
                      {categoryDist.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v) => `${v}%`} contentStyle={{ borderRadius: "8px", border: "none", boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                {categoryDist.map((entry, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: "12px", color: "#475569" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: entry.color, flexShrink: 0 }} />
                      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "140px" }}>{entry.name}</span>
                    </div>
                    <span style={{ fontWeight: "700", color: "#0F172A" }}>{entry.value}%</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

      </div>
    </div>
  );
}
