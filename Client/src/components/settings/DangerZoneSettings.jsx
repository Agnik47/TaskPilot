import { useState } from "react";
import { useClerk, useOrganization, useUser } from "@clerk/clerk-react";
import { useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import { LogOut, Trash2 } from "lucide-react";
import toast from "react-hot-toast";
import api from "../../lib/api";
import { errorMessage } from "../../lib/errors";
import useOrgRole from "../../hooks/useOrgRole";
import { SectionHeader, SettingsCard, ConfirmDialog, dangerButtonClass } from "./SettingsUI";

export default function DangerZoneSettings() {
    const { organization } = useOrganization();
    const { user } = useUser();
    const { setActive } = useClerk();
    const { isOwner } = useOrgRole();
    const navigate = useNavigate();
    const members = useSelector((state) => state.workspace.members);

    const [dialog, setDialog] = useState(null); // "leave" | "delete" | null

    if (!organization) return null;

    // The last owner can't leave, otherwise the workspace would be unmanageable.
    const isLastOwner = isOwner && members.filter((m) => m.role === "org:admin").length <= 1;

    const exitWorkspace = async () => {
        await setActive({ organization: null });
        navigate("/");
    };

    const leaveWorkspace = async () => {
        try {
            await user.leaveOrganization(organization.id);
            toast.success(`You left ${organization.name}`);
            await exitWorkspace();
        } catch (error) {
            toast.error(errorMessage(error, "Failed to leave workspace"));
            throw error;
        }
    };

    const deleteWorkspace = async () => {
        try {
            await api.delete("/workspace", { data: { confirmName: organization.name } });
            toast.success("Workspace deleted");
            await exitWorkspace();
        } catch (error) {
            toast.error(errorMessage(error, "Failed to delete workspace"));
            throw error;
        }
    };

    return (
        <div>
            <SectionHeader title="Danger Zone" description="Irreversible actions. Please read carefully before continuing." />

            <SettingsCard tone="danger">
                <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${isOwner ? "pb-5 border-b border-zinc-100 dark:border-zinc-800" : ""}`}>
                    <div>
                        <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Leave workspace</p>
                        <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
                            You'll lose access to {organization.name} until someone invites you again.
                            {isLastOwner && " You're the only owner — make someone else an owner first, or delete the workspace."}
                        </p>
                    </div>
                    <button type="button" onClick={() => setDialog("leave")} disabled={isLastOwner} className="disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2 px-4 py-2 rounded-md text-sm border border-red-300 dark:border-red-900 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition shrink-0">
                        <LogOut className="size-4" /> Leave
                    </button>
                </div>

                {isOwner && (
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-5">
                        <div>
                            <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Delete workspace</p>
                            <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
                                Permanently deletes all projects, tasks, comments, and activity, and removes every member. This cannot be undone.
                            </p>
                        </div>
                        <button type="button" onClick={() => setDialog("delete")} className={`${dangerButtonClass} shrink-0`}>
                            <Trash2 className="size-4" /> Delete workspace
                        </button>
                    </div>
                )}
            </SettingsCard>

            <ConfirmDialog
                open={dialog === "leave"}
                title={`Leave ${organization.name}?`}
                description="You will immediately lose access to this workspace's projects and tasks."
                confirmLabel="Leave workspace"
                onConfirm={leaveWorkspace}
                onClose={() => setDialog(null)}
            />

            <ConfirmDialog
                open={dialog === "delete"}
                title="Delete this workspace?"
                description="All projects, tasks, comments, and activity will be permanently deleted, and every member will lose access."
                confirmLabel="Delete forever"
                confirmText={organization.name}
                onConfirm={deleteWorkspace}
                onClose={() => setDialog(null)}
            />
        </div>
    );
}
