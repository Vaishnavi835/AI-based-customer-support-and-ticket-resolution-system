import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { ticketsAPI, chatAPI } from "../api/services";
import { useAuth } from "../context/AuthContext";

export default function TicketDetail() {
  const { id } = useParams();        // ticket ID from URL
  const { user } = useAuth();

  const [ticket, setTicket]     = useState(null);
  const [chats, setChats]       = useState([]);     // array of chat sessions
  const [message, setMessage]   = useState("");      // the text input
  const [loading, setLoading]   = useState(true);
  const [sending, setSending]   = useState(false);   // prevent double-send

    const loadData = async () => {
    try {
      const [ticketRes, chatRes] = await Promise.all([
        ticketsAPI.get(id),
        chatAPI.getHistory(id),
      ]);
      setTicket(ticketRes.data);
      setChats(chatRes.data);
    } catch (err) {
      console.error("Failed to load ticket", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, [id]);

    const handleSend = async () => {
    if (!message.trim() || sending) return;   // don't send empty messages
    if (chats.length === 0) return;            // no chat session yet

    setSending(true);
    try {
      const chatId = chats[0].id;              // use first chat session
      await chatAPI.sendMessage(chatId, message);
      setMessage("");                           // clear input
      await loadData();                         // refresh to see new message
    } catch (err) {
      console.error("Failed to send message", err);
    } finally {
      setSending(false);
    }
  };
    const handleStatusChange = async (newStatus) => {
    try {
      await ticketsAPI.update(id, { status: newStatus });
      await loadData();   // refresh ticket data
    } catch (err) {
      alert(err.response?.data?.detail || "Cannot change status");
    }
  };
    if (loading) return <div className="page"><p>Loading...</p></div>;
  if (!ticket) return <div className="page"><p>Ticket not found</p></div>;

  return (
    <div className="page">
      {/* ── Ticket Info ───────────────────── */}
      <h1>{ticket.title}</h1>
      <p>{ticket.description}</p>
      <p>Status: <strong>{ticket.status}</strong> | Priority: <strong>{ticket.priority}</strong></p>

      {/* ── Status Change Buttons ─────────── */}
      {user.role !== "customer" && (
        <div style={{ display: "flex", gap: 8, margin: "16px 0" }}>
          {["pending", "resolved"].map((s) => (
            <button key={s} onClick={() => handleStatusChange(s)} className="cd-btn cd-btn--primary">
              Mark as {s}
            </button>
          ))}
        </div>
      )}

      {/* ── Chat History ──────────────────── */}
      <h2>Chat History</h2>
      {chats.length === 0 && <p>No chat sessions for this ticket yet.</p>}

      {chats.map((chat) => (
        <div key={chat.id} style={{ marginBottom: 24 }}>
          {chat.messages?.map((msg, i) => (
            <div key={i} style={{
              padding: 12,
              margin: "8px 0",
              borderRadius: 8,
              background: msg.prompt ? "var(--bg-secondary, #f0f0f0)" : "var(--accent-primary, #e8ddd0)",
            }}>
              {msg.prompt && <p><strong>Customer:</strong> {msg.prompt}</p>}
              {msg.response && <p><strong>AI/Agent:</strong> {msg.response}</p>}
            </div>
          ))}
        </div>
      ))}

      {/* ── Reply Box ─────────────────────── */}
      {chats.length > 0 && (
        <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
          <input
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Type your reply..."
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            style={{ flex: 1, padding: 10, borderRadius: 8, border: "1px solid #ccc" }}
          />
          <button onClick={handleSend} disabled={sending} className="cd-btn cd-btn--primary">
            {sending ? "Sending..." : "Send"}
          </button>
        </div>
      )}
    </div>
  );
}



