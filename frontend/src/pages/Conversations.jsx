import { useState, useEffect, useRef, useCallback } from "react";
import { chatAPI, ticketsAPI } from "../api/services";
import { useWebSocketEvent } from "../context/WebSocketContext";
import { useToast } from "../context/ToastContext";
import { useAuth } from "../context/AuthContext";
import {
  Send, AlertCircle, Paperclip, X,
  MessageSquare, RefreshCw
} from "lucide-react";

export default function Conversations() {
  const { user } = useAuth();
  const toast = useToast();
  const chatEndRef = useRef(null);
  const fileInputRef = useRef(null);

  const [conversations, setConversations] = useState([]);
  const [selectedChat, setSelectedChat] = useState(null);
  const [loadingList, setLoadingList] = useState(true);
  const [loadingChat, setLoadingChat] = useState(false);
  const [messageText, setMessageText] = useState("");
  const [isInternalNote, setIsInternalNote] = useState(false);
  const [attachmentFile, setAttachmentFile] = useState(null);

  // Load all active conversations — real data only
  const loadConversations = useCallback(async () => {
    setLoadingList(true);
    try {
      const res = await chatAPI.listAll(1, 50);
      const list = res.data.sessions || res.data || [];

      // Fetch ticket subjects for display
      const listWithSubjects = await Promise.all(list.map(async (c) => {
        try {
          const tRes = await ticketsAPI.get(c.ticket_id);
          return {
            ...c,
            subject: tRes.data.title,
            customerName: tRes.data.requester || "Customer"
          };
        } catch {
          return {
            ...c,
            subject: `Ticket #${c.ticket_id}`,
            customerName: "Customer"
          };
        }
      }));

      setConversations(listWithSubjects);

      // Default select first chat if none selected
      if (listWithSubjects.length > 0 && !selectedChat) {
        handleSelectChat(listWithSubjects[0]);
      }
    } catch {
      setConversations([]);
    } finally {
      setLoadingList(false);
    }
  }, [selectedChat]);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  useWebSocketEvent("chat_updated", () => {
    loadConversations();
  });

  const handleSelectChat = async (c) => {
    setSelectedChat(c);
    setLoadingChat(true);
    try {
      const res = await chatAPI.getHistory(c.ticket_id);
      const chatDetails = res.data[0] || res.data || c;
      setSelectedChat({
        ...c,
        messages: chatDetails.messages || c.messages || []
      });
    } catch {
      // keep existing chat data
    } finally {
      setLoadingChat(false);
      setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    }
  };

  const handleSend = async () => {
    const text = messageText.trim();
    if (!text || !selectedChat) return;

    try {
      if (isInternalNote) {
        await ticketsAPI.reassign(selectedChat.ticket_id, user.id, `Internal Note: ${text}`);
        toast.success("Internal note added to ticket logs!");
      } else {
        let fullMessage = text;
        if (attachmentFile) {
          fullMessage += `\n\n[Attachment: ${attachmentFile.name}]`;
        }
        await chatAPI.sendMessage(selectedChat.id, fullMessage);
        toast.success("Message sent to customer!");
      }

      setMessageText("");
      setAttachmentFile(null);
      handleSelectChat(selectedChat);
    } catch (err) {
      toast.error("Failed to send message: " + (err.response?.data?.detail || err.message));
    }
  };

  return (
    <div style={{ height: "calc(100vh - 120px)", display: "flex", gap: "20px", padding: "24px", background: "#F8FAFC" }}>

      {/* 1. Left Sidebar: Active Conversations List */}
      <div style={{
        width: "300px", background: "#fff", border: "1px solid #E2E8F0", borderRadius: "14px",
        display: "flex", flexDirection: "column", overflow: "hidden", boxShadow: "0 1px 3px rgba(15,23,42,0.02)"
      }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid #F1F5F9", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h3 style={{ margin: 0, fontSize: "15px", fontWeight: "800", color: "#0F172A", display: "flex", alignItems: "center", gap: "8px" }}>
            <MessageSquare size={16} /> Chats Queue
          </h3>
          <button onClick={loadConversations} style={{ border: "none", background: "none", cursor: "pointer", color: "#64748B" }}>
            <RefreshCw size={14} />
          </button>
        </div>

        <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column" }}>
          {loadingList ? (
            <div style={{ padding: "20px", textAlign: "center", color: "#64748B" }}>Loading chats...</div>
          ) : conversations.length === 0 ? (
            <div style={{ padding: "40px 20px", textAlign: "center", color: "#94A3B8", fontSize: "13px" }}>
              <MessageSquare size={28} style={{ margin: "0 auto 10px", display: "block", opacity: 0.4 }} />
              No active chat sessions found.
            </div>
          ) : (
            conversations.map((c) => {
              const lastMsg = c.messages?.[c.messages.length - 1];
              const snippet = lastMsg ? (lastMsg.prompt || lastMsg.response) : "New chat session started.";
              return (
                <div
                  key={c.id}
                  onClick={() => handleSelectChat(c)}
                  style={{
                    padding: "16px", borderBottom: "1px solid #F1F5F9", cursor: "pointer",
                    background: selectedChat?.id === c.id ? "#F1F5FF" : "transparent",
                    borderLeft: selectedChat?.id === c.id ? "4px solid #6366F1" : "4px solid transparent",
                    transition: "all 0.15s"
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontWeight: "755", fontSize: "13.5px", color: "#0F172A" }}>{c.customerName}</span>
                    {c.escalated && (
                      <span style={{ background: "#FEF2F2", color: "#EF4444", fontSize: "10px", fontWeight: "800", padding: "1px 5px", borderRadius: "4px" }}>
                        Escalated
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: "12px", color: "#475569", fontWeight: "600", marginTop: "4px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {c.subject}
                  </div>
                  <div style={{ fontSize: "11.5px", color: "#94A3B8", marginTop: "4px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {snippet}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* 2. Center: Chat Feed Workspace */}
      <div style={{
        flex: 1, background: "#fff", border: "1px solid #E2E8F0", borderRadius: "14px",
        display: "flex", flexDirection: "column", overflow: "hidden", boxShadow: "0 1px 3px rgba(15,23,42,0.02)"
      }}>
        {selectedChat ? (
          <>
            {/* Active Header */}
            <div style={{ padding: "16px 20px", borderBottom: "1px solid #F1F5F9", background: "#FAFBFD" }}>
              <div style={{ fontSize: "15px", fontWeight: "800", color: "#0F172A" }}>{selectedChat.customerName}</div>
              <div style={{ fontSize: "12px", color: "#64748B", marginTop: "2px" }}>Ticket Subject: {selectedChat.subject}</div>
            </div>

            {/* Message window */}
            <div style={{ flex: 1, padding: "20px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "14px" }}>
              {loadingChat ? (
                <div style={{ padding: "40px", textAlign: "center", color: "#64748B" }}>Loading logs...</div>
              ) : (
                selectedChat.messages?.map((m, idx) => (
                  <div key={idx} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                    {/* Customer Prompt */}
                    {m.prompt && (
                      <div style={{ alignSelf: "flex-start", maxWidth: "70%" }}>
                        <div style={{ background: "#F1F5F9", color: "#1E293B", padding: "12px 16px", borderRadius: "14px 14px 14px 0", fontSize: "13.8px", lineHeight: "1.45" }}>
                          {m.prompt}
                        </div>
                        <div style={{ fontSize: "10px", color: "#94A3B8", marginTop: "4.5px", paddingLeft: "4px" }}>Customer</div>
                      </div>
                    )}
                    {/* Agent / AI Response */}
                    {m.response && (
                      <div style={{ alignSelf: "flex-end", maxWidth: "70%", display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
                        <div style={{
                          background: m.agent_id ? "#6366F1" : "#10B981", color: "#fff",
                          padding: "12px 16px", borderRadius: "14px 14px 0 14px", fontSize: "13.8px", lineHeight: "1.45"
                        }}>
                          {m.response}
                        </div>
                        <div style={{ fontSize: "10px", color: "#94A3B8", marginTop: "4.5px", paddingRight: "4px" }}>
                          {m.agent_id ? "Agent (You)" : "AI Autopilot"}
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Bottom Actions and Text Input */}
            <div style={{ padding: "16px 20px", borderTop: "1px solid #F1F5F9", background: "#FAFBFD", display: "flex", flexDirection: "column", gap: "12px" }}>

              {/* Attachment preview / mode toggles */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                  {attachmentFile && (
                    <span style={{ background: "#F1F5F9", border: "1px solid #E2E8F0", padding: "4px 10px", borderRadius: "6px", fontSize: "12px", display: "inline-flex", alignItems: "center", gap: "4px" }}>
                      <Paperclip size={12} /> {attachmentFile.name}
                      <button onClick={() => setAttachmentFile(null)} style={{ border: "none", background: "none", cursor: "pointer", color: "#EF4444" }}><X size={12} /></button>
                    </span>
                  )}
                </div>

                {/* Toggles */}
                <div style={{ display: "flex", gap: "12px" }}>
                  <button
                    onClick={() => setIsInternalNote(false)}
                    style={{
                      padding: "4px 10px", borderRadius: "6px", border: "none", fontSize: "12px", fontWeight: "700",
                      cursor: "pointer", background: !isInternalNote ? "#EEF2FF" : "transparent",
                      color: !isInternalNote ? "#4F46E5" : "#64748B"
                    }}
                  >
                    Reply Customer
                  </button>
                  <button
                    onClick={() => setIsInternalNote(true)}
                    style={{
                      padding: "4px 10px", borderRadius: "6px", border: "none", fontSize: "12px", fontWeight: "700",
                      cursor: "pointer", background: isInternalNote ? "#FFFBEB" : "transparent",
                      color: isInternalNote ? "#D97706" : "#64748B"
                    }}
                  >
                    Internal Note
                  </button>
                </div>
              </div>

              {/* Text Input Row */}
              <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  style={{ background: "none", border: "none", cursor: "pointer", color: "#64748B", padding: "6px" }}
                  title="Attach File"
                >
                  <Paperclip size={18} />
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  onChange={(e) => setAttachmentFile(e.target.files[0])}
                  style={{ display: "none" }}
                />

                <input
                  type="text"
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") handleSend(); }}
                  placeholder={isInternalNote ? "Log private note on ticket timeline..." : "Type customer response message..."}
                  style={{
                    flex: 1, padding: "10px 14px", border: "1.5px solid #E2E8F0", borderRadius: "10px",
                    outline: "none", fontSize: "13.8px", background: "#fff", color: "#1E293B"
                  }}
                />

                <button
                  onClick={handleSend}
                  style={{
                    background: isInternalNote ? "#D97706" : "#6366F1", border: "none", borderRadius: "10px",
                    width: "38px", height: "38px", display: "flex", alignItems: "center", justifyContent: "center",
                    color: "#fff", cursor: "pointer", transition: "transform 0.1s"
                  }}
                >
                  <Send size={16} />
                </button>
              </div>
            </div>
          </>
        ) : (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "#94A3B8" }}>
            <MessageSquare size={38} style={{ marginBottom: "10px" }} />
            <span>Select a conversation to reply</span>
          </div>
        )}
      </div>

    </div>
  );
}
