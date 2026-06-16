import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { ticketsAPI } from "../api/services";
import { useAuth } from "../context/AuthContext";

export default function Dashboard() {
  const [stats,   setStats]   = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState("");

  const { user } = useAuth();

  useEffect(() => {
    ticketsAPI.stats()
      .then((res) => setStats(res.data))
      .catch(() => setError("Could not load stats"))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="page">
      <div className="page-header">
        <h1>Dashboard</h1>
        <p>Welcome back, {user?.name}</p>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {loading ? (
        <p className="loading-text">Loading stats...</p>
      ) : stats && (
        <div className="stats-grid">
          <StatCard label="Total"     value={stats.total}         color="default" />
          <StatCard label="Open"      value={stats.open}          color="blue"    />
          <StatCard label="Pending"   value={stats.pending}       color="yellow"  />
          <StatCard label="Escalated" value={stats.escalated}     color="red"     />
          <StatCard label="Resolved"  value={stats.resolved}      color="green"   />
          <StatCard label="Closed"    value={stats.closed}        color="gray"    />
          <StatCard label="High Priority" value={stats.high_priority} color="orange" />
        </div>
      )}

      <div className="quick-links">
        <h2>Quick Actions</h2>
        <div className="links-grid">
          <Link to="/tickets"          className="quick-link">All Tickets</Link>
          <Link to="/escalations"      className="quick-link">Escalation Queue</Link>
          <Link to="/tickets/search"   className="quick-link">Search Tickets</Link>
          <Link to="/knowledge-base"   className="quick-link">Knowledge Base</Link>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, color }) {
  return (
    <div className={`stat-card stat-card--${color}`}>
      <span className="stat-value">{value}</span>
      <span className="stat-label">{label}</span>
    </div>
  );
}