import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { ticketsAPI } from "../api/services";
import { useAuth } from "../context/AuthContext";

export default function AgentDashboard() {
  const { user } = useAuth();
  const [data, setData]       = useState(null);   // API response
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState("");

    useEffect(() => {
    ticketsAPI.agentTickets(user.id)
      .then((res) => setData(res.data))
      .catch(() => setError("Could not load your assigned tickets"))
      .finally(() => setLoading(false));
  }, []);
    return (
    <div className="page">
      <h1>My Assigned Tickets</h1>

      {loading && <p>Loading...</p>}
      {error && <div className="alert alert-error">{error}</div>}

      {data && (
        <>
          <p>You have <strong>{data.total}</strong> assigned tickets.</p>

          {/* Loop through each status group */}
          {["open", "pending", "escalated", "resolved"].map((status) => (
            <div key={status}>
              <h2>{status.charAt(0).toUpperCase() + status.slice(1)} ({data.tickets[status]?.length || 0})</h2>

              {data.tickets[status]?.length === 0 && (
                <p>No {status} tickets</p>
              )}

              {data.tickets[status]?.map((ticket) => (
                <Link to={`/tickets/${ticket.id}`} key={ticket.id} className="cd-history-row">
                  <div>
                    <strong>{ticket.title}</strong>
                    <span className={`badge badge--${status === "open" ? "blue" : status === "escalated" ? "red" : "yellow"}`}>
                      {ticket.priority}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          ))}
        </>
      )}
    </div>
  );
}


