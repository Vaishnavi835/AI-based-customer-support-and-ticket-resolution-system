import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ticketsAPI, chatAPI, escalationAPI, usersAPI } from "../api/services";
import { useAuth } from "../context/AuthContext";
import { useWebSocketEvent } from "../context/WebSocketContext";
import { SkeletonCard, SkeletonChatBubble } from "../components/SkeletonCard";
import { Send, AlertCircle, CheckCircle, Clock, ShieldAlert, ArrowLeft, Bot, Sparkles, User, Tag, BarChart3, Activity, AtSign } from "lucide-react";
import { useToast } from "../context/ToastContext";


/**
 * TypewriterText
 * ==============
 * Renders text incrementally to simulate real-time typing/streaming.
 * Includes a terminal cursor.
 */
function TypewriterText({ text, speed = 12, onComplete }) {
  const [displayedText, setDisplayedText] = useState("");
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    if (currentIndex < text.length) {
      const timeout = setTimeout(() => {
        setDisplayedText((prev) => prev + text.charAt(currentIndex));
        setCurrentIndex((prev) => prev + 1);
      }, speed);
      return () => clearTimeout(timeout);
    } else if (onComplete) {
      onComplete();
    }
  }, [currentIndex, text, speed, onComplete]);

  return (
    <span>
      {displayedText}
      {currentIndex < text.length && <span className="typewriter-cursor" />}
    </span>
  );
}

/* ── Helper: derive AI confidence from ticket data ─────────────── */
const getAIConfidence = (ticket) => {
  if (!ticket) return 72;
  const cat = (ticket.category || "").toLowerCase();
  const title = (ticket.title || "").toLowerCase();
  if (cat.includes("bill") || title.includes("refund") || title.includes("payment")) return 96;
  if (cat.includes("tech") || title.includes("api") || title.includes("server")) return 93;
  if (cat.includes("general") || title.includes("help")) return 89;
  return 91;
};

const getResolutionSteps = (category) => {
  const cat = (category || "").toLowerCase();
  if (cat.includes("bill") || cat.includes("pay")) {
    return [
      "Verify billing transaction logs & transaction ID.",
      "Check account ledger for double-billing / duplicate charges.",
      "Verify credentials match user profile bank zip records.",
      "Initiate merchant refund protocol if double charge confirmed."
    ];
  }
  if (cat.includes("tech") || cat.includes("api") || cat.includes("server") || cat.includes("bug")) {
    return [
      "Confirm user auth headers are structured correctly ('Bearer <token>').",
      "Inspect webhook retry logs and API delivery payloads.",
      "Verify server console output logs for client request trace ID.",
      "Instruct customer to perform cache flush or local storage purge."
    ];
  }
  if (cat.includes("account") || cat.includes("login") || cat.includes("profile") || cat.includes("user")) {
    return [
      "Verify password attempt failure thresholds and lockout status.",
      "Send secure email verification / password reset validation link.",
      "Inspect active sessions device list for geographical anomalies.",
      "Validate user group permissions & database access controls."
    ];
  }
  return [
    "Review related Knowledge Base policy documents.",
    "Request clear issue reproduction steps or screenshot file.",
    "Check backend service telemetry and service health dashboards.",
    "Prepare case escalation briefing details if L2 routing is required."
  ];
};

const getAITriageDetails = (ticket) => {
  if (!ticket) return { sentiment: "Neutral", keywords: ["general"], routing: "L1 Support Queue" };
  const cat = (ticket.category || "").toLowerCase();
  const desc = (ticket.description || "").toLowerCase();
  const title = (ticket.title || "").toLowerCase();
  
  let sentiment = "Inquisitive / Neutral";
  let keywords = ["ticket"];
  let routing = "General Support Queue";
  
  if (ticket.priority === "critical" || ticket.priority === "high") {
    sentiment = "Urgent / Frustrated 🔴";
  } else if (ticket.priority === "medium") {
    sentiment = "Concerned / Neutral 🟡";
  } else {
    sentiment = "Polite / Patient 🟢";
  }
  
  if (cat.includes("bill") || title.includes("refund") || title.includes("payment") || desc.includes("charge")) {
    keywords = ["billing", "payment", "transaction", "invoice"];
    routing = "Automated Billing Autopilot";
  } else if (cat.includes("tech") || title.includes("api") || title.includes("server") || desc.includes("error")) {
    keywords = ["api", "server", "authentication", "webhooks"];
    routing = "Technical Specialist Tier-2";
  } else if (cat.includes("account") || title.includes("login") || title.includes("password") || desc.includes("password")) {
    keywords = ["login", "credentials", "account-access", "security"];
    routing = "Account Access Autopilot";
  } else {
    keywords = ["inquiry", "general-info", "support"];
    routing = "General L1 Router";
  }
  
  return { sentiment, keywords, routing };
};



