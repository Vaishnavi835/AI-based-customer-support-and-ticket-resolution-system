/**
 * WebSocket Service Client Wrapper
 * =================================
 * Manages connecting, auto-reconnecting, heartbeats (pings),
 * and subscribing/unsubscribing to events broadcasted by the server.
 */

class WebSocketService {
  constructor() {
    this.socket = null;
    this.token = null;
    this.listeners = {};
    this.reconnectTimeout = null;
    this.pingInterval = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.isConnecting = false;
  }

  getWSUrl() {
    const apiURL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";
    const wsURL = apiURL.replace(/^http/, "ws");
    return `${wsURL}/ws`;
  }

  connect(token) {
    if (!token) return;
    this.token = token;

    if (this.socket && (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING)) {
      return;
    }

    if (this.isConnecting) return;
    this.isConnecting = true;

    const wsUrl = `${this.getWSUrl()}?token=${encodeURIComponent(token)}`;
    console.log(`Connecting to WebSocket: ${this.getWSUrl()}`);

    try {
      this.socket = new WebSocket(wsUrl);

      this.socket.onopen = () => {
        console.log("WebSocket connection established");
        this.isConnecting = false;
        this.reconnectAttempts = 0;
        this.startHeartbeat();
      };

      this.socket.onmessage = (event) => {
        if (event.data === "pong") return; // Handled heartbeat response

        try {
          const message = JSON.parse(event.data);
          const type = message.type;
          
          if (type && this.listeners[type]) {
            this.listeners[type].forEach(callback => {
              try {
                callback(message);
              } catch (err) {
                console.error(`Error in WebSocket listener for event '${type}':`, err);
              }
            });
          }
        } catch (err) {
          console.error("Failed to parse WebSocket message:", event.data, err);
        }
      };

      this.socket.onclose = (event) => {
        this.isConnecting = false;
        this.stopHeartbeat();
        console.log(`WebSocket connection closed (code: ${event.code}). Attempting reconnect...`);
        this.handleReconnect();
      };

      this.socket.onerror = (err) => {
        console.error("WebSocket error:", err);
      };
    } catch (error) {
      this.isConnecting = false;
      console.error("Failed to create WebSocket instance:", error);
      this.handleReconnect();
    }
  }

  disconnect() {
    this.token = null;
    this.stopHeartbeat();
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
    console.log("WebSocket disconnected explicitly");
  }

  handleReconnect() {
    if (!this.token) return; // Don't reconnect if logged out

    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.warn("Max WebSocket reconnect attempts reached. Waiting before trying again...");
      // Wait 30 seconds before resetting attempts and trying again
      this.reconnectTimeout = setTimeout(() => {
        this.reconnectAttempts = 0;
        this.connect(this.token);
      }, 30000);
      return;
    }

    this.reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 10000); // Exponential backoff up to 10s
    console.log(`Scheduling reconnect attempt ${this.reconnectAttempts} in ${delay}ms`);

    if (this.reconnectTimeout) clearTimeout(this.reconnectTimeout);
    this.reconnectTimeout = setTimeout(() => {
      this.connect(this.token);
    }, delay);
  }

  startHeartbeat() {
    this.stopHeartbeat();
    this.pingInterval = setInterval(() => {
      if (this.socket && this.socket.readyState === WebSocket.OPEN) {
        this.socket.send("ping");
      }
    }, 30000); // Ping every 30 seconds
  }

  stopHeartbeat() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  subscribe(eventType, callback) {
    if (!this.listeners[eventType]) {
      this.listeners[eventType] = new Set();
    }
    this.listeners[eventType].add(callback);
    return () => this.unsubscribe(eventType, callback);
  }

  unsubscribe(eventType, callback) {
    if (this.listeners[eventType]) {
      this.listeners[eventType].delete(callback);
      if (this.listeners[eventType].size === 0) {
        delete this.listeners[eventType];
      }
    }
  }
}

const wsService = new WebSocketService();
export default wsService;
