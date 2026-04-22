import { io } from "socket.io-client";

let socket = null;

export function getSocket() {
  if (!socket) {
    socket = io(window.location.origin, {
      autoConnect: false,
      withCredentials: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
      transports: ["websocket", "polling"], // WebSocket primero, polling como fallback
      upgrade: true, // Upgradeará de polling a websocket automáticamente
      closeOnBeforeunload: false, // Prevent socket.io from using unload listener (fixes BFCache)
    });
  }
  return socket;
}
