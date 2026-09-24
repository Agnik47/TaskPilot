import { useCallback, useEffect, useState } from "react";
import { useOrganization, useUser } from "@clerk/clerk-react";
import { useDispatch } from "react-redux";
import { format, formatDistanceToNow } from "date-fns";
import { Loader2Icon, Mail, Search, UserMinus, UserPlus, X } from "lucide-react";
import toast from "react-hot-toast";
import { errorMessage } from "../../lib/errors";
import useOrgRole from "../../hooks/useOrgRole";
import { fetchMembers } from "../../features/workspaceSlice";
import InviteMemberDialog from "../InviteMemberDialog";
import { SectionHeader, SettingsCard, Badge, ConfirmDialog, inputClass, primaryButtonClass } from "./SettingsUI";

const ROLE_LABELS = { "org:admin": "Owner", "org:member": "Employee" };

const displayName = (m) =>
    `${m.publicUserData?.firstName ?? ""} ${m.publicUserData?.lastName ?? ""}`.trim() || m.publicUserData?.identifier || "Unknown user";

export default function MembersSettings() {
    const { organization } = useOrganization();
    const { user } = useUser();
    const { isOwner } = useOrgRole();
    const dispatch = useDispatch();

    const [memberships, setMemberships] = useState([]);
    const [invitations, setInvitations] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [busyUserId, setBusyUserId] = useState(null);
    const [pendingRemoval, setPendingRemoval] = useState(null);
    const [isInviteOpen, setIsInviteOpen] = useState(false);

    const load = useCallback(async () => {
        if (!organization) return;
        try {
            const [membersRes, invitesRes] = await Promise.all([
                organization.getMemberships({ pageSize: 100 }),
                // Invitation listing requires the owner's manage permission.
                isOwner ? organization.getInvitations({ status: ["pending"], pageSize: 100 }) : Promise.resolve({ data: [] }),
            ]);
            setMemberships(membersRes.data);
            setInvitations(invitesRes.data);
        } catch (error) {
            toast.error(errorMessage(error, "Failed to load members"));
        } finally {
            setLoading(false);
        }
    }, [organization, isOwner]);

    // Also re-lists after the invite dialog closes so new invitations show up.
    useEffect(() => {
        if (!isInviteOpen) load();
    }, [load, isInviteOpen]);

    const ownerCount = memberships.filter((m) => m.role === "org:admin").length;

    const filtered = memberships.filter((m) => {
        const term = search.toLowerCase();
        return displayName(m).toLowerCase().includes(term) || (m.publicUserData?.identifier || "").toLowerCase().includes(term);
    });

    const changeRole = async (membership, role) => {
        const userId = membership.publicUserData.userId;
        try {
            setBusyUserId(userId);
            await organization.updateMember({ userId, role });
            toast.success(`${displayName(membership)} is now ${ROLE_LABELS[role] === "Owner" ? "an Owner" : "an Employee"}`);
            await load();
            dispatch(fetchMembers());
        } catch (error) {
            toast.error(errorMessage(error, "Failed to change role"));
        } finally {
            setBusyUserId(null);
        }
    };

    const removeMember = async () => {
        const membership = pendingRemoval;
        try {
            await organization.removeMember(membership.publicUserData.userId);
            toast.success(`${displayName(membership)} was removed from the workspace`);
            await load();
            dispatch(fetchMembers());
        } catch (error) {
            toast.error(errorMessage(error, "Failed to remove member"));
            throw error;
        }
    };

    const revokeInvitation = async (invitation) => {
        try {
            await invitation.revoke();
            toast.success(`Invitation to ${invitation.emailAddress} revoked`);
            setInvitations((prev) => prev.filter((i) => i.id !== invitation.id));
        } catch (error) {
            toast.error(errorMessage(error, "Failed to revoke invitation"));
        }
    };

    return (
        <div>
            <SectionHeader title="Members & Roles" description="Who has access to this workspace and what they're allowed to do." />

            <SettingsCard>
                <div className="grid sm:grid-cols-2 gap-4 text-sm">
                    <div className="rounded-md border border-zinc-200 dark:border-zinc-800 p-4">
                        <div className="flex items-center gap-2 mb-2"><Badge tone="purple">Owner</Badge></div>
                        <p className="text-zinc-600 dark:text-zinc-400">Full access: manages projects, assigns and reassigns work, invites or removes people, and changes workspace settings.</p>
                    </div>
                    <div className="rounded-md border border-zinc-200 dark:border-zinc-800 p-4">
                        <div className="flex items-center gap-2 mb-2"><Badge>Employee</Badge></div>
                        <p className="text-zinc-600 dark:text-zinc-400">Works on assigned tasks, creates tasks for themselves, updates their own work, and comments on tasks they can see.</p>
                    </div>
                </div>
            </SettingsCard>

            <SettingsCard
                title={`Members${loading ? "" : ` (${memberships.length})`}`}
                description={isOwner ? "Change roles or remove people. A workspace always needs at least one owner." : "Everyone in this workspace."}
            >
                <div className="flex flex-col sm:flex-row gap-3 mb-4">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 size-3.5" />
                        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name or email" className={`${inputClass} pl-8`} />
                    </div>
                    {isOwner && (
                        <button type="button" onClick={() => setIsInviteOpen(true)} className={primaryButtonClass}>
                            <UserPlus className="size-4" /> Invite member
                        </button>
                    )}
                </div>

                {loading ? (
                    <div className="flex justify-center py-10"><Loader2Icon className="size-6 text-blue-500 animate-spin" /></div>
                ) : filtered.length === 0 ? (
                    <p className="text-sm text-zinc-500 dark:text-zinc-400 text-center py-8">No members match your search.</p>
                ) : (
                    <ul className="divide-y divide-zinc-100 dark:divide-zinc-800 border border-zinc-200 dark:border-zinc-800 rounded-md">
                        {filtered.map((m) => {
                            const userId = m.publicUserData?.userId;
                            const isSelf = userId === user?.id;
                            const isLastOwner = m.role === "org:admin" && ownerCount <= 1;
                            const locked = !isOwner || isSelf || isLastOwner;

                            return (
                                <li key={m.id} className="flex flex-col sm:flex-row sm:items-center gap-3 px-4 py-3">
                                    <div className="flex items-center gap-3 min-w-0 flex-1">
                                        <img src={m.publicUserData?.imageUrl} alt="" className="size-8 rounded-full bg-zinc-200 dark:bg-zinc-800 shrink-0" />
                                        <div className="min-w-0">
                                            <p className="text-sm font-medium text-zinc-900 dark:text-white truncate">
                                                {displayName(m)} {isSelf && <span className="text-zinc-400 font-normal">(you)</span>}
                                            </p>
                                            <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate">
                                                {m.publicUserData?.identifier} · Joined {format(m.createdAt, "MMM d, yyyy")}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2 sm:justify-end">
                                        {locked ? (
                                            <Badge tone={m.role === "org:admin" ? "purple" : "zinc"}>{ROLE_LABELS[m.role] || m.role}</Badge>
                                        ) : (
                                            <select
                                                value={m.role}
                                                disabled={busyUserId === userId}
                                                onChange={(e) => changeRole(m, e.target.value)}
                                                className="rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm px-2 py-1.5 text-zinc-900 dark:text-zinc-200 focus:outline-none focus:border-blue-500"
                                                aria-label={`Role for ${displayName(m)}`}
                                            >
                                                <option value="org:member">Employee</option>
                                                <option value="org:admin">Owner</option>
                                            </select>
                                        )}
                                        {isOwner && !isSelf && !isLastOwner && (
                                            <button
                                                type="button"
                                                onClick={() => setPendingRemoval(m)}
                                                disabled={busyUserId === userId}
                                                className="p-2 rounded-md text-zinc-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 transition disabled:opacity-50"
                                                aria-label={`Remove ${displayName(m)}`}
                                                title="Remove from workspace"
                                            >
                                                <UserMinus className="size-4" />
                                            </button>
                                        )}
                                    </div>
                                </li>
                            );
                        })}
                    </ul>
                )}
            </SettingsCard>

            {isOwner && (
                <SettingsCard title={`Pending invitations (${invitations.length})`} description="People who were invited but haven't joined yet.">
                    {invitations.length === 0 ? (
                        <p className="text-sm text-zinc-500 dark:text-zinc-400">No pending invitations.</p>
                    ) : (
                        <ul className="divide-y divide-zinc-100 dark:divide-zinc-800 border border-zinc-200 dark:border-zinc-800 rounded-md">
                            {invitations.map((inv) => (
                                <li key={inv.id} className="flex items-center gap-3 px-4 py-3">
                                    <div className="size-8 rounded-full bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center shrink-0">
                                        <Mail className="size-4 text-blue-500" />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <p className="text-sm text-zinc-900 dark:text-white truncate">{inv.emailAddress}</p>
                                        <p className="text-xs text-zinc-500 dark:text-zinc-400">
                                            Invited {formatDistanceToNow(inv.createdAt, { addSuffix: true })} as {ROLE_LABELS[inv.role] || inv.role}
                                        </p>
                                    </div>
                                    <button type="button" onClick={() => revokeInvitation(inv)} className="inline-flex items-center gap-1 px-2 py-1.5 rounded-md text-xs text-zinc-600 dark:text-zinc-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 transition">
                                        <X className="size-3.5" /> Revoke
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                </SettingsCard>
            )}

            <InviteMemberDialog isDialogOpen={isInviteOpen} setIsDialogOpen={setIsInviteOpen} />

            <ConfirmDialog
                open={!!pendingRemoval}
                title="Remove member?"
                description={pendingRemoval && (
                    <>
                        <span className="font-medium text-zinc-900 dark:text-white">{displayName(pendingRemoval)}</span> will immediately lose access to this workspace.
                        Tasks already assigned to them stay in place so you can reassign them.
                    </>
                )}
                confirmLabel="Remove member"
                onConfirm={removeMember}
                onClose={() => setPendingRemoval(null)}
            />
        </div>
    );
}
