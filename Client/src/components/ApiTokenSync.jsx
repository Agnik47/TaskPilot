import { useEffect } from "react";
import { useAuth } from "@clerk/clerk-react";
import { setApiTokenGetter } from "../lib/api";

// Keeps the shared axios instance's bearer token in sync with Clerk's current
// session/active-organization state. Mount once near the app root.
const ApiTokenSync = () => {
    const { getToken, isSignedIn, orgId } = useAuth();

    useEffect(() => {
        setApiTokenGetter(isSignedIn ? getToken : null);
    }, [getToken, isSignedIn, orgId]);

    return null;
};

export default ApiTokenSync;
