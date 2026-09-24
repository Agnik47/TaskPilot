import { useClerk, useOrganization, useUser } from "@clerk/clerk-react";
import { format } from "date-fns";
import { ExternalLink, KeyRound, Mail, ShieldCheck, UserCog } from "lucide-react";
import { SectionHeader, SettingsCard, FieldRow, Badge, secondaryButtonClass } from "./SettingsUI";

// Identity/security is owned by Clerk, so this section summarises the account
// and hands off to Clerk's profile modal for edits (name, photo, email,
// password, two-factor, active sessions).
export default function AccountSettings() {
    const { user } = useUser();
    const { membership } = useOrganization();
    const { openUserProfile } = useClerk();

    if (!user) return null;

    const isOwner = membership?.role === "org:admin";

    return (
        <div>
            <SectionHeader title="My Account" description="Your personal profile and sign-in security." />

            <SettingsCard
                title="Profile"
                footer={
                    <>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400">Name and photo are visible to everyone in your workspaces.</p>
                        <button type="button" onClick={() => openUserProfile()} className={secondaryButtonClass}>
                            <UserCog className="size-4" /> Edit profile
                        </button>
                    </>
                }
            >
                <div className="flex items-center gap-4 mb-5">
                    <img src={user.imageUrl} alt="" className="size-14 rounded-full bg-zinc-200 dark:bg-zinc-800" />
                    <div className="min-w-0">
                        <p className="text-base font-semibold text-zinc-900 dark:text-white truncate">{user.fullName || user.username || "Unnamed user"}</p>
                        <p className="text-sm text-zinc-500 dark:text-zinc-400 truncate">{user.primaryEmailAddress?.emailAddress}</p>
                    </div>
                </div>
                <FieldRow label="Role in this workspace">
                    <Badge tone={isOwner ? "purple" : "zinc"}>{isOwner ? "Owner" : "Employee"}</Badge>
                </FieldRow>
                {membership?.createdAt && (
                    <FieldRow label="Joined this workspace">
                        <p className="text-sm text-zinc-700 dark:text-zinc-300">{format(membership.createdAt, "MMMM d, yyyy")}</p>
                    </FieldRow>
                )}
                <FieldRow label="Account created">
                    <p className="text-sm text-zinc-700 dark:text-zinc-300">{format(user.createdAt, "MMMM d, yyyy")}</p>
                </FieldRow>
            </SettingsCard>

            <SettingsCard title="Security" description="Managed securely through your sign-in provider.">
                <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
                    <SecurityRow icon={Mail} label="Email addresses" value={`${user.emailAddresses.length} connected`} onClick={() => openUserProfile()} />
                    <SecurityRow icon={KeyRound} label="Password" value={user.passwordEnabled ? "Set" : "Not set (signs in with a provider)"} onClick={() => openUserProfile()} />
                    <SecurityRow
                        icon={ShieldCheck}
                        label="Two-factor authentication"
                        value={user.twoFactorEnabled ? <Badge tone="blue">Enabled</Badge> : <Badge tone="amber">Not enabled</Badge>}
                        onClick={() => openUserProfile()}
                    />
                </ul>
            </SettingsCard>
        </div>
    );
}

function SecurityRow({ icon, label, value, onClick }) {
    const Icon = icon;
    return (
        <li className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
            <div className="flex items-center gap-3 min-w-0">
                <Icon className="size-4 text-zinc-500 shrink-0" />
                <div className="min-w-0">
                    <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{label}</p>
                    <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">{value}</div>
                </div>
            </div>
            <button type="button" onClick={onClick} className="inline-flex items-center gap-1 text-sm text-blue-600 dark:text-blue-400 hover:underline shrink-0">
                Manage <ExternalLink className="size-3" />
            </button>
        </li>
    );
}
