/**
 * API Services
 * ============
 * All functions that talk to the FastAPI backend.
 * Every component imports from here — never calls axios directly.
 *
 * Why this pattern?
 * If the backend URL or endpoint changes, you fix it in ONE place,
 * not in 20 different components.
 */

import api from "./axios";

// ── Auth ──────────────────────────────────────────────────────────────────────

export const authAPI = {
  /**
   * Register a new account.
   * Returns { access_token, user_id, name, email, role }
   */
  register: (name, email, password, role = "customer") =>
    api.post("/auth/register", { name, email, password, role }),

  /**
   * Login with email + password.
   * FastAPI's OAuth2 form expects "username" not "email" — hence URLSearchParams.
   * Returns { access_token, user_id, name, email, role }
   */
  login: (email, password) => {
    const form = new URLSearchParams();
    form.append("username", email);
    form.append("password", password);
    return api.post("/auth/login", form, {
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });
  },

  /** Get the currently logged-in user's profile. */
  me: () => api.get("/auth/me"),
};

// ── Tickets ───────────────────────────────────────────────────────────────────

export const ticketsAPI = {
  /** Create a new support ticket. */
  create: (title, description) =>
    api.post("/tickets/", { title, description }),

  /**
   * List tickets with optional filters and pagination.
   * Admin/Agent → all tickets. Customer → own tickets only.
   */
  list: (params = {}) => api.get("/tickets/", { params }),

  /** Get a single ticket by ID. */
  get: (ticketId) => api.get(`/tickets/${ticketId}`),

  /** Update status or priority (admin/agent only). */
  update: (ticketId, updates) => api.patch(`/tickets/${ticketId}`, updates),

  /** Assign ticket to an agent (admin/agent only). */
  assign: (ticketId, agentId) =>
    api.patch(`/tickets/${ticketId}/assign`, { assigned_to: agentId }),

  /** Reassign to a different agent with a reason. */
  reassign: (ticketId, agentId, reason) =>
    api.patch(`/tickets/${ticketId}/reassign`, { assigned_to: agentId, reason }),

  /** Remove agent from ticket. */
  unassign: (ticketId) => api.patch(`/tickets/${ticketId}/unassign`),

  /** Delete ticket permanently (admin only). */
  delete: (ticketId) => api.delete(`/tickets/${ticketId}`),

  /** Ticket counts by status (admin/agent only). */
  stats: () => api.get("/tickets/stats"),

  /** Open ticket count per agent (admin/agent only). */
  workload: () => api.get("/tickets/workload"),

  /** Advanced search (admin/agent only). */
  search: (params = {}) => api.get("/tickets/search", { params }),

  /** All tickets assigned to a specific agent. */
  agentTickets: (agentId) => api.get(`/tickets/agent/${agentId}`),
};

// ── Chat ──────────────────────────────────────────────────────────────────────

export const chatAPI = {
  /** Start a new chat session on a ticket. AI responds immediately. */
  start: (ticketId, message) =>
    api.post("/chat/", { ticket_id: ticketId, message }),

  /** Send a message to an existing chat session. */
  sendMessage: (chatId, content) =>
    api.post(`/chat/${chatId}/message`, { role: "user", content }),

  /** Get all chat sessions for a ticket. */
  getHistory: (ticketId) => api.get(`/chat/${ticketId}`),

  /** List all chat sessions (admin/agent only). */
  listAll: () => api.get("/chat/"),

  /** Close a chat session. */
  close: (chatId) => api.patch(`/chat/${chatId}/close`),

  /** Get AI summary of a conversation (admin/agent only). */
  summary: (chatId) => api.get(`/chat/${chatId}/summary`),
};

// ── Escalation ────────────────────────────────────────────────────────────────

export const escalationAPI = {
  /** Manually escalate a chat to a human agent. */
  escalate: (chatId, reason, note = null) =>
    api.post("/escalation/", { chat_id: chatId, reason, note }),

  /** List all pending escalations (agent work queue). */
  pending: () => api.get("/escalation/pending"),

  /** Get escalation status for a specific chat. */
  getChatEscalation: (chatId) => api.get(`/escalation/chat/${chatId}`),

  /** Agent claims an escalated chat. */
  takeover: (chatId) => api.patch(`/escalation/chat/${chatId}/takeover`),

  /** Mark an escalation as resolved. */
  resolve: (chatId, resolutionNote = null) =>
    api.patch(`/escalation/chat/${chatId}/resolve`, {
      resolution_note: resolutionNote,
    }),
};

// ── RAG / Knowledge Base ──────────────────────────────────────────────────────

export const ragAPI = {
  /** Semantic search of the knowledge base. */
  search: (query, topK = 3) =>
    api.post("/rag/search", { query, top_k: topK }),

  /** Ask a question and get a RAG-powered answer. */
  ask: (question, topK = 3, ticketId = null) =>
    api.post("/rag/ask", { question, top_k: topK, ticket_id: ticketId }),

  /** FAISS index stats (admin/agent only). */
  stats: () => api.get("/rag/stats"),

  /** List all knowledge base documents. */
  listKB: (category = null) =>
    api.get("/rag/knowledge-base", { params: category ? { category } : {} }),

  /** Get a single KB document. */
  getKBDoc: (docId) => api.get(`/rag/knowledge-base/${docId}`),
};

// ── Admin KB Management ───────────────────────────────────────────────────────

export const kbAPI = {
  /** List all KB documents (admin/agent). */
  list: (category = null) =>
    api.get("/kb/", { params: category ? { category } : {} }),

  /** Get a single KB document. */
  get: (docId) => api.get(`/kb/${docId}`),

  /** Add a new KB document (admin only). */
  add: (title, category, content) =>
    api.post("/kb/", { title, category, content }),

  /** Update a KB document (admin only). */
  update: (docId, updates) => api.patch(`/kb/${docId}`, updates),

  /** Delete a KB document (admin only). */
  delete: (docId) => api.delete(`/kb/${docId}`),

  /** Manually trigger FAISS reindex (admin only). */
  reindex: () => api.post("/kb/reindex"),

  /** List valid categories. */
  categories: () => api.get("/kb/categories"),
};

// ── Users ─────────────────────────────────────────────────────────────────────

export const usersAPI = {
  /** List all users (admin/agent only). */
  list: () => api.get("/users/"),

  /** Get a single user by ID. */
  get: (userId) => api.get(`/users/${userId}`),

  /** Delete a user (admin only). */
  delete: (userId) => api.delete(`/users/${userId}`),
};