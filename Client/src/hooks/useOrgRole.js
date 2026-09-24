import { useOrganization } from "@clerk/clerk-react";

// Thin wrapper around Clerk's org membership role. This only drives UI
// affordances (hiding buttons/fields) — the backend independently enforces
// every rule from the verified session token, never trusting the client.
export default function useOrgRole() {
    const { membership, isLoaded } = useOrganization();
    const role = membership?.role;

    return {
        isLoaded,
        role,
        isOwner: role === "org:admin",
        isEmployee: role === "org:member",
    };
}
