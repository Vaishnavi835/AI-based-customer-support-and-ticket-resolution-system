import { useState } from "react";
import { authAPI } from "../api/services";
import { AuthContext } from "./AuthContext";

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem("user");
    return saved ? JSON.parse(saved) : null;
  });
  const [token, setToken] = useState(
    () => localStorage.getItem("access_token") || null
  );
  const [loading] = useState(false);

  const login = async (email, password) => {
    const response = await authAPI.login(email, password);
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

  const isAdmin   = user?.role === "admin";
  const isAgent   = user?.role === "support_agent";
  const isCustomer = user?.role === "customer";
  const isStaff   = isAdmin || isAgent;

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
