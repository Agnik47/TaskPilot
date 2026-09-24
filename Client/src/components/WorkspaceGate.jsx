import { useEffect } from "react";
import { OrganizationList, useOrganizationList } from "@clerk/clerk-react";
import { Loader2Icon } from "lucide-react";

// Shown when the session has no *active* organization. Accepting an invite
// makes the user a member, but Clerk doesn't activate that organization in
// their session — so instead of pushing them to create a new workspace, we
// activate the one they already belong to. Only people with no membership
// see the chooser (pending invitations to join, or create a workspace).
export default function WorkspaceGate() {
    const { isLoaded, setActive, userMemberships } = useOrganizationList({
        userMemberships: { infinite: true },
    });

    const firstOrgId = userMemberships?.data?.[0]?.organization.id;
    const membershipsLoading = !isLoaded || userMemberships.isLoading;

    useEffect(() => {
        if (firstOrgId) setActive({ organization: firstOrgId });
    }, [firstOrgId, setActive]);

    if (membershipsLoading || firstOrgId) {
        return (
            <div className="flex items-center justify-center h-screen bg-white dark:bg-zinc-950">
                <Loader2Icon className="size-7 text-blue-500 animate-spin" />
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-4 justify-center items-center min-h-screen py-10 bg-white dark:bg-zinc-950">
            <p className="text-zinc-600 dark:text-zinc-400 text-sm text-center px-4">
                Join a workspace you've been invited to, or create a new one.
            </p>
            <OrganizationList hidePersonal afterSelectOrganizationUrl="/" afterCreateOrganizationUrl="/" />
        </div>
    );
}
