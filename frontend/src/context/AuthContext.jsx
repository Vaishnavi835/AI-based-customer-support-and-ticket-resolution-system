/**
 * AuthContext
 * ===========
 * Global authentication state shared across the entire app.
 *
 * Why Context?
 * Without it, you'd pass user/token as props through every component.
 * With Context, any component can call useAuth() and get the current user.
 *
 * What it stores:
 *  - user   : { id, name, email, role } or null
 *  - token  : JWT string or null
 *  - loading: true while checking localStorage on first load
 *
 * What it provides:
 *  - login(email, password) → calls API, saves to state + localStorage
 *  - register(name, email, password) → same
 *  - logout() → clears everything
 *  - isAdmin / isAgent / isCustomer → boolean shortcuts
 */

import { createContext, useContext, useState, useEffect } from "react";
import { authAPI } from "../api/services";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user,    setUser]    = useState(null);
  const [token,   setToken]   = useState(null);
  const [loading, setLoading] = useState(true); // true on first load

  // On first render, check if a token is already saved in localStorage.
  // This keeps the user logged in after a page refresh.
  useEffect(() => {
    const savedToken = localStorage.getItem("access_token");
    const savedUser  = localStorage.getItem("user");

    if (savedToken && savedUser) {
      setToken(savedToken);
      setUser(JSON.parse(savedUser));
    }
    setLoading(false);
  }, []);

  const login = async (email, password) => {
    const response = await authAPI.login(email, password);
    const data     = response.data;

    const userObj = {
      id:    data.user_id,
      name:  data.name,
      email: data.email,
      role:  data.role,
    };

    // Save to state
    setToken(data.access_token);
    setUser(userObj);

    // Save to localStorage so it survives page refresh
    localStorage.setItem("access_token", data.access_token);
    localStorage.setItem("user", JSON.stringify(userObj));

    return userObj;
  };

  const register = async (name, email, password, role = "customer") => {
    const response = await authAPI.register(name, email, password, role);
    const data     = response.data;

    const userObj = {
      id:    data.user_id,
      name:  data.name,
      email: data.email,
      role:  data.role,
    };

    setToken(data.access_token);
    setUser(userObj);
    localStorage.setItem("access_token", data.access_token);
    localStorage.setItem("user", JSON.stringify(userObj));

    return userObj;
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem("access_token");
    localStorage.removeItem("user");
  };

  // Role shortcuts — cleaner than writing user?.role === "admin" everywhere
  const isAdmin   = user?.role === "admin";
  const isAgent   = user?.role === "support_agent";
  const isCustomer = user?.role === "customer";
  const isStaff   = isAdmin || isAgent; // admin or agent

  return (
    <AuthContext.Provider value={{
      user,
      token,
      loading,
      login,
      register,
      logout,
      isAdmin,
      isAgent,
      isCustomer,
      isStaff,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

// Custom hook — components call useAuth() instead of useContext(AuthContext)
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }
  return context;
}