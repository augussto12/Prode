import { io } from "socket.io-client";

let socket = null;

export function getSocket() {
  if (!socket) {
    socket = io(window.location.origin, {
      autoConnect: false,
      withCredentials: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
      timeout: 10000,
      path: "/socket.io",
      transports: ["polling", "websocket"],
      upgrade: true,
      tryAllTransports: true,
      closeOnBeforeunload: false,
    });
  }
  return socket;
}
