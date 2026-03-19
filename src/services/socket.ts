import { io, Socket } from "socket.io-client";

const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? "http://localhost:3000";

let socket: Socket | null = null;

export const getSocket = (): Socket => {
  if (socket && socket.connected) return socket;

  if (socket) {
    socket.disconnect();
    socket = null;
  }

  // Cookies (including httpOnly access_token) are sent automatically by the browser
  socket = io(`${WS_URL}/interview`, {
    transports: ["websocket", "polling"],
    withCredentials: true,
    autoConnect: false,
  });

  return socket;
};

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};
