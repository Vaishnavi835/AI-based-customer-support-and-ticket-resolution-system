import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { escalationAPI } from "../api/services";
import { useWebSocketEvent } from "../context/WebSocketContext";
import { useToast } from "../context/ToastContext";
import { 
  ShieldAlert, Clock, CheckCircle2, 
  RefreshCw, AlertTriangle, X 
} from "lucide-react";
import { SkeletonCard } from "../components/SkeletonCard";

export default function Escalations() {
  const [escalations, setEscalations] = useState([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState("");
  const toast = useToast();

  // Modal States
  const [isResolveModalOpen, setIsResolveModalOpen] = useState(false);
  const [resolvingChatId, setResolvingChatId]       = useState(null);
  const [resolutionNote, setResolutionNote]         = useState("");
  const [submittingResolve, setSubmittingResolve]   = useState(false);

  const loadEscalations = useCallback(() => {
    escalationAPI.pending()
      .then((res) => setEscalations(res.data))
      .catch(() => setError("Could not load escalations"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { loadEscalations(); }, [loadEscalations]);

  // Subscribe to real-time escalation/chat/ticket updates
  useWebSocketEvent("chat_updated", () => {
    loadEscalations();
  });

  useWebSocketEvent("ticket_updated", () => {
    loadEscalations();
  });

  const handleTakeover = async (chatId) => {
    setLoading(true);
    try {
      await escalationAPI.takeover(chatId);
      toast.success("Successfully took over the escalated chat session.");
      loadEscalations();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Takeover failed. Please try again.");
      setLoading(false);
    }
  };

  const openResolveModal = (chatId) => {
    setResolvingChatId(chatId);
    setResolutionNote("");
    setIsResolveModalOpen(true);
  };

  const closeResolveModal = () => {
    setIsResolveModalOpen(false);
    setResolvingChatId(null);
    setResolutionNote("");
  };

  const handleResolveSubmit = async (e) => {
    e.preventDefault();
    if (!resolvingChatId) return;

    setSubmittingResolve(true);
    try {
      await escalationAPI.resolve(resolvingChatId, resolutionNote);
      toast.success("Escalated case successfully marked as resolved.");
      closeResolveModal();
      loadEscalations();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Resolution failed. Please try again.");
    } finally {
      setSubmittingResolve(false);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return "—";
    const d = new Date(dateStr);
    return d.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  };

  return (
    <div style={{ padding: "28px", display: "flex", flexDirection: "column", gap: "24px" }}>
      
      {/* ── Page Header ───────────────────────────────────── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <h1 className="text-dashboard-title" style={{ margin: 0, fontSize: "26px", fontWeight: "800", letterSpacing: "-0.5px" }}>
            Escalation Queue
          </h1>
          <p style={{ margin: "4px 0 0 0", fontSize: "14.5px", color: "var(--color-muted, #64748B)" }}>
            Review, takeover, and resolve critical chat cases escalated by customer support agents.
          </p>
        </div>
        <button 
          onClick={() => { setLoading(true); loadEscalations(); }} 
          style={{ 
            display: "flex", 
            alignItems: "center", 
            gap: "6px", 
            padding: "9px 16px", 
            border: "1.5px solid var(--color-border, #E4E7EC)", 
            borderRadius: "10px", 
            background: "#fff", 
            cursor: "pointer", 
            fontSize: "13px", 
            fontWeight: "600", 
            color: "var(--color-text, #374151)", 
            transition: "border-color 0.15s" 
          }}
        >
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {/* ── Metric Cards ─────────────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px" }}>
        <div style={{ background: "#fff", borderRadius: "14px", padding: "20px", border: "1px solid var(--color-border, #E4E7EC)", boxShadow: "var(--shadow-sm)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ width: "38px", height: "38px", borderRadius: "10px", background: "rgba(239, 68, 68, 0.1)", display: "flex", alignItems: "center", justifyItems: "center", justifyContent: "center" }}>
              <ShieldAlert size={18} color="var(--color-danger, #EF4444)" />
            </div>
            <span style={{ fontSize: "12px", background: "#FEF2F2", color: "#EF4444", borderRadius: "6px", padding: "3px 6px", fontWeight: "700" }}>Critical SLA</span>
          </div>
          <div style={{ fontSize: "28px", fontWeight: "800", color: "var(--color-text, #0F172A)", marginTop: "12px" }}>{escalations.length}</div>
          <div style={{ fontSize: "13px", color: "var(--color-muted, #64748B)", marginTop: "2px", fontWeight: "500" }}>Active Escalations</div>
        </div>

        <div style={{ background: "#fff", borderRadius: "14px", padding: "20px", border: "1px solid var(--color-border, #E4E7EC)", boxShadow: "var(--shadow-sm)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ width: "38px", height: "38px", borderRadius: "10px", background: "rgba(99, 102, 241, 0.1)", display: "flex", alignItems: "center", justifyItems: "center", justifyContent: "center" }}>
              <Clock size={18} color="var(--color-primary, #6366F1)" />
            </div>
            <span style={{ fontSize: "12px", background: "#F5F3FF", color: "#6366F1", borderRadius: "6px", padding: "3px 6px", fontWeight: "700" }}>Live</span>
          </div>
          <div style={{ fontSize: "28px", fontWeight: "800", color: "var(--color-text, #0F172A)", marginTop: "12px" }}>&lt; 5m</div>
          <div style={{ fontSize: "13px", color: "var(--color-muted, #64748B)", marginTop: "2px", fontWeight: "500" }}>Average Response SLA</div>
        </div>

        <div style={{ background: "#fff", borderRadius: "14px", padding: "20px", border: "1px solid var(--color-border, #E4E7EC)", boxShadow: "var(--shadow-sm)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ width: "38px", height: "38px", borderRadius: "10px", background: "rgba(16, 185, 129, 0.1)", display: "flex", alignItems: "center", justifyItems: "center", justifyContent: "center" }}>
              <CheckCircle2 size={18} color="var(--color-success, #10B981)" />
            </div>
            <span style={{ fontSize: "12px", background: "#ECFDF5", color: "#10B981", borderRadius: "6px", padding: "3px 6px", fontWeight: "700" }}>99.2% Goal</span>
          </div>
          <div style={{ fontSize: "28px", fontWeight: "800", color: "var(--color-text, #0F172A)", marginTop: "12px" }}>100%</div>
          <div style={{ fontSize: "13px", color: "var(--color-muted, #64748B)", marginTop: "2px", fontWeight: "500" }}>SLA Compliance</div>
        </div>
      </div>

      {/* ── Main Queue Content ─────────────────────────────── */}
      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        
        {loading && (
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {[1, 2, 3].map((i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        )}

        {error && <div className="alert alert-error">{error}</div>}

        {!loading && escalations.length === 0 && (
          <div style={{
            background: "#fff",
            borderRadius: "16px",
            border: "1px dashed var(--color-border, #CBD5E1)",
            padding: "48px 24px",
            textAlign: "center",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: "12px"
          }}>
            <div style={{
              width: "56px",
              height: "56px",
              borderRadius: "50%",
              background: "#ECFDF5",
              color: "var(--color-success, #10B981)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center"
            }}>
              <CheckCircle2 size={26} />
            </div>
            <h3 style={{ fontSize: "18px", fontWeight: "700", color: "var(--color-text, #0F172A)", margin: 0 }}>
              All caught up!
            </h3>
            <p style={{ fontSize: "14px", color: "var(--color-muted, #64748B)", margin: 0, maxWidth: "320px", lineHeight: "1.5" }}>
              There are no pending escalated chats in the queue. All tickets and sessions are cleared.
            </p>
          </div>
        )}

        {!loading && escalations.map((esc) => (
          <div 
            key={esc.id} 
            style={{
              padding: "24px",
              borderRadius: "16px",
              border: "1px solid var(--color-border, #E4E7EC)",
              borderLeft: "5px solid var(--color-warning, #F59E0B)",
              background: "#ffffff",
              display: "flex",
              flexDirection: "column",
              gap: "16px",
              boxShadow: "var(--shadow-sm)",
              transition: "transform 0.2s ease, box-shadow 0.2s ease",
            }}
            onMouseEnter={e => {
              e.currentTarget.style.transform = "translateY(-2px)";
              e.currentTarget.style.boxShadow = "var(--shadow-md)";
              e.currentTarget.style.borderColor = "var(--color-primary, #6366F1)";
            }}
            onMouseLeave={e => {
              e.currentTarget.style.transform = "none";
              e.currentTarget.style.boxShadow = "var(--shadow-sm)";
              e.currentTarget.style.borderColor = "var(--color-border, #E4E7EC)";
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "12px" }}>
              <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                <div style={{ width: "40px", height: "40px", borderRadius: "50%", background: "#FFFBEB", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <AlertTriangle size={18} color="var(--color-warning, #F59E0B)" />
                </div>
                <div>
                  <div style={{ fontWeight: "700", fontSize: "15px", color: "var(--color-text, #0F172A)" }}>
                    {esc.reason}
                  </div>
                  <div style={{ display: "flex", gap: "12px", marginTop: "4px", fontSize: "12.5px", color: "var(--color-muted, #64748B)" }}>
                    <span>Chat ID: <code style={{ background: "#F1F5F9", padding: "2px 6px", borderRadius: "4px" }}>{esc.chat_id}</code></span>
                    <span>Ticket: <code style={{ background: "#F1F5F9", padding: "2px 6px", borderRadius: "4px" }}>#{esc.ticket_id}</code></span>
                  </div>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", color: "var(--color-muted, #64748B)", fontWeight: "500" }}>
                <Clock size={13} /> {formatDate(esc.created_at)}
              </div>
            </div>

            {esc.note && (
              <div style={{ background: "#F8FAFC", borderRadius: "10px", padding: "12px 16px", border: "1px solid var(--color-border, #E2E8F0)", fontSize: "13.5px", color: "#475569" }}>
                <span style={{ fontWeight: "700", color: "#334155", display: "block", fontSize: "11px", textTransform: "uppercase", marginBottom: "4px" }}>
                  Agent Notes
                </span>
                {esc.note}
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", flexWrap: "wrap", borderTop: "1px solid #F1F5F9", paddingTop: "16px" }}>
              <Link to={`/tickets/${esc.ticket_id}`} className="cd-btn cd-btn--ghost" style={{ fontSize: "13px", padding: "8px 14px" }}>
                View Ticket →
              </Link>
              <button 
                onClick={() => openResolveModal(esc.chat_id)} 
                className="cd-btn cd-btn--ghost" 
                style={{ fontSize: "13px", padding: "8px 14px", border: "1.5px solid var(--color-success, #10B981)", color: "var(--color-success, #166534)" }}
              >
                Resolve Case
              </button>
              <button 
                onClick={() => handleTakeover(esc.chat_id)} 
                className="cd-btn cd-btn--primary" 
                style={{ fontSize: "13px", padding: "8px 16px" }}
              >
                🙋 Take Over Case
              </button>
            </div>

          </div>
        ))}
      </div>

      {/* ── Resolve Modal Overlay ──────────────────────────── */}
      {isResolveModalOpen && (
        <div style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: "rgba(15, 23, 42, 0.45)",
          backdropFilter: "blur(5px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 100000,
          animation: "fadeIn 0.2s ease-out"
        }}>
          <div style={{
            background: "#ffffff",
            borderRadius: "16px",
            width: "100%",
            maxWidth: "480px",
            boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.15), 0 10px 10px -5px rgba(0, 0, 0, 0.04)",
            overflow: "hidden",
            animation: "slideUp 0.25s cubic-bezier(0.16, 1, 0.3, 1)"
          }}>
            {/* Modal Header */}
            <div style={{ padding: "20px 24px", borderBottom: "1px solid #E2E8F0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ margin: 0, fontSize: "17px", fontWeight: "800", color: "#0F172A" }}>
                Resolve Escalated Case
              </h3>
              <button 
                onClick={closeResolveModal} 
                style={{ background: "none", border: "none", cursor: "pointer", color: "var(--color-muted, #94A3B8)" }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleResolveSubmit}>
              <div style={{ padding: "24px", display: "flex", flexDirection: "column", gap: "14px" }}>
                <p style={{ margin: 0, fontSize: "13.5px", color: "var(--color-muted, #64748B)", lineHeight: "1.5" }}>
                  Provide a summary or note about how this escalated case was resolved. This will be logged on the ticket history.
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  <label htmlFor="modalNote" style={{ fontSize: "12.5px", fontWeight: "600", color: "#374151" }}>
                    Resolution Note (optional)
                  </label>
                  <textarea
                    id="modalNote"
                    rows={4}
                    value={resolutionNote}
                    onChange={(e) => setResolutionNote(e.target.value)}
                    placeholder="Describe how the customer was helped or how the system issue was addressed..."
                    style={{
                      width: "100%",
                      padding: "10px 12px",
                      borderRadius: "8px",
                      border: "1.5px solid var(--color-border, #CBD5E1)",
                      outline: "none",
                      fontFamily: "inherit",
                      fontSize: "14px",
                      resize: "vertical"
                    }}
                  />
                </div>
              </div>

              {/* Modal Footer */}
              <div style={{ padding: "16px 24px", background: "#F8FAFC", borderTop: "1px solid #E2E8F0", display: "flex", justifyContent: "flex-end", gap: "10px" }}>
                <button 
                  type="button" 
                  onClick={closeResolveModal} 
                  className="cd-btn cd-btn--ghost"
                  disabled={submittingResolve}
                  style={{ fontSize: "13px", padding: "8px 14px" }}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="cd-btn cd-btn--primary"
                  disabled={submittingResolve}
                  style={{ fontSize: "13px", padding: "8px 16px", background: "var(--color-success, #10B981)" }}
                >
                  {submittingResolve ? "Resolving..." : "Mark Resolved"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Embedded CSS for Modal Animations */}
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideUp {
          from { transform: translateY(20px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
      `}</style>

    </div>
  );
}
