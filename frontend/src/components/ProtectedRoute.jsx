/**
 * ProtectedRoute
 * ==============
 * Wraps routes that require authentication or specific roles.
 *
 * Usage:
 *   <ProtectedRoute>
 *     <Dashboard />               // just needs to be logged in
 *   </ProtectedRoute>
 *
 *   <ProtectedRoute roles={["admin"]}>
 *     <AdminPanel />              // needs admin role
 *   </ProtectedRoute>
 *
 *   <ProtectedRoute roles={["admin", "support_agent"]}>
 *     <AgentDashboard />          // needs admin OR agent role
 *   </ProtectedRoute>
 *
 * What it does:
 *  - While loading (checking localStorage) → shows nothing
 *  - Not logged in → redirects to /login
 *  - Wrong role → redirects to /unauthorized
 *  - Correct → renders the children
 */

import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function ProtectedRoute({ children, roles = [] }) {
  const { user, loading } = useAuth();

  // Still checking localStorage — render nothing to avoid flash
  if (loading) return null;

  // Not logged in → send to login page
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Role restriction active and user's role not in the allowed list
  if (roles.length > 0 && !roles.includes(user.role)) {
    return <Navigate to="/unauthorized" replace />;
  }

  return children;
}