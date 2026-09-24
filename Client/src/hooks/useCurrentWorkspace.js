import { useMemo } from "react";
import { useSelector } from "react-redux";
import { useOrganization } from "@clerk/clerk-react";

// Reshapes real data (Clerk org + fetched projects/members) into the same
// shape the UI was originally built against (mock `currentWorkspace`), so
// most existing components keep working with a one-line selector swap.
// Memoized so the returned object keeps a stable identity between renders —
// components use it as a useEffect dependency, and a fresh object each render
// causes an infinite setState/re-render loop that blocks route transitions.
export default function useCurrentWorkspace() {
    const { organization, isLoaded } = useOrganization();
    const { projects, members, loading, error } = useSelector((state) => state.workspace);

    return useMemo(() => {
        if (!organization) return null;

        return {
            id: organization.id,
            name: organization.name,
            slug: organization.slug,
            image_url: organization.imageUrl,
            projects,
            members: members.map((m) => ({ id: m.id, userId: m.id, role: m.role, user: m })),
            loading: !isLoaded || loading,
            error,
        };
    }, [organization, isLoaded, projects, members, loading, error]);
}
