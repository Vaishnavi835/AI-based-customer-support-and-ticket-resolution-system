/**
 * App.jsx — Route Configuration
 * ==============================
 * Defines every URL in the application and what component renders there.
 *
 * Route structure:
 *   /login                → Login page (public)
 *   /register             → Register page (public)
 *   /dashboard            → Admin/Agent dashboard (staff only)
 *   /tickets              → All tickets list (staff only)
 *   /tickets/:id          → Single ticket detail
 *   /my-tickets           → Customer's own tickets
 *   /escalations          → Escalation queue (staff only)
 *   /knowledge-base       → KB management (staff only)
 *   /unauthorized         → 403 page
 *   /                     → Redirects based on role
 *   *                     → 404 page
 */

import { useState } from "react";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AuthProvider } from "./context/AuthProvider";
import { useAuth } from "./context/AuthContext";
import { ThemeProvider } from "./context/ThemeContext";
import ProtectedRoute from "./components/ProtectedRoute";

// Pages
import Login        from "./pages/Login";
import Register     from "./pages/Register";
import ForgotPassword from "./pages/ForgotPassword";
import Dashboard    from "./pages/Dashboard";
import MyTickets    from "./pages/MyTickets";
import Profile      from "./pages/Profile";
import AgentDashboard from "./pages/AgentDashboard";
import Escalations from "./pages/Escalations";
import TicketList from "./pages/TicketList";
import KnowledgeBase from "./pages/KnowledgeBase";
import UserManagement from "./pages/UserManagement";
import TicketDetail from "./pages/TicketDetail";



// Placeholder pages — you'll build these in Days 22-25
const Unauthorized   = () => <PlaceholderPage title="403 — Access Denied" link="/" />;
const NotFound       = () => <PlaceholderPage title="404 — Page Not Found" link="/" />;

// Smart redirect — sends users to the right home page based on their role
function HomeRedirect() {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user)   return <Navigate to="/login" replace />;
  if (user.role === "customer") return <Navigate to="/my-tickets" replace />;
  if (user.role === "support_agent") return <Navigate to="/agent-dashboard" replace />;
  return <Navigate to="/dashboard" replace />;
}

import Sidebar from "./components/Sidebar";
import TopBar from "./components/TopBar";

const PAGE_TITLES = {
  "/dashboard": "Dashboard",
  "/agent-dashboard": "Agent Dashboard",
  "/tickets": "All Tickets",
  "/escalations": "Escalations",
  "/knowledge-base": "Knowledge Base",
  "/users": "User Management",
  "/my-tickets": "My Tickets",
  "/my-tickets/new": "New Ticket",
  "/my-tickets/history": "Ticket History",
  "/profile": "Profile",
};

function AppRoutes() {
  const { user } = useAuth();
  const location = useLocation();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(
    () => localStorage.getItem("sidebar-collapsed") === "true"
  );

  const toggleSidebar = () => {
    setSidebarCollapsed(prev => {
      localStorage.setItem("sidebar-collapsed", !prev);
      return !prev;
    });
  };

  const pageTitle = PAGE_TITLES[location.pathname] 
    || (location.pathname.startsWith("/tickets/") ? "Ticket Detail" : "Dashboard");

  return (
    <div className={user ? "zd-layout" : ""}>
      {user && <Sidebar collapsed={sidebarCollapsed} />}
      <main className={user ? "zd-main" : ""} style={{ backgroundColor: user ? '#F8FAFC' : 'inherit' }}>
        {user && <TopBar onToggleSidebar={toggleSidebar} title={pageTitle} />}
        <div className={user ? "page-body" : ""}>
        <Routes>
          {/* Public routes */}
          <Route path="/login"    element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />

          {/* Smart home redirect */}
          <Route path="/" element={<HomeRedirect />} />

          {/* Customer routes */}
          <Route path="/my-tickets" element={
            <ProtectedRoute roles={["customer"]}>
              <MyTickets />
            </ProtectedRoute>
          } />
          <Route path="/my-tickets/new" element={
            <ProtectedRoute roles={["customer"]}>
              <MyTickets />
            </ProtectedRoute>
          } />
          <Route path="/my-tickets/history" element={
            <ProtectedRoute roles={["customer"]}>
              <MyTickets />
            </ProtectedRoute>
          } />

          {/* Staff routes — admin + support_agent */}
          <Route path="/dashboard" element={
            <ProtectedRoute roles={["admin"]}>
              <Dashboard />
            </ProtectedRoute>
          } />

          <Route path="/agent-dashboard" element={
            <ProtectedRoute roles={["admin", "support_agent"]}>
              <AgentDashboard />
            </ProtectedRoute>
          } />

          <Route path="/tickets" element={
            <ProtectedRoute roles={["admin", "support_agent"]}>
              <TicketList />
            </ProtectedRoute>
          } />

          <Route path="/escalations" element={
            <ProtectedRoute roles={["admin", "support_agent"]}>
              <Escalations />
            </ProtectedRoute>
          } />

          {/* Admin only routes */}
          <Route path="/knowledge-base" element={
            <ProtectedRoute roles={["admin"]}>
              <KnowledgeBase />
            </ProtectedRoute>
          } />

          <Route path="/users" element={
            <ProtectedRoute roles={["admin"]}>
              <UserManagement />
            </ProtectedRoute>
          } />

          {/* Shared — any authenticated user can view a ticket */}
          <Route path="/tickets/:id" element={
            <ProtectedRoute>
              <TicketDetail />
            </ProtectedRoute>
          } />

          {/* Profile route for any authenticated user */}
          <Route path="/profile" element={
            <ProtectedRoute>
              <Profile />
            </ProtectedRoute>
          } />

          {/* Error pages */}
          <Route path="/unauthorized" element={<Unauthorized />} />
          <Route path="*"             element={<NotFound />}      />
        </Routes>
        </div>
      </main>
    </div>
  );
}

import { WebSocketProvider } from "./context/WebSocketContext";
import { ToastProvider } from "./context/ToastProvider";

export default function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <WebSocketProvider>
            <ToastProvider>
              <AppRoutes />
            </ToastProvider>
          </WebSocketProvider>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}

// ── Placeholder page (removed when real pages are built) ──────────────────────
function PlaceholderPage({ title, link }) {
  return (
    <div className="placeholder-page">
      <h1>{title}</h1>
      <a href={link} className="btn btn-primary">Go back</a>
    </div>
  );
}

