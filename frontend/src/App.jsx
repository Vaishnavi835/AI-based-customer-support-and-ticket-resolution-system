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

import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { ThemeProvider } from "./components/ThemeSwitcher";
import ProtectedRoute from "./components/ProtectedRoute";
import Navbar from "./components/Navbar";

// Pages
import Login        from "./pages/Login";
import Register     from "./pages/Register";
import ForgotPassword from "./pages/ForgotPassword";
import Dashboard    from "./pages/Dashboard";
import MyTickets    from "./pages/MyTickets";
import Profile      from "./pages/Profile";

// Placeholder pages — you'll build these in Days 22-25
const TicketList     = () => <PlaceholderPage title="All Tickets"      link="/tickets" />;
const TicketDetail   = () => <PlaceholderPage title="Ticket Detail"    link="/tickets" />;
const Escalations    = () => <PlaceholderPage title="Escalation Queue" link="/dashboard" />;
const KnowledgeBase  = () => <PlaceholderPage title="Knowledge Base"   link="/dashboard" />;
const Unauthorized   = () => <PlaceholderPage title="403 — Access Denied" link="/" />;
const NotFound       = () => <PlaceholderPage title="404 — Page Not Found" link="/" />;

// Smart redirect — sends users to the right home page based on their role
function HomeRedirect() {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user)   return <Navigate to="/login" replace />;
  return user.role === "customer"
    ? <Navigate to="/my-tickets" replace />
    : <Navigate to="/dashboard"  replace />;
}

function AppRoutes() {
  return (
    <>
      <Navbar />
      <main className="main-content">
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

          {/* Staff routes — admin + support_agent */}
          <Route path="/dashboard" element={
            <ProtectedRoute roles={["admin", "support_agent"]}>
              <Dashboard />
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
      </main>
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <AppRoutes />
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

