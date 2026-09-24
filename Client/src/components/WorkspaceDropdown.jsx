import { OrganizationSwitcher } from "@clerk/clerk-react";

// Clerk Organizations is the source of truth for workspaces/membership, so
// workspace switching + creation is delegated entirely to Clerk's own UI.
function WorkspaceDropdown() {
    return (
        <div className="m-4">
            <OrganizationSwitcher
                hidePersonal
                appearance={{
                    elements: {
                        rootBox: "w-full",
                        organizationSwitcherTrigger: "w-full justify-between p-3 h-auto rounded hover:bg-gray-100 dark:hover:bg-zinc-800",
                    },
                }}
            />
        </div>
    );
}

export default WorkspaceDropdown;
