import { createContext, useContext, useEffect } from "react";
import { useAuth } from "./AuthContext";
import wsService from "../services/websocket";

const WebSocketContext = createContext(null);

export function WebSocketProvider({ children }) {
  const { token } = useAuth();

  useEffect(() => {
    if (token) {
      wsService.connect(token);
    } else {
      wsService.disconnect();
    }

    return () => {
      wsService.disconnect();
    };
  }, [token]);

  const subscribe = (eventType, callback) => {
    return wsService.subscribe(eventType, callback);
  };

  const unsubscribe = (eventType, callback) => {
    wsService.unsubscribe(eventType, callback);
  };

  return (
    <WebSocketContext.Provider value={{ subscribe, unsubscribe }}>
      {children}
    </WebSocketContext.Provider>
  );
}

export function useWebSocket() {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error("useWebSocket must be used inside a WebSocketProvider");
  }
  return context;
}

/**
 * Custom Hook: useWebSocketEvent
 * ==============================
 * Automatically subscribes a callback to a WebSocket event type on mount
 * and unsubscribes on unmount.
 */
export function useWebSocketEvent(eventType, callback) {
  const { subscribe } = useWebSocket();

  useEffect(() => {
    if (!callback) return;
    const unsubscribe = subscribe(eventType, callback);
    return () => {
      unsubscribe();
    };
  }, [eventType, callback, subscribe]);
}
