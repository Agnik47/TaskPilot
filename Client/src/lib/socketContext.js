import { createContext, useContext } from "react";

export const SocketContext = createContext(null);

// The app-wide Socket.IO connection (null until signed in with an active workspace).
export function useSocket() {
    return useContext(SocketContext);
}
