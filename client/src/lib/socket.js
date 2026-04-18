import { io } from 'socket.io-client';

let socket = null;

export function getSocket() {
  if (!socket) {
    socket = io(window.location.origin, {
      autoConnect: false,
      withCredentials: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 2000,
      transports: ['websocket'], // Forzar websockets, evitar HTTP polling
    });
  }
  return socket;
}
