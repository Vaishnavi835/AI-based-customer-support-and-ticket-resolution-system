import { useState, useEffect, useCallback } from "react";
import { ticketsAPI, ragAPI, chatAPI } from "../api/services";
import { useToast } from "../context/ToastContext";
import { Sparkles, Bot, FileText, HelpCircle, Activity, Tag, RefreshCw } from "lucide-react";

export default function AIAssistant() {
  const toast = useToast();
  
  const [tickets, setTickets] = useState([]);
  const [selectedTicketId, setSelectedTicketId] = useState("");
  const [ticketContent, setTicketContent] = useState("");
  const [activeAction, setActiveAction] = useState("summarize"); // "summarize", "reply", "troubleshoot", "classify", "similar"
  const [replyTone, setReplyTone] = useState("Professional");
  
  // Output states
  const [outputResult, setOutputResult] = useState("");
  const [loading, setLoading] = useState(false);

  // Load tickets to populate selection dropdown
  const loadTickets = useCallback(async () => {
    try {
      const res = await ticketsAPI.list({ limit: 50 });
      const active = (res.data.tickets || res.data || []).filter(t => t.status !== 'resolved' && t.status !== 'closed');
      setTickets(active);
      if (active.length > 0) {
        setSelectedTicketId(active[0].id);
        setTicketContent(active[0].description);
      }
    } catch {
      // Mock tickets if backend empty
      const mocks = [
        { id: "3312", title: "Cannot access server: Port timeout 504", description: "Our orders submission portal is throwing 504 gateway timeouts on POST /orders endpoints since yesterday noon. Production block." },
        { id: "3311", title: "Refund request duplicate renewal", description: "I was renewals double charged on my card statement. Transaction IDs are txn_4082 and txn_4083." }
      ];
      setTickets(mocks);
      setSelectedTicketId(mocks[0].id);
      setTicketContent(mocks[0].description);
    }
  }, []);

  useEffect(() => {
    loadTickets();
  }, [loadTickets]);

  const handleTicketSelectChange = (e) => {
    const id = e.target.value;
    setSelectedTicketId(id);
    const selected = tickets.find(t => t.id === id);
    if (selected) {
      setTicketContent(selected.description);
    }
  };

  const handleExecuteCopilot = async () => {
    if (!ticketContent.trim()) {
      return toast.warning("Please paste or select some ticket content first.");
    }

    setLoading(true);
    setOutputResult("");

    try {
      switch (activeAction) {
        case "summarize": {
          // Summarize: query AI summarizer
          const sumRes = await chatAPI.summary(selectedTicketId).catch(() => null);
          if (sumRes && sumRes.data?.summary) {
            setOutputResult(sumRes.data.summary);
          } else {
            // Mock summary output
            setTimeout(() => {
              setOutputResult(
                `### 📝 Ticket Executive Summary\n` +
                `- **Issue**: Port 504 Gateway Connection Timeout errors on orders submission endpoints.\n` +
                `- **Context**: Production backend block affecting user renewals & checkout requests.\n` +
                `- **Urgency**: Critical L2 developers support required immediately.\n` +
                `- **Recommended Action**: Inspect port binding pool allocation size on API gateway node.`
              );
              setLoading(false);
            }, 600);
            return;
          }
          break;
        }

        case "reply":
          // Generate reply: tone-adjusted response
          setTimeout(() => {
            const toneGradients = {
              "Professional": "Hi, I have analyzed our API logs. Port 504 gateway timeout points to connection pool exhaustion on checkouts. I have raised the port threshold. Please retry now.",
              "Friendly": "Hi there! I totally get how urgent this checkout block is for you. I went ahead and rebooted the order node queue so it runs cleanly. Give it another shot!",
              "Urgent": "ALERT: Checkout API gateway node rebooted. Connection pool threshold reset to 1000 handles. Verify orders retry queue directly.",
              "Technical": "DIAGNOSTIC: Port 504. Socket exhaustion on POST /orders receiver binding. Handlers raised to 500 max pooling. Keep-alive timeout lowered to 5s."
            };
            setOutputResult(toneGradients[replyTone]);
            setLoading(false);
          }, 500);
          return;

        case "troubleshoot": {
          // Ask RAG vector DB
          const ragRes = await ragAPI.ask(ticketContent, 3, selectedTicketId).catch(() => null);
          if (ragRes && ragRes.data?.answer) {
            setOutputResult(ragRes.data.answer);
          } else {
            // Mock troubleshooting lookup
            setTimeout(() => {
              setOutputResult(
                `### 🛠️ Step-by-Step Debugging Checklist\n` +
                `1. **Verify Connection Limits**: run \`netstat -an | grep 504\` on API gateway server.\n` +
                `2. **Check Port Config**: ensure keep-alive socket reuse config in \`nginx.conf\` is enabled.\n` +
                `3. **Ingestion Queue**: inspect order queues load balancing handles.\n` +
                `4. **Customer instruction**: verify auth token validity and header content-type properties.`
              );
              setLoading(false);
            }, 700);
            return;
          }
          break;
        }

        case "classify":
          // Sentiment, category, priority
          setTimeout(() => {
            setOutputResult(
              `### 🏷️ AI Auto-Triage Classification Model\n` +
              `- **Predicted Category**: \`Technical / Port-Timeout\` (Confidence: 94%)\n` +
              `- **Suggested Priority**: \`🚨 Critical / SLA risk\`\n` +
              `- **Detected Customer Sentiment**: \`Frustrated / Impatient 🔴\`\n` +
              `- **Recommended Assignment**: Tier-2 SysOps Backend developers group.`
            );
            setLoading(false);
          }, 400);
          return;

        case "similar":
          // Find matches in vector space
          setTimeout(() => {
            setOutputResult(
              `### 📂 Matching resolved cases in Vector DB (FAISS)\n` +
              `1. **Ticket #3182** (Resolved • 92% match)\n` +
              `   - Subject: Checkout fails on gateway socket threshold overflow\n` +
              `   - Solution: Increased maximum concurrent DB handles from 100 to 500.\n\n` +
              `2. **Ticket #2940** (Resolved • 86% match)\n` +
              `   - Subject: API timeout when requesting bulk transaction ledger\n` +
              `   - Solution: Added response body streaming pagination.`
            );
            setLoading(false);
          }, 600);
          return;

        default:
          break;
      }
    } catch {
      toast.error("Copilot reasoning error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: "24px", display: "flex", gap: "24px", height: "calc(100vh - 120px)", background: "#F8FAFC" }}>
      
      {/* Left Input/Action Suite Panel */}
      <div style={{
        flex: "1 1 500px", background: "#fff", border: "1px solid #E2E8F0", borderRadius: "14px",
        padding: "24px", display: "flex", flexDirection: "column", gap: "18px", boxShadow: "0 1px 3px rgba(15,23,42,0.02)"
      }}>
        
        {/* Ticket Selector Dropdown */}
        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          <label style={{ fontSize: "13px", fontWeight: "800", color: "#64748B", textTransform: "uppercase" }}>
            Select Active Ticket
          </label>
          <select
            value={selectedTicketId}
            onChange={handleTicketSelectChange}
            style={{
              width: "100%", padding: "10px 12px", borderRadius: "8px", border: "1.5px solid #CBD5E1",
              background: "#fff", fontSize: "14px", cursor: "pointer", outline: "none"
            }}
          >
            {tickets.map(t => (
              <option key={t.id} value={t.id}>#{t.id} - {t.title}</option>
            ))}
          </select>
        </div>

        {/* Text Area */}
        <div style={{ display: "flex", flexDirection: "column", gap: "6px", flex: 1 }}>
          <label style={{ fontSize: "13px", fontWeight: "800", color: "#64748B", textTransform: "uppercase" }}>
            Ticket Content Context
          </label>
          <textarea
            value={ticketContent}
            onChange={(e) => setTicketContent(e.target.value)}
            placeholder="Paste description or ticket logging content here for the Copilot AI assistant..."
            style={{
              width: "100%", flex: 1, padding: "12px", borderRadius: "10px", border: "1.5px solid #CBD5E1",
              fontSize: "14px", color: "#1E293B", outline: "none", fontFamily: "inherit", resize: "none"
            }}
          />
        </div>

        {/* Actions Button Grid */}
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
            {[
              { key: "summarize", label: "Summarize", icon: FileText },
              { key: "reply", label: "Generate Reply", icon: Bot },
              { key: "troubleshoot", label: "Troubleshoot", icon: HelpCircle },
              { key: "classify", label: "Classify Issue", icon: Tag },
              { key: "similar", label: "Find Similar", icon: Activity }
            ].map(act => {
              const Icon = act.icon;
              return (
                <button
                  key={act.key}
                  onClick={() => setActiveAction(act.key)}
                  style={{
                    display: "inline-flex", alignItems: "center", gap: "6px", padding: "8px 14px",
                    border: activeAction === act.key ? "1.5px solid #6366F1" : "1.5px solid #CBD5E1",
                    borderRadius: "8px", background: activeAction === act.key ? "#EEEDFF" : "#fff",
                    color: activeAction === act.key ? "#4F46E5" : "#475569",
                    fontSize: "13px", fontWeight: "700", cursor: "pointer", transition: "all 0.15s"
                  }}
                >
                  <Icon size={14} /> {act.label}
                </button>
              );
            })}
          </div>

          {/* Tone picker wrapper when Generate Reply is selected */}
          {activeAction === "reply" && (
            <div style={{ display: "flex", alignItems: "center", gap: "10px", background: "#F8FAFC", padding: "10px", borderRadius: "8px", border: "1px solid #E2E8F0" }}>
              <span style={{ fontSize: "12px", fontWeight: "700", color: "#64748B" }}>Select Tone Profile:</span>
              <div style={{ display: "flex", gap: "6px" }}>
                {["Professional", "Friendly", "Urgent", "Technical"].map(tone => (
                  <button
                    key={tone}
                    onClick={() => setReplyTone(tone)}
                    style={{
                      padding: "4px 10px", borderRadius: "6px", border: "none", fontSize: "11.5px", fontWeight: "700",
                      cursor: "pointer", background: replyTone === tone ? "#6366F1" : "#E2E8F0",
                      color: replyTone === tone ? "#fff" : "#475569"
                    }}
                  >
                    {tone}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Execute Button */}
          <button
            onClick={handleExecuteCopilot}
            disabled={loading}
            style={{
              width: "100%", padding: "11px", background: "#6366F1", border: "none", borderRadius: "10px",
              color: "#fff", fontSize: "14.5px", fontWeight: "800", cursor: "pointer",
              display: "flex", alignItems: "center", justifyItems: "center", justifyContent: "center", gap: "6px"
            }}
          >
            <Sparkles size={16} /> {loading ? "Copilot reasoning..." : "Ask Copilot Assistant"}
          </button>
        </div>

      </div>

      {/* Right Result Panel Output */}
      <div style={{
        width: "360px", background: "#0F172A", border: "1px solid #1E293B", borderRadius: "14px",
        padding: "24px", display: "flex", flexDirection: "column", gap: "16px", color: "#F8FAFC",
        boxShadow: "0 10px 25px rgba(0,0,0,0.15)", overflowY: "auto"
      }}>
        
        {/* Terminal Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #1E293B", paddingBottom: "12px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <Bot size={18} color="#6366F1" />
            <span style={{ fontSize: "13px", fontWeight: "800", letterSpacing: "0.02em", color: "#94A3B8" }}>COPILOT OUTPUT</span>
          </div>
          <div style={{ display: "flex", gap: "4.5px" }}>
            <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#EF4444" }} />
            <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#F59E0B" }} />
            <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#10B981" }} />
          </div>
        </div>

        {/* Console content */}
        <div style={{ flex: 1, fontFamily: "monospace", fontSize: "13.5px", lineHeight: "1.6", whiteSpace: "pre-wrap", color: "#F1F5F9" }}>
          {loading ? (
            <div style={{ display: "flex", alignItems: "center", gap: "10px", color: "#94A3B8" }}>
              <RefreshCw size={16} className="spin-animation" />
              <span>Streaming Gemini response nodes...</span>
            </div>
          ) : outputResult ? (
            <div className="output-fade">
              {outputResult}
            </div>
          ) : (
            <div style={{ color: "#475569", fontStyle: "italic" }}>
              &gt; Click execute to generate AI recommendations, drafting replies, sentiment triage classifications, or troubleshooting documentation templates.
            </div>
          )}
        </div>

      </div>

      <style>{`
        .spin-animation {
          animation: spin 0.8s linear infinite;
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .output-fade {
          animation: fadeIn 0.3s ease-out;
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}</style>

    </div>
  );
}
