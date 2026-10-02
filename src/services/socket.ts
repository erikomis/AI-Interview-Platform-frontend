import { io, Socket } from "socket.io-client";
import { WS_URL } from "@/lib/config";

let socket: Socket | null = null;

/**
 * Returns the single shared Socket.IO instance. It is created once and never
 * recreated just because it is momentarily disconnected — socket.io handles
 * reconnection itself, and callers decide when to (re)connect.
 */
export const getSocket = (): Socket => {
  if (!socket) {
    // Cookies (including httpOnly access_token) are sent automatically by the browser
    socket = io(`${WS_URL}/interview`, {
      transports: ["websocket", "polling"],
      withCredentials: true,
      autoConnect: false,
    });
  }
  return socket;
};

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};