export default function TicketDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const toast = useToast();

  const [ticket, setTicket]     = useState(null);
  const [chats, setChats]       = useState([]);
  const [message, setMessage]   = useState("");
  const [loading, setLoading]   = useState(true);
  const [sending, setSending]   = useState(false);
  const [agents, setAgents]     = useState([]);
  const [selectedAgent, setSelectedAgent] = useState("");
  const [lastResponseToType, setLastResponseToType] = useState(null);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const loadData = useCallback(() => {
    Promise.all([
      ticketsAPI.get(id),
      chatAPI.getHistory(id).catch(() => ({ data: [] })),
      user.role !== 'customer' ? usersAPI.list().catch(() => ({ data: [] })) : Promise.resolve({ data: [] }),
    ])
      .then(([ticketRes, chatRes, usersRes]) => {
        setTicket(ticketRes.data);
        setChats(chatRes.data || []);
        if (usersRes.data) {
          setAgents(usersRes.data.filter(u => u.role === 'support_agent' || u.role === 'admin'));
        }
        scrollToBottom();
      })
      .catch((err) => {
        console.error("Failed to load ticket", err);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [id, user.role]);

  useEffect(() => { loadData(); }, [loadData]);

  // Listen to live chat message/interaction updates
  useWebSocketEvent("chat_updated", (data) => {
    if (data.ticket_id === id) {
      loadData();
    }
  });

  // Listen to live ticket updates (status, priority, etc.)
  useWebSocketEvent("ticket_updated", (data) => {
    if (data.ticket && data.ticket.id === id) {
      loadData();
    }
  });

  const handleSend = async () => {
    if (!message.trim() || sending) return;
    setSending(true);
    try {
      let chatId = chats.length > 0 ? chats[0].id : null;
      let res;
      if (!chatId) {
        // Start a new chat session on this ticket
        res = await chatAPI.start(id, message);
      } else {
        // Append message to existing chat session
        res = await chatAPI.sendMessage(chatId, message);
      }
      
      setMessage("");
      if (res.data?.ai_response) {
        setLastResponseToType(res.data.ai_response);
      }
      await loadData();
    } catch (err) {
      console.error("Failed to send message", err);
    } finally {
      setSending(false);
    }
  };

  const handleStatusChange = async (newStatus) => {
    try {
      await ticketsAPI.update(id, { status: newStatus });
      toast.success(`Ticket status updated to ${newStatus}`);
      await loadData();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Cannot change status");
    }
  };

  const handleApplyResolution = async () => {
    try {
      await ticketsAPI.update(id, { status: "resolved" });
      toast.success("Resolution applied successfully! Ticket resolved.");
      await loadData();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to resolve ticket");
    }
  };

  const handleTakeover = async () => {
    if (chats.length === 0) return;
    try {
      await escalationAPI.takeover(chats[0].id);
      await loadData();
    } catch (err) {
      alert(err.response?.data?.detail || "Takeover failed");
    }
  };

  const handleAddCC = async () => {
    if (!selectedAgent) return;
    try {
      await ticketsAPI.addCC(id, selectedAgent);
      setSelectedAgent("");
      await loadData();
    } catch (err) {
      alert(err.response?.data?.detail || "Cannot add CC");
    }
  };

  const handleRemoveCC = async (agentId) => {
    try {
      await ticketsAPI.removeCC(id, agentId);
      await loadData();
    } catch (err) {
      alert(err.response?.data?.detail || "Cannot remove CC");
    }
  };

  if (loading) return (
    <div className="cd-page" style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Skeleton Topbar */}
      <div style={{ padding: '16px 32px', background: '#fff', borderBottom: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', gap: '16px', flexShrink: 0 }}>
        <div className="skeleton-shimmer skeleton-avatar" style={{ width: '24px', height: '24px' }} />
        <div style={{ flex: 1 }}>
          <div className="skeleton-shimmer skeleton-title" style={{ margin: 0, width: '240px', height: '20px' }} />
          <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
            <div className="skeleton-shimmer skeleton-block" style={{ width: '80px', height: '16px', borderRadius: '4px' }} />
            <div className="skeleton-shimmer skeleton-block" style={{ width: '60px', height: '16px', borderRadius: '4px' }} />
          </div>
        </div>
      </div>
      
      {/* Skeleton Main Grid */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Left message thread skeleton */}
        <div style={{ flex: 1, padding: '24px 32px', display: 'flex', flexDirection: 'column', gap: '16px', background: '#F8FAFC', overflowY: 'auto' }}>
          <SkeletonChatBubble isSelf={false} />
          <SkeletonChatBubble isSelf={true} />
          <SkeletonChatBubble isSelf={false} />
        </div>
        
        {/* Right sidebar skeleton */}
        <div style={{ width: '320px', background: '#ffffff', borderLeft: '1px solid #E2E8F0', padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div className="skeleton-shimmer skeleton-title" style={{ width: '50%', height: '16px' }} />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      </div>
    </div>
  );
  if (!ticket) return <div className="cd-page" style={{ padding: '32px' }}><p>Ticket not found</p></div>;

  // Flatten the conversation messages for simple, chronological display
  const allMessages = [];

  // 1. Initial description as the starting customer turn
  allMessages.push({
    id: "init",
    role: "customer",
    name: ticket.user_name || "Customer",
    content: ticket.description,
    timestamp: ticket.created_at,
    isInitial: true
  });

  // 2. Add all historical chat turns
  chats.forEach((chat) => {
    if (chat.messages) {
      chat.messages.forEach((msg, idx) => {
        const timeVal = msg.timestamp || chat.created_at;
        if (msg.prompt) {
          allMessages.push({
            id: `prompt-${chat.id}-${idx}`,
            role: "customer",
            name: ticket.user_name || "Customer",
            content: msg.prompt,
            timestamp: timeVal,
          });
        }
        if (msg.response) {
          allMessages.push({
            id: `response-${chat.id}-${idx}`,
            role: msg.agent_id ? "agent" : "ai",
            name: msg.agent_id ? "Support Agent" : "AI Assistant",
            content: msg.response,
            timestamp: timeVal,
            agent_id: msg.agent_id,
            rag_used: msg.rag_used,
            sources: msg.sources,
          });
        }
      });
    }
  });

  const confidence = getAIConfidence(ticket);
  const statusColorMap = {
    open:      { label: "🟢 Open", bg: "#EFF6FF", text: "#1E40AF", border: "#BFDBFE" },
    pending:   { label: "🟡 Pending", bg: "#FEF3C7", text: "#92400E", border: "#FDE68A" },
    escalated: { label: "🔴 Escalated", bg: "#FEE2E2", text: "#991B1B", border: "#FCA5A5" },
    resolved:  { label: "✅ Resolved", bg: "#ECFDF5", text: "#065F46", border: "#A7F3D0" },
    closed:    { label: "⏹ Closed", bg: "#F3F4F6", text: "#374151", border: "#E5E7EB" },
  };
  const priorityColorMap = {
    high: { bg: '#FEE2E2', text: '#DC2626', border: '#FCA5A5' },
    medium: { bg: '#FEF3C7', text: '#D97706', border: '#FDE68A' },
    low: { bg: '#F3F4F6', text: '#6B7280', border: '#D1D5DB' },
  };

  const statusColors = statusColorMap[ticket.status] || statusColorMap.open;
  const priorityColors = priorityColorMap[ticket.priority] || priorityColorMap.low;

  return (
    <div className="cd-page td-page" style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* ═══ COMPACT TICKET HEADER BAR ═══════════════════════════ */}
      <div className="td-header">
        <div className="td-header__left">
          <button onClick={() => navigate(-1)} className="td-header__back" title="Go back">
            <ArrowLeft size={18} />
          </button>
          <div className="td-header__id">
            #TKT-{ticket.id?.slice(0, 8).toUpperCase()}
          </div>
          <h1 className="td-header__title">
            {ticket.title ? ticket.title.charAt(0).toUpperCase() + ticket.title.slice(1) : "Untitled Ticket"}
          </h1>
        </div>
        <div className="td-header__badges">
          <span className="td-badge" style={{ background: statusColors.bg, color: statusColors.text, border: `1px solid ${statusColors.border}`, textTransform: 'none' }}>
            {statusColors.label}
          </span>
          <span className="td-badge" style={{ background: priorityColors.bg, color: priorityColors.text, border: `1px solid ${priorityColors.border}` }}>
            {ticket.priority} priority
          </span>
          {ticket.category && (
            <span className="td-badge" style={{ background: '#F5F3FF', color: '#7C3AED', border: '1px solid #E9D5FF' }}>
              {ticket.category}
            </span>
          )}

          {/* Action Buttons for Agents/Admins */}
          {user.role !== "customer" && (
            <div className="td-header__actions">
              {ticket.status === 'escalated' && chats.length > 0 && !chats[0].agent_id && (
                <button onClick={handleTakeover} className="td-action-btn td-action-btn--blue">
                  <Bot size={14} /> Takeover
                </button>
              )}
              {ticket.status !== 'resolved' && (
                <button onClick={() => handleStatusChange("resolved")} className="td-action-btn td-action-btn--green">
                  <CheckCircle size={14} /> Resolve
                </button>
              )}
              {ticket.status !== 'escalated' && ticket.status !== 'resolved' && (
                <button onClick={() => handleStatusChange("escalated")} className="td-action-btn td-action-btn--red">
                  <ShieldAlert size={14} /> Escalate
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ═══ MAIN CONTENT AREA (Chat + Detail Panel) ═══════════════ */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        
        {/* Chat Thread Area */}
        <div className="td-chat-area">
          
          <div className="td-chat-scroll">
            
            {allMessages.map((msg, index) => {
              const isCustomer = msg.role === "customer";
              const isSelf = user.role === "customer" ? isCustomer : (!isCustomer && msg.role !== "ai");
              const isAi = msg.role === "ai";
              const isAgent = msg.role === "agent";
              const isLastMessage = index === allMessages.length - 1;

              const rowClass = isSelf ? "chat-row chat-row--self" : "chat-row chat-row--other";
              
              let bubbleClass = "chat-bubble";
              if (isSelf) {
                bubbleClass += " chat-bubble--self";
              } else if (isAi) {
                bubbleClass += " chat-bubble--ai";
              } else {
                bubbleClass += " chat-bubble--other";
              }

              let avatarClass = "chat-avatar";
              let avatarInitials = "CU";
              let avatarIcon = null;

              if (isCustomer) {
                avatarClass += " chat-avatar--customer";
                avatarInitials = msg.name ? msg.name.substring(0, 2).toUpperCase() : "CU";
              } else if (isAgent) {
                avatarClass += " chat-avatar--agent";
                avatarInitials = "AG";
              } else {
                avatarClass += " chat-avatar--ai";
                avatarIcon = <Sparkles size={14} />;
              }

              const timeStr = msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "";
              const senderLabel = isSelf ? "You" : isAi ? "AI Assistant" : isAgent ? "Support Agent" : (msg.name || "Customer");

              return (
                <div key={msg.id} style={{ width: '100%' }}>
                  <div className={rowClass}>
                    <div className="chat-avatar-wrapper">
                      <div className={avatarClass}>
                        {avatarIcon || avatarInitials}
                      </div>
                    </div>
                    
                    <div style={{ display: "flex", flexDirection: "column", maxWidth: "85%", alignItems: isSelf ? "flex-end" : "flex-start", width: isAi ? '100%' : 'auto' }}>
                      {/* Sender label above bubble */}
                      <div className={`chat-meta ${isSelf ? "chat-meta--self" : ""}`}>
                        <span className="td-sender-label">{senderLabel}</span>
                      </div>
                      
                      <div 
                        className={bubbleClass} 
                        style={isAi ? {
                          width: '100%',
                          background: 'linear-gradient(135deg, #FAF5FF 0%, #F5F3FF 100%)',
                          border: '1.5px solid #E9D5FF',
                          borderRadius: '16px',
                          boxShadow: '0 4px 12px rgba(139, 92, 246, 0.05)',
                          padding: '16px 20px',
                          position: 'relative',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '4px'
                        } : { width: 'fit-content' }}
                      >
                        {isAi ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', width: '100%', textAlign: 'left' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: '700', fontSize: '13px', color: '#6B21A8' }}>
                              <span>🤖 AI Assistant</span>
                            </div>
                            <div style={{ height: '1px', background: '#E9D5FF', margin: '4px 0' }} />
                            <div style={{ fontSize: '14.5px', color: '#4C1D95', lineHeight: '1.5' }}>
                              {isLastMessage && lastResponseToType === msg.content ? (
                                <TypewriterText 
                                  key={msg.content}
                                  text={msg.content} 
                                  onComplete={() => {
                                    setLastResponseToType(null);
                                    scrollToBottom();
                                  }} 
                                />
                              ) : (
                                <span>{msg.content}</span>
                              )}
                            </div>
                          </div>
                        ) : (
                          <span>{msg.content}</span>
                        )}
                        
                        {isAi && msg.rag_used && msg.sources && msg.sources.length > 0 && (
                          <div className="td-rag-source">
                            <div className="td-rag-source__label">📚 Source Used</div>
                            <div className="td-rag-source__title">{msg.sources[0].title}</div>
                            <div className="td-rag-source__meta">Category: {msg.sources[0].category}</div>
                          </div>
                        )}

                        {timeStr && <span className="chat-bubble-time">{timeStr}</span>}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Bouncing typing dots while waiting for the response */}
            {sending && (
              <div className="chat-row chat-row--other">
                <div className="chat-avatar-wrapper">
                  <div className="chat-avatar chat-avatar--ai">
                    <Sparkles size={14} />
                  </div>
                </div>
                <div style={{ display: "flex", flexDirection: "column" }}>
                  <div className="chat-meta chat-meta--ai" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span>AI Assistant</span>
                    <span className="chat-meta-time">Thinking...</span>
                  </div>
                  <div className="typing-bubble">
                    <div className="typing-dots">
                      <span />
                      <span />
                      <span />
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Escalation notice banner */}
          {ticket.status === 'escalated' && chats.length > 0 && (
            <div className="td-escalation-banner">
              <div className="td-escalation-banner__icon" style={{ background: chats[0]?.agent_id ? '#3B82F6' : '#F59E0B' }}>
                {chats[0]?.agent_id ? <User size={18} /> : <ShieldAlert size={18} />}
              </div>
              <div className="td-escalation-banner__content">
                <h4>{chats[0]?.agent_id ? 'Support Agent Connected' : 'AI Assistant Paused'}</h4>
                <p>
                  {user.role === 'customer' 
                    ? (chats[0]?.agent_id 
                        ? 'A support agent is active in this chat and will respond to your messages.' 
                        : 'This ticket has been escalated. The AI assistant is paused, and your messages are queued for a human support agent.')
                    : (chats[0]?.agent_id 
                        ? `This escalated chat is currently claimed by you or another agent.`
                        : 'This ticket is escalated and pending. Please take over this chat to communicate with the customer.')}
                </p>
              </div>
              {user.role !== 'customer' && !chats[0]?.agent_id && (
                <button onClick={handleTakeover} className="td-action-btn td-action-btn--amber">
                  Takeover Chat
                </button>
              )}
            </div>
          )}

          {/* Reply Input Box */}
          {ticket.status !== 'resolved' && ticket.status !== 'closed' ? (
            <div className="td-reply-box">
              <div className="td-reply-box__input-row"
                   onFocus={(e) => e.currentTarget.style.borderColor = '#6366F1'}
                   onBlur={(e) => e.currentTarget.style.borderColor = '#E2E8F0'}>
                
                <button type="button" title="Attach file" className="td-reply-box__tool-btn"
                  onClick={() => alert("Attachment feature coming soon!")}>
                  <span style={{ fontSize: '16px' }}>📎</span>
                </button>

                <button type="button" title="Insert emoji" className="td-reply-box__tool-btn"
                  onClick={() => alert("Emoji feature coming soon!")}>
                  <span style={{ fontSize: '16px' }}>😊</span>
                </button>

                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder={user.role === 'customer' ? "Reply to support..." : "Type your response to the customer..."}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  className="td-reply-box__textarea"
                  rows={1}
                />

                <button 
                  onClick={handleSend} 
                  disabled={sending || !message.trim()} 
                  className="td-reply-box__send"
                >
                  {sending ? <Clock size={16} className="spinner" /> : <Send size={16} />}
                  <span>Send</span>
                </button>
              </div>
              <div className="td-reply-box__hint">
                Press <strong>Enter</strong> to send · <strong>Shift + Enter</strong> for a new line
              </div>
            </div>
          ) : (
            <div className="td-resolved-banner">
              This ticket is {ticket.status}. No further replies can be added.
            </div>
          )}
        </div>

        {/* ═══ RIGHT DETAIL PANEL ════════════════════════════════════ */}
        <div className="td-detail-panel">
          
          {/* Section: Ticket Details */}
          <div className="td-dp-section">
            <h3 className="td-dp-section__title">Ticket Details</h3>
            
            <div className="td-dp-field">
              <span className="td-dp-label">Status</span>
              <span className="td-dp-badge" style={{ background: statusColors.bg, color: statusColors.text, border: `1px solid ${statusColors.border}`, textTransform: 'none' }}>
                {statusColors.label}
              </span>
            </div>

            <div className="td-dp-field">
              <span className="td-dp-label">Priority</span>
              <span className="td-dp-badge" style={{ background: priorityColors.bg, color: priorityColors.text, border: `1px solid ${priorityColors.border}` }}>
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: priorityColors.text, display: 'inline-block', marginRight: '4px' }} />
                {ticket.priority}
              </span>
            </div>

            {/* Section: CC'd Agents */}
            {user.role !== 'customer' && (
              <div className="td-dp-field" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '8px', borderTop: '1px dashed #E2E8F0', paddingTop: '12px', marginTop: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: '700', color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  <AtSign size={13} style={{ color: '#059669' }} /> CC'd Agents
                </div>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', width: '100%' }}>
                  {ticket.cc_agents && ticket.cc_agents.length > 0 ? (
                    ticket.cc_agents.map(agentId => {
                      const agentObj = agents.find(a => a.id === agentId);
                      const displayName = agentObj ? agentObj.name : agentId.slice(0, 8);
                      return (
                        <div key={agentId} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px', background: '#F8FAFC', padding: '4px 8px', borderRadius: '6px', border: '1px solid #E2E8F0' }}>
                          <span style={{ color: '#475569', fontWeight: '500' }}>{displayName}</span>
                          {(user.role === 'admin' || user.id === ticket.assigned_to) && (
                            <button onClick={() => handleRemoveCC(agentId)} style={{ background: 'none', border: 'none', color: '#EF4444', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold' }}>Remove</button>
                          )}
                        </div>
                      );
                    })
                  ) : (
                    <div style={{ fontSize: '12px', color: '#94A3B8', fontStyle: 'italic' }}>No agents CC'd.</div>
                  )}
                  
                  {(user.role === 'admin' || user.id === ticket.assigned_to) && (
                    <div style={{ display: 'flex', gap: '6px', marginTop: '4px' }}>
                      <select 
                        value={selectedAgent}
                        onChange={(e) => setSelectedAgent(e.target.value)}
                        style={{ flex: 1, padding: '6px', fontSize: '12px', border: '1px solid #E2E8F0', borderRadius: '6px', outline: 'none', background: '#fff', color: '#334155' }}
                      >
                        <option value="">Select Agent...</option>
                        {agents.filter(a => a.id !== ticket.assigned_to && !(ticket.cc_agents || []).includes(a.id)).map(a => (
                          <option key={a.id} value={a.id}>{a.name}</option>
                        ))}
                      </select>
                      <button 
                        onClick={handleAddCC}
                        disabled={!selectedAgent}
                        style={{ padding: '6px 10px', background: selectedAgent ? '#F1F5F9' : '#F8FAFC', border: '1px solid #CBD5E1', borderRadius: '6px', fontSize: '12px', cursor: selectedAgent ? 'pointer' : 'not-allowed', fontWeight: '600', color: selectedAgent ? '#334155' : '#94A3B8' }}
                      >Add</button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {ticket.category && (
              <div className="td-dp-field">
                <span className="td-dp-label">Category</span>
                <span className="td-dp-value" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Tag size={13} style={{ color: '#7C3AED' }} />
                  {ticket.category}
                </span>
              </div>
            )}

            <div className="td-dp-field">
              <span className="td-dp-label">Created</span>
              <span className="td-dp-value">
                {ticket.created_at
                  ? `${new Date(ticket.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
                  : "—"}
              </span>
            </div>

            <div className="td-dp-field">
              <span className="td-dp-label">Submitted by</span>
              <span className="td-dp-value" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span className="td-dp-avatar-mini">{(ticket.user_name || "C")[0].toUpperCase()}</span>
                {ticket.user_name || "Customer"}
              </span>
            </div>
          </div>

          {/* Section: AI Analysis & Triage */}
          <div className="td-dp-section" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <h3 className="td-dp-section__title" style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#7C3AED' }}>
              <BarChart3 size={14} style={{ color: '#7C3AED' }} />
              AI Analysis & Triage
            </h3>
            
            <div className="td-confidence" style={{ marginBottom: '8px' }}>
              <div className="td-confidence__header">
                <span className="td-confidence__label" style={{ fontWeight: '600' }}>Confidence Score</span>
                <span className="td-confidence__value" style={{ fontWeight: '800', color: '#7C3AED' }}>{confidence}%</span>
              </div>
              <div className="td-confidence__bar">
                <div 
                  className="td-confidence__fill" 
                  style={{ width: `${confidence}%`, background: '#7C3AED' }}
                />
              </div>
              <div className="td-confidence__detail" style={{ fontSize: '11px', color: '#64748B' }}>
                <span>Model: Gemini 2.5 Flash</span>
                <span>Latency: ~1.2s</span>
              </div>
            </div>

            {(() => {
              const triage = getAITriageDetails(ticket);
              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', borderTop: '1px dashed #E2E8F0', paddingTop: '10px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12.5px' }}>
                    <span style={{ color: '#64748B', fontWeight: '600' }}>Sentiment:</span>
                    <span style={{ color: '#1E293B', fontWeight: '700' }}>{triage.sentiment}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12.5px' }}>
                    <span style={{ color: '#64748B', fontWeight: '600' }}>Auto-Route Destination:</span>
                    <span style={{ color: '#0F172A', fontWeight: '700' }}>{triage.routing}</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12.5px', marginTop: '2px' }}>
                    <span style={{ color: '#64748B', fontWeight: '600' }}>Extracted Key Tokens:</span>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '2px' }}>
                      {triage.keywords.map(kw => (
                        <span key={kw} style={{ background: '#F3E8FF', color: '#6B21A8', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '700' }}>
                          #{kw}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>

          {/* Section: Activity Timeline */}
          <div className="td-dp-section">
            <h3 className="td-dp-section__title" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Activity size={14} style={{ color: '#6366F1' }} />
              Activity Timeline
            </h3>
            <div className="td-timeline">
              <div className="td-timeline__item td-timeline__item--done">
                <div className="td-timeline__dot" />
                <div className="td-timeline__content">
                  <span className="td-timeline__event">Ticket created</span>
                  <span className="td-timeline__time">
                    {ticket.created_at 
                      ? new Date(ticket.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                      : "—"}
                  </span>
                </div>
              </div>
              <div className="td-timeline__item td-timeline__item--done">
                <div className="td-timeline__dot" />
                <div className="td-timeline__content">
                  <span className="td-timeline__event">AI analyzed & classified</span>
                  <span className="td-timeline__time">
                    {ticket.created_at 
                      ? new Date(new Date(ticket.created_at).getTime() + 2000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                      : "—"}
                  </span>
                </div>
              </div>
              <div className={`td-timeline__item ${ticket.status === 'escalated' || chats[0]?.agent_id ? 'td-timeline__item--done' : 'td-timeline__item--active'}`}>
                <div className="td-timeline__dot" />
                <div className="td-timeline__content">
                  <span className="td-timeline__event">
                    {ticket.status === 'escalated' ? 'Escalated to agent' : chats[0]?.agent_id ? 'Agent assigned' : 'AI responding'}
                  </span>
                  <span className="td-timeline__time">Active</span>
                </div>
              </div>
              {(ticket.status === 'resolved' || ticket.status === 'closed') && (
                <div className="td-timeline__item td-timeline__item--done">
                  <div className="td-timeline__dot" style={{ background: '#10B981' }} />
                  <div className="td-timeline__content">
                    <span className="td-timeline__event">Ticket resolved</span>
                    <span className="td-timeline__time">Done</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Section: Support Agent Info (When escalated / active) */}
          {(ticket.status === 'escalated' || chats[0]?.agent_id) && (
            <div className="td-dp-section">
              <h3 className="td-dp-section__title">Support Agent</h3>
              <div className="td-agent-card">
                <div className="td-agent-card__avatar">SJ</div>
                <div className="td-agent-card__info">
                  <div className="td-agent-card__name">Sarah Johnson</div>
                  <div className="td-agent-card__status">
                    <span className="td-agent-card__dot" /> Online
                  </div>
                </div>
              </div>
              <div className="td-agent-card__meta">
                <span>Avg response</span>
                <span style={{ fontWeight: '700', color: '#0F172A' }}>3 min</span>
              </div>
            </div>
          )}

          {/* Section: AI Suggested Resolution (agents/admins only) */}
          {user.role !== 'customer' && (
            <div className="td-dp-section" style={{
              background: 'linear-gradient(135deg, #FAF5FF 0%, #F5F3FF 100%)',
              border: '1.5px solid #E9D5FF',
              borderRadius: '12px',
              padding: '16px 20px',
              boxShadow: '0 4px 12px rgba(139, 92, 246, 0.05)',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              marginBottom: '20px'
            }}>
              <h3 className="td-dp-section__title" style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#6B21A8', border: 'none', padding: 0, margin: 0 }}>
                <Sparkles size={15} style={{ color: '#8B5CF6' }} />
                AI Suggested Resolution
              </h3>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '4px' }}>
                {getResolutionSteps(ticket.category).map((step, idx) => (
                  <div key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', fontSize: '12.5px', color: '#4C1D95', lineHeight: '1.4' }}>
                    <span style={{ color: (ticket.status === 'resolved' || ticket.status === 'closed') ? '#10B981' : '#8B5CF6', fontWeight: 'bold', fontSize: '13px', flexShrink: 0 }}>
                      {(ticket.status === 'resolved' || ticket.status === 'closed') ? '✓' : '•'}
                    </span>
                    <span style={{ textDecoration: (ticket.status === 'resolved' || ticket.status === 'closed') ? 'line-through' : 'none', opacity: (ticket.status === 'resolved' || ticket.status === 'closed') ? 0.7 : 1 }}>
                      {step}
                    </span>
                  </div>
                ))}
              </div>

              <button
                onClick={handleApplyResolution}
                disabled={ticket.status === 'resolved' || ticket.status === 'closed'}
                style={{
                  width: '100%',
                  marginTop: '6px',
                  background: (ticket.status === 'resolved' || ticket.status === 'closed') ? '#E2E8F0' : '#8B5CF6',
                  color: (ticket.status === 'resolved' || ticket.status === 'closed') ? '#94A3B8' : '#ffffff',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '10px 14px',
                  fontWeight: '700',
                  fontSize: '13px',
                  cursor: (ticket.status === 'resolved' || ticket.status === 'closed') ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  transition: 'background 0.2s'
                }}
                onMouseEnter={(e) => {
                  if (ticket.status !== 'resolved' && ticket.status !== 'closed') {
                    e.currentTarget.style.background = '#7C3AED';
                  }
                }}
                onMouseLeave={(e) => {
                  if (ticket.status !== 'resolved' && ticket.status !== 'closed') {
                    e.currentTarget.style.background = '#8B5CF6';
                  }
                }}
              >
                <CheckCircle size={14} />
                {(ticket.status === 'resolved' || ticket.status === 'closed') ? 'Resolution Applied' : 'Apply Resolution'}
              </button>
            </div>
          )}

          {/* Section: Internal Notes (agents only) */}
          {user.role !== 'customer' && (
            <div className="td-dp-section td-internal-note">
              <div className="td-internal-note__header">
                <AlertCircle size={14} />
                Internal Note
              </div>
              <p>Only support agents can see this panel. Use the Escalate button if this requires L2/L3 support.</p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
