import { useEffect, useState } from "react";
import { io } from "socket.io-client";
import { useAuth } from "@clerk/clerk-react";
import { SocketContext } from "../lib/socketContext";

// Socket server lives on the API's origin (VITE_API_URL minus the /api path).
const SOCKET_URL = new URL(import.meta.env.VITE_API_URL).origin;

// One realtime connection per tab. The server reads the user and active
// workspace from the Clerk token at handshake, so the socket is rebuilt when
// the workspace changes, and every (re)connect fetches a fresh token since
// Clerk session tokens are short-lived.
export default function SocketProvider({ children }) {
    const { getToken, isSignedIn, orgId } = useAuth();
    const [socket, setSocket] = useState(null);

    useEffect(() => {
        if (!isSignedIn || !orgId) return;

        const s = io(SOCKET_URL, {
            auth: (cb) => {
                getToken()
                    .then((token) => cb({ token }))
                    .catch(() => cb({}));
            },
        });
        setSocket(s);

        return () => {
            s.disconnect();
            setSocket(null);
        };
    }, [isSignedIn, orgId, getToken]);

    return <SocketContext.Provider value={socket}>{children}</SocketContext.Provider>;
}
