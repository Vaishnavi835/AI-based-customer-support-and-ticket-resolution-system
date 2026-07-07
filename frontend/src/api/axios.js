/**
 * Axios Configuration
 * ===================
 * This file sets up ONE shared axios instance used everywhere in the app.
 *
 * Why one shared instance?
 * If you call axios directly (axios.get, axios.post) in every component,
 * you'd have to type the base URL and token header in every single file.
 * One shared instance handles both automatically.
 *
 * Two interceptors are set up:
 *  1. Request interceptor  → attaches JWT token to every request
 *  2. Response interceptor → handles 401 errors globally (auto-logout)
 */

import axios from "axios";

// The base URL of your FastAPI backend
const API_BASE_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

// Create the shared instance
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
  timeout: 30000, // 30 seconds — RAG responses can be slow
});

// ── Request Interceptor ───────────────────────────────────────────────────────
// Runs before EVERY request leaves the browser.
// Reads the JWT token from localStorage and attaches it to the header.
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("access_token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// ── Response Interceptor ──────────────────────────────────────────────────────
// Runs after EVERY response comes back.
// If the server returns 401 (token expired or invalid), clears storage
// and sends the user back to login automatically.
api.interceptors.response.use(
  (response) => response, // success — pass through unchanged
  (error) => {
    if (error.response?.status === 401) {
      // Skip auto-redirect if THIS request was the login endpoint itself.
      // A 401 from /auth/login means wrong credentials — the Login page
      // needs to catch that error and show the message to the user.
      const requestUrl = error.config?.url || "";
      const isLoginRequest = requestUrl.includes("/auth/login");

      if (!isLoginRequest) {
        // Token expired on some other request — clean up and redirect
        localStorage.removeItem("access_token");
        localStorage.removeItem("user");
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  }
);

export default api;