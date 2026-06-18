import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ticketsAPI, chatAPI, escalationAPI } from "../api/services";
import { useAuth } from "../context/AuthContext";
import { Send, AlertCircle, CheckCircle, Clock, ShieldAlert, ArrowLeft, Bot, Sparkles, User, BookOpen } from "lucide-react";

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
    setDisplayedText("");
    setCurrentIndex(0);
  }, [text]);

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

export default function TicketDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [ticket, setTicket]     = useState(null);
  const [chats, setChats]       = useState([]);
  const [message, setMessage]   = useState("");
  const [loading, setLoading]   = useState(true);
  const [sending, setSending]   = useState(false);
  const [lastResponseToType, setLastResponseToType] = useState(null);
  const messagesEndRef = useRef(null);

  const loadData = async () => {
    try {
      const [ticketRes, chatRes] = await Promise.all([
        ticketsAPI.get(id),
        chatAPI.getHistory(id).catch(() => ({ data: [] })),
      ]);
      setTicket(ticketRes.data);
      setChats(chatRes.data || []);
      scrollToBottom();
    } catch (err) {
      console.error("Failed to load ticket", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, [id]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

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
      await loadData();
    } catch (err) {
      alert(err.response?.data?.detail || "Cannot change status");
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

  if (loading) return <div className="cd-page" style={{ padding: '32px' }}><p>Loading...</p></div>;
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
          });
        }
      });
    }
  });

  return (
    <div className="cd-page" style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Top Navigation Bar */}
      <div style={{ padding: '16px 32px', background: '#fff', borderBottom: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748B', display: 'flex', alignItems: 'center' }}>
            <ArrowLeft size={20} />
          </button>
          <div>
            <h2 style={{ fontSize: '20px', fontWeight: '600', color: '#0F172A', margin: 0 }}>{ticket.title}</h2>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '4px', fontSize: '13px', color: '#64748B' }}>
              <span>{ticket.id || 'TKT-000'}</span>
              <span>•</span>
              <span className={`badge badge--${ticket.status === 'open' ? 'blue' : ticket.status === 'escalated' ? 'red' : ticket.status === 'resolved' ? 'green' : 'yellow'}`}>{ticket.status}</span>
              <span className={`badge badge--${ticket.priority === 'high' ? 'red' : ticket.priority === 'low' ? 'green' : 'yellow'}`}>{ticket.priority}</span>
            </div>
          </div>
        </div>

        {/* Action Buttons for Agents/Admins */}
        {user.role !== "customer" && (
          <div style={{ display: "flex", gap: 12 }}>
            {ticket.status === 'escalated' && chats.length > 0 && !chats[0].agent_id && (
              <button onClick={handleTakeover} className="cd-btn cd-btn--primary" style={{ background: '#3B82F6', borderColor: '#3B82F6' }}>
                <Bot size={16} /> Takeover Chat
              </button>
            )}
            {ticket.status !== 'resolved' && (
              <button onClick={() => handleStatusChange("resolved")} className="cd-btn cd-btn--ghost" style={{ color: '#10B981', borderColor: '#10B981' }}>
                <CheckCircle size={16} /> Mark Resolved
              </button>
            )}
            {ticket.status !== 'escalated' && ticket.status !== 'resolved' && (
              <button onClick={() => handleStatusChange("escalated")} className="cd-btn cd-btn--primary" style={{ background: '#EF4444', borderColor: '#EF4444' }}>
                <ShieldAlert size={16} /> Escalate Ticket
              </button>
            )}
          </div>
        )}
      </div>

      {/* Main Content Area (Split between ticket info and chat) */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        
        {/* Chat Thread Area */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#F8FAFC' }}>
          
          <div style={{ flex: 1, padding: '24px 32px', overflowY: 'auto' }}>
            
            {allMessages.map((msg, index) => {
              const isCustomer = msg.role === "customer";
              // Alignment decision logic:
              // - Customers see their own messages on the right (self), agent/AI on left (other).
              // - Agents see agent messages on the right (self), customer/AI on left (other).
              const isSelf = user.role === "customer" ? isCustomer : (!isCustomer && msg.role !== "ai");
              const isAi = msg.role === "ai";
              const isAgent = msg.role === "agent";
              const isLastMessage = index === allMessages.length - 1;

              // Row & Bubble Alignment Classes
              const rowClass = isSelf ? "chat-row chat-row--self" : "chat-row chat-row--other";
              
              let bubbleClass = "chat-bubble";
              if (isSelf) {
                bubbleClass += " chat-bubble--self";
              } else if (isAi) {
                bubbleClass += " chat-bubble--ai";
              } else {
                bubbleClass += " chat-bubble--other";
              }

              // Avatars Configuration
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
                avatarInitials = "";
                avatarIcon = <Sparkles size={14} />;
              }

              const timeStr = msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "";

              return (
                <div key={msg.id} className={rowClass}>
                  <div className="chat-avatar-wrapper">
                    <div className={avatarClass}>
                      {avatarIcon || avatarInitials}
                    </div>
                  </div>
                  
                  <div style={{ display: "flex", flexDirection: "column", maxWidth: "70%", alignItems: isSelf ? "flex-end" : "flex-start" }}>
                    <div className={`chat-meta ${isSelf ? "chat-meta--self" : ""} ${isAi ? "chat-meta--ai" : ""}`} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span>{isSelf ? "You" : isAi ? "AI Assistant" : isAgent ? "Support Agent" : "Customer"}</span>
                      <span className="chat-meta-time">{timeStr}</span>
                      {isAi && msg.rag_used && (
                        <span style={{ fontSize: '10px', background: '#F3E8FF', color: '#6D28D9', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold' }}>
                          ✦ AI-Powered
                        </span>
                      )}
                    </div>
                    
                    <div className={bubbleClass} style={{ width: 'fit-content' }}>
                      {isAi && isLastMessage && lastResponseToType === msg.content ? (
                        <TypewriterText 
                          text={msg.content} 
                          onComplete={() => {
                            setLastResponseToType(null);
                            scrollToBottom();
                          }} 
                        />
                      ) : (
                        <span>{msg.content}</span>
                      )}
                      
                      {isAi && msg.rag_used && (
                        <div className="chat-citation-box">
                          <BookOpen size={12} />
                          <span>Knowledge Base Policy referenced</span>
                        </div>
                      )}
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
            <div style={{
              margin: '0 32px 16px 32px',
              padding: '16px 20px',
              borderRadius: '12px',
              background: chats[0]?.agent_id 
                ? 'linear-gradient(135deg, rgba(239, 246, 255, 0.95) 0%, rgba(219, 234, 254, 0.95) 100%)'
                : 'linear-gradient(135deg, rgba(254, 243, 199, 0.95) 0%, rgba(254, 252, 232, 0.95) 100%)',
              border: chats[0]?.agent_id 
                ? '1px solid #BFDBFE' 
                : '1px solid #FDE68A',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '16px',
              backdropFilter: 'blur(8px)',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.03)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', textAlign: 'left' }}>
                <div style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '10px',
                  background: chats[0]?.agent_id ? '#3B82F6' : '#F59E0B',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#fff',
                  boxShadow: '0 4px 10px rgba(0, 0, 0, 0.1)',
                  flexShrink: 0
                }}>
                  {chats[0]?.agent_id ? <User size={20} /> : <ShieldAlert size={20} />}
                </div>
                <div>
                  <h4 style={{ margin: '0 0 4px 0', fontSize: '14px', fontWeight: '600', color: chats[0]?.agent_id ? '#1E3A8A' : '#78350F' }}>
                    {chats[0]?.agent_id ? 'Support Agent Connected' : 'AI Assistant Paused'}
                  </h4>
                  <p style={{ margin: 0, fontSize: '13px', color: chats[0]?.agent_id ? '#2563EB' : '#D97706', lineHeight: '1.4' }}>
                    {user.role === 'customer' 
                      ? (chats[0]?.agent_id 
                          ? 'A support agent is active in this chat and will respond to your messages.' 
                          : 'This ticket has been escalated. The AI assistant is paused, and your messages are queued for a human support agent.')
                      : (chats[0]?.agent_id 
                          ? `This escalated chat is currently claimed by you or another agent.`
                          : 'This ticket is escalated and pending. Please take over this chat to communicate with the customer.')
                    }
                  </p>
                </div>
              </div>
              
              {user.role !== 'customer' && !chats[0]?.agent_id && (
                <button 
                  onClick={handleTakeover} 
                  className="cd-btn cd-btn--primary"
                  style={{ background: '#F59E0B', borderColor: '#F59E0B', color: '#fff', padding: '8px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: '600', flexShrink: 0 }}
                >
                  Takeover Chat
                </button>
              )}
            </div>
          )}

          {/* Reply Input Box */}
          {ticket.status !== 'resolved' && ticket.status !== 'closed' ? (
            <div style={{ padding: '24px 32px', background: '#fff', borderTop: '1px solid #E2E8F0', flexShrink: 0 }}>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-end', background: '#F8FAFC', padding: '12px', borderRadius: '12px', border: '1px solid #E2E8F0' }}>
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
                  style={{ flex: 1, padding: '8px', border: 'none', background: 'transparent', resize: 'none', fontSize: '15px', outline: 'none', minHeight: '44px', maxHeight: '120px' }}
                  rows={1}
                />
                <button 
                  onClick={handleSend} 
                  disabled={sending || !message.trim()} 
                  className="cd-btn cd-btn--primary"
                  style={{ padding: '10px 16px', borderRadius: '8px', flexShrink: 0 }}
                >
                  {sending ? <Clock size={18} className="spinner" /> : <Send size={18} />}
                  <span style={{ marginLeft: '8px' }}>Send</span>
                </button>
              </div>
            </div>
          ) : (
            <div style={{ padding: '24px', background: '#F1F5F9', textAlign: 'center', color: '#64748B', borderTop: '1px solid #E2E8F0' }}>
              This ticket is {ticket.status}. No further replies can be added.
            </div>
          )}
        </div>

        {/* Right Sidebar: Ticket Metadata (Visible on desktop) */}
        <div style={{ width: '300px', background: '#fff', borderLeft: '1px solid #E2E8F0', padding: '24px', display: 'flex', flexDirection: 'column', gap: '24px', overflowY: 'auto' }}>
          <div>
            <h3 style={{ fontSize: '12px', textTransform: 'uppercase', color: '#94A3B8', fontWeight: '700', letterSpacing: '0.05em', marginBottom: '12px' }}>Ticket Details</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <div style={{ fontSize: '13px', color: '#64748B' }}>Status</div>
                <div style={{ fontWeight: '500', color: '#0F172A', textTransform: 'capitalize' }}>{ticket.status}</div>
              </div>
              <div>
                <div style={{ fontSize: '13px', color: '#64748B' }}>Priority</div>
                <div style={{ fontWeight: '500', color: '#0F172A', textTransform: 'capitalize' }}>{ticket.priority}</div>
              </div>
              {ticket.category && (
                <div>
                  <div style={{ fontSize: '13px', color: '#64748B' }}>Category</div>
                  <div style={{ fontWeight: '500', color: '#0F172A' }}>{ticket.category}</div>
                </div>
              )}
              <div>
                <div style={{ fontSize: '13px', color: '#64748B' }}>Created</div>
                <div style={{ fontWeight: '500', color: '#0F172A' }}>{new Date(ticket.created_at || Date.now()).toLocaleString()}</div>
              </div>
            </div>
          </div>

          {user.role !== 'customer' && (
            <div style={{ background: '#FFFBEB', padding: '16px', borderRadius: '8px', border: '1px solid #FEF3C7' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#D97706', fontWeight: '600', marginBottom: '8px' }}>
                <AlertCircle size={16} /> Internal Note
              </div>
              <p style={{ fontSize: '13px', color: '#92400E', margin: 0 }}>
                Only support agents can see this panel. Use the Escalate button if this requires L2/L3 support.
              </p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
