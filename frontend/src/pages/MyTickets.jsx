import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ticketsAPI } from "../api/services";

const STATUS_COLORS = {
  open:      "blue",
  pending:   "yellow",
  escalated: "red",
  resolved:  "green",
  closed:    "gray",
};

export default function MyTickets() {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState("");

  // Create ticket form state
  const [showForm,    setShowForm]    = useState(false);
  const [title,       setTitle]       = useState("");
  const [description, setDescription] = useState("");
  const [priority,    setPriority]    = useState("medium");
  const [creating,    setCreating]    = useState(false);
  const [formError,   setFormError]   = useState("");

  const navigate = useNavigate();

  const loadTickets = () => {
    setLoading(true);
    ticketsAPI.list()
      .then((res) => setTickets(res.data.tickets || []))
      .catch(() => setError("Could not load tickets"))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadTickets(); }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    setFormError("");
    setCreating(true);

    try {
      const res = await ticketsAPI.create(title, description, priority);
      setShowForm(false);
      setTitle("");
      setDescription("");
      setPriority("medium");
      loadTickets();
      // Navigate to the new ticket
      navigate(`/tickets/${res.data.id}`);
    } catch (err) {
      const detail = err.response?.data?.detail;
      setFormError(typeof detail === "string" ? detail : "Could not create ticket.");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="page">
      <div className="page-header">
        <h1>My Tickets</h1>
        <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
          {showForm ? "Cancel" : "+ New Ticket"}
        </button>
      </div>

      {showForm && (
        <div className="form-card">
          <h2>Create a Support Ticket</h2>
          {formError && <div className="alert alert-error">{formError}</div>}
          <form onSubmit={handleCreate}>
            <div className="form-group">
              <label>Title</label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Brief summary of your issue"
                required minLength={3}
              />
            </div>
            <div className="form-group">
              <label>Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe your issue in detail..."
                rows={4}
                required minLength={10}
              />
            </div>
            <div className="form-group">
              <label>Priority</label>
              <select value={priority} onChange={(e) => setPriority(e.target.value)}>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>
            <button type="submit" className="btn btn-primary" disabled={creating}>
              {creating ? "Creating..." : "Create Ticket"}
            </button>
          </form>
        </div>
      )}

      {error   && <div className="alert alert-error">{error}</div>}
      {loading && <p className="loading-text">Loading your tickets...</p>}

      {!loading && tickets.length === 0 && (
        <div className="empty-state">
          <p>You have no tickets yet.</p>
          <button className="btn btn-primary" onClick={() => setShowForm(true)}>
            Create your first ticket
          </button>
        </div>
      )}

      <div className="ticket-list">
        {tickets.map((ticket) => (
          <Link to={`/tickets/${ticket.id}`} key={ticket.id} className="ticket-card">
            <div className="ticket-card__header">
              <span className="ticket-title">{ticket.title}</span>
              <span className={`badge badge--${STATUS_COLORS[ticket.status]}`}>
                {ticket.status}
              </span>
            </div>
            <div className="ticket-card__meta">
              <span className="meta-item">Priority: {ticket.priority}</span>
              {ticket.category && <span className="meta-item">{ticket.category}</span>}
              <span className="meta-item">
                {new Date(ticket.created_at).toLocaleDateString()}
              </span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}