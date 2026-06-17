import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { escalationAPI } from "../api/services";
import { useAuth } from "../context/AuthContext";

export default function Escalations() {
  const { user } = useAuth();
  const [escalations, setEscalations] = useState([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState("");

  const loadEscalations = () => {
    setLoading(true);
    escalationAPI.pending()
      .then((res) => setEscalations(res.data))
      .catch(() => setError("Could not load escalations"))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadEscalations(); }, []);
    const handleTakeover = async (chatId) => {
    try {
      await escalationAPI.takeover(chatId);
      loadEscalations();   // refresh the list
    } catch (err) {
      alert(err.response?.data?.detail || "Takeover failed");
    }
  };

  const handleResolve = async (chatId) => {
    const note = prompt("Resolution note (optional):");  // simple browser prompt
    try {
      await escalationAPI.resolve(chatId, note);
      loadEscalations();   // refresh the list
    } catch (err) {
      alert(err.response?.data?.detail || "Resolve failed");
    }
  };
    return (
    <div className="page">
      <h1>Escalation Queue</h1>
      <p>These chats need human attention. Take over a case to start helping the customer.</p>

      {loading && <p>Loading...</p>}
      {error && <div className="alert alert-error">{error}</div>}

      {!loading && escalations.length === 0 && (
        <p>🎉 No pending escalations. All clear!</p>
      )}

      {escalations.map((esc) => (
        <div key={esc.id} style={{
          padding: 16,
          margin: "12px 0",
          borderRadius: 12,
          border: "1px solid #e0d5c7",
          background: "var(--bg-card, #fff)",
        }}>
          <p><strong>Reason:</strong> {esc.reason}</p>
          <p><strong>Chat ID:</strong> {esc.chat_id}</p>
          <p><strong>Ticket ID:</strong> {esc.ticket_id}</p>
          {esc.note && <p><strong>Note:</strong> {esc.note}</p>}
          <p><strong>Created:</strong> {new Date(esc.created_at).toLocaleString()}</p>

          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <button onClick={() => handleTakeover(esc.chat_id)} className="cd-btn cd-btn--primary">
              🙋 Take Over
            </button>
            <Link to={`/tickets/${esc.ticket_id}`} className="cd-btn cd-btn--ghost">
              View Ticket →
            </Link>
          </div>
        </div>
      ))}
    </div>
  );
}


