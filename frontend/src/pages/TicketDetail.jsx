import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ticketsAPI, chatAPI, escalationAPI } from "../api/services";
import { useAuth } from "../context/AuthContext";
import { useWebSocketEvent } from "../context/WebSocketContext";
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
            <h2 style={{ fontSize: '22px', fontWeight: '800', color: '#0F172A', margin: 0, letterSpacing: '-0.3px' }}>{ticket.title}</h2>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '6px', fontSize: '13px', color: '#64748B' }}>
              <span style={{ fontWeight: '700', color: '#334155' }}>#TKT-{ticket.id.slice(0, 8).toUpperCase()}</span>
              <span>•</span>
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                padding: '3px 8px',
                borderRadius: '6px',
                fontSize: '11px',
                fontWeight: '700',
                textTransform: 'capitalize',
                background: ticket.status === 'escalated' ? '#FEE2E2' : ticket.status === 'open' ? '#DBEAFE' : ticket.status === 'resolved' ? '#D1FAE5' : '#FEF3C7',
                color: ticket.status === 'escalated' ? '#EF4444' : ticket.status === 'open' ? '#3B82F6' : ticket.status === 'resolved' ? '#10B981' : '#F59E0B'
              }}>
                {ticket.status}
              </span>
              <span>•</span>
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                padding: '3px 8px',
                borderRadius: '6px',
                fontSize: '11px',
                fontWeight: '700',
                textTransform: 'capitalize',
                background: ticket.priority === 'high' ? '#FEE2E2' : ticket.priority === 'low' ? '#F3F4F6' : '#FEF3C7',
                color: ticket.priority === 'high' ? '#EF4444' : ticket.priority === 'low' ? '#6B7280' : '#F59E0B'
              }}>
                {ticket.priority} Priority
              </span>
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
                <div key={msg.id} style={{ width: '100%' }}>
                  {/* Clean Message Timeline centered divider */}
                  {timeStr && (
                    <div style={{ display: 'flex', alignItems: 'center', width: '100%', margin: '24px 0 16px 0' }}>
                      <div style={{ flex: 1, height: '1px', background: '#E2E8F0' }} />
                      <span style={{ padding: '0 16px', fontSize: '11px', color: '#94A3B8', fontWeight: '700', letterSpacing: '0.05em' }}>{timeStr}</span>
                      <div style={{ flex: 1, height: '1px', background: '#E2E8F0' }} />
                    </div>
                  )}

                  <div className={rowClass}>
                    <div className="chat-avatar-wrapper">
                      <div className={avatarClass}>
                        {avatarIcon || avatarInitials}
                      </div>
                    </div>
                    
                    <div style={{ display: "flex", flexDirection: "column", maxWidth: "85%", alignItems: isSelf ? "flex-end" : "flex-start", width: isAi ? '100%' : 'auto' }}>
                      {!isAi && (
                        <div className={`chat-meta ${isSelf ? "chat-meta--self" : ""}`} style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                          <span style={{ fontSize: '12px', fontWeight: '600', color: '#64748B' }}>{isSelf ? "You" : isAgent ? "Support Agent" : "Customer"}</span>
                        </div>
                      )}
                      
                      <div 
                        className={bubbleClass} 
                        style={isAi ? {
                          width: '100%',
                          background: 'linear-gradient(135deg, #FAF5FF 0%, #F5F3FF 100%)',
                          border: '1.5px solid #E9D5FF',
                          borderRadius: '16px',
                          boxShadow: '0 4px 12px rgba(139, 92, 246, 0.05)',
                          padding: '16px 20px',
                          position: 'relative'
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
                        
                        {isAi && msg.rag_used && (
                          <div style={{
                            marginTop: '12px', padding: '12px', background: '#fff', border: '1.5px solid #E9D5FF',
                            borderRadius: '10px', display: 'flex', flexDirection: 'column', gap: '4px',
                            boxShadow: '0 1px 2px rgba(15,23,42,0.02)', maxWidth: '280px'
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: '#7C3AED', fontWeight: '700' }}>
                              📚 Source Used
                            </div>
                            <div style={{ fontSize: '13px', fontWeight: '600', color: '#1E293B' }}>Refund Policy v2.1</div>
                            <div style={{ fontSize: '11px', color: '#94A3B8' }}>Last Updated: 2 days ago</div>
                          </div>
                        )}
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
            <div style={{ padding: '20px 32px', background: '#fff', borderTop: '1px solid #E2E8F0', flexShrink: 0 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center', background: '#F8FAFC', padding: '8px 16px', borderRadius: '12px', border: '1.5px solid #E2E8F0', transition: 'all 0.2s' }}
                     onFocus={(e) => e.currentTarget.style.borderColor = '#6366F1'}
                     onBlur={(e) => e.currentTarget.style.borderColor = '#E2E8F0'}>
                  
                  {/* Attachment Button */}
                  <button 
                    type="button" 
                    title="Attach file" 
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748B', display: 'flex', alignItems: 'center', padding: '4px' }}
                    onClick={() => alert("Attachment feature coming soon!")}
                  >
                    <span style={{ fontSize: '18px', fontWeight: 'bold' }}>📎</span>
                  </button>

                  {/* Emoji Button */}
                  <button 
                    type="button" 
                    title="Insert emoji" 
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748B', display: 'flex', alignItems: 'center', padding: '4px' }}
                    onClick={() => alert("Emoji feature coming soon!")}
                  >
                    <span style={{ fontSize: '18px' }}>😊</span>
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
                    style={{ flex: 1, padding: '8px 4px', border: 'none', background: 'transparent', resize: 'none', fontSize: '14.5px', outline: 'none', minHeight: '36px', maxHeight: '120px', color: '#0F172A', fontFamily: 'inherit' }}
                    rows={1}
                  />

                  <button 
                    onClick={handleSend} 
                    disabled={sending || !message.trim()} 
                    className="cd-btn cd-btn--primary"
                    style={{ padding: '8px 16px', borderRadius: '8px', flexShrink: 0, display: 'flex', alignItems: 'center', gap: '6px', background: '#6366F1', border: 'none', color: '#fff', cursor: 'pointer', fontWeight: '600' }}
                  >
                    {sending ? <Clock size={16} className="spinner" /> : <Send size={16} />}
                    <span>Send</span>
                  </button>
                </div>
                <div style={{ fontSize: '11px', color: '#94A3B8', paddingLeft: '8px' }}>
                  Press <strong style={{ color: '#64748B' }}>Enter</strong> to send • <strong style={{ color: '#64748B' }}>Shift + Enter</strong> for a new line
                </div>
              </div>
            </div>
          ) : (
            <div style={{ padding: '24px', background: '#F1F5F9', textAlign: 'center', color: '#64748B', borderTop: '1px solid #E2E8F0' }}>
              This ticket is {ticket.status}. No further replies can be added.
            </div>
          )}
        </div>

        {/* Right Sidebar: Ticket Metadata (Visible on desktop) */}
        <div style={{ width: '300px', background: '#F8FAFC', borderLeft: '1px solid #E2E8F0', padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px', overflowY: 'auto' }}>
          <div>
            <h3 style={{ fontSize: '12px', textTransform: 'uppercase', color: '#94A3B8', fontWeight: '700', letterSpacing: '0.05em', marginBottom: '16px' }}>Ticket Details</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '12px' }}>
              
              {/* Status Card */}
              <div style={{ 
                background: ticket.status === 'escalated' ? '#FEF2F2' : ticket.status === 'open' ? '#EFF6FF' : ticket.status === 'resolved' ? '#ECFDF5' : '#FFFDF5',
                border: `1.5px solid ${ticket.status === 'escalated' ? '#FCA5A5' : ticket.status === 'open' ? '#93C5FD' : ticket.status === 'resolved' ? '#6EE7B7' : '#FDE68A'}`,
                borderRadius: '10px', padding: '12px' 
              }}>
                <div style={{ fontSize: '11px', color: '#64748B', fontWeight: '600', textTransform: 'uppercase' }}>Status</div>
                <div style={{ fontWeight: '700', fontSize: '15px', color: ticket.status === 'escalated' ? '#991B1B' : ticket.status === 'open' ? '#1E40AF' : ticket.status === 'resolved' ? '#065F46' : '#92400E', textTransform: 'capitalize', marginTop: '4px' }}>
                  {ticket.status}
                </div>
              </div>

              {/* Priority Card */}
              <div style={{ 
                border: `1.5px solid ${ticket.priority === 'high' ? '#FCA5A5' : ticket.priority === 'medium' ? '#FDE68A' : '#E2E8F0'}`,
                borderRadius: '10px', padding: '12px', background: '#fff'
              }}>
                <div style={{ fontSize: '11px', color: '#64748B', fontWeight: '600', textTransform: 'uppercase' }}>Priority</div>
                <div style={{ fontWeight: '700', fontSize: '15px', color: ticket.priority === 'high' ? '#991B1B' : '#334155', textTransform: 'capitalize', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: ticket.priority === 'high' ? '#EF4444' : ticket.priority === 'medium' ? '#F59E0B' : '#6B7280' }} />
                  {ticket.priority}
                </div>
              </div>

              {/* Category Card */}
              {ticket.category && (
                <div style={{ background: '#fff', border: '1.5px solid #E2E8F0', borderRadius: '10px', padding: '12px' }}>
                  <div style={{ fontSize: '11px', color: '#64748B', fontWeight: '600', textTransform: 'uppercase' }}>Category</div>
                  <div style={{ fontWeight: '700', fontSize: '15px', color: '#334155', textTransform: 'capitalize', marginTop: '4px' }}>
                    {ticket.category}
                  </div>
                </div>
              )}

              {/* Created Date Card */}
              <div style={{ background: '#fff', border: '1.5px solid #E2E8F0', borderRadius: '10px', padding: '12px' }}>
                <div style={{ fontSize: '11px', color: '#64748B', fontWeight: '600', textTransform: 'uppercase' }}>Created</div>
                <div style={{ fontWeight: '600', fontSize: '13px', color: '#475569', marginTop: '4px' }}>
                  {new Date(ticket.created_at || Date.now()).toLocaleDateString()} at {new Date(ticket.created_at || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>

            </div>
          </div>

          {/* Support Agent Info (When escalated / active) */}
          {(ticket.status === 'escalated' || chats[0]?.agent_id) && (
            <div style={{ background: '#fff', border: '1.5px solid #E2E8F0', borderRadius: '12px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <h4 style={{ fontSize: '11px', textTransform: 'uppercase', color: '#94A3B8', fontWeight: '700', letterSpacing: '0.05em', margin: 0 }}>Support Agent</h4>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'linear-gradient(135deg, #6366F1, #4F46E5)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '13px' }}>
                  SJ
                </div>
                <div>
                  <div style={{ fontWeight: '700', color: '#0F172A', fontSize: '13.5px' }}>Sarah Johnson</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11.5px', color: '#10B981', fontWeight: '700', marginTop: '2px' }}>
                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10B981' }} /> Online
                  </div>
                </div>
              </div>
              <div style={{ borderTop: '1px solid #F1F5F9', paddingTop: '10px', display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#64748B' }}>
                <span>Avg response</span>
                <span style={{ fontWeight: '700', color: '#0F172A' }}>3 min</span>
              </div>
            </div>
          )}

          {user.role !== 'customer' && (
            <div style={{ background: '#FFFBEB', padding: '16px', borderRadius: '10px', border: '1.5px solid #FEF3C7' }}>
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
