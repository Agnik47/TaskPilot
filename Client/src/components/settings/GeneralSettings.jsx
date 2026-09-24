import { useEffect, useRef, useState } from "react";
import { useOrganization } from "@clerk/clerk-react";
import { format } from "date-fns";
import { Building2, Copy, Check, Upload, Loader2Icon } from "lucide-react";
import toast from "react-hot-toast";
import { errorMessage } from "../../lib/errors";
import useOrgRole from "../../hooks/useOrgRole";
import { SectionHeader, SettingsCard, FieldRow, ReadOnlyNotice, inputClass, primaryButtonClass, secondaryButtonClass } from "./SettingsUI";

const MAX_LOGO_BYTES = 10 * 1024 * 1024;

export default function GeneralSettings() {
    const { organization } = useOrganization();
    const { isOwner } = useOrgRole();
    const fileInputRef = useRef(null);

    const [name, setName] = useState("");
    const [slug, setSlug] = useState("");
    const [saving, setSaving] = useState(false);
    const [logoBusy, setLogoBusy] = useState(false);
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        setName(organization?.name || "");
        setSlug(organization?.slug || "");
    }, [organization?.id, organization?.name, organization?.slug]);

    if (!organization) return null;

    const isDirty = name.trim() !== organization.name || (slug || "") !== (organization.slug || "");

    const handleSave = async (e) => {
        e.preventDefault();
        if (!name.trim()) return toast.error("Workspace name is required");

        try {
            setSaving(true);
            await organization.update({ name: name.trim(), slug: slug.trim() || undefined });
            toast.success("Workspace updated");
        } catch (error) {
            toast.error(errorMessage(error, "Failed to update workspace"));
        } finally {
            setSaving(false);
        }
    };

    const handleLogoChange = async (e) => {
        const file = e.target.files?.[0];
        e.target.value = "";
        if (!file) return;
        if (!file.type.startsWith("image/")) return toast.error("Please choose an image file");
        if (file.size > MAX_LOGO_BYTES) return toast.error("Logo must be smaller than 10 MB");

        try {
            setLogoBusy(true);
            await organization.setLogo({ file });
            toast.success("Logo updated");
        } catch (error) {
            toast.error(errorMessage(error, "Failed to upload logo"));
        } finally {
            setLogoBusy(false);
        }
    };

    const handleLogoRemove = async () => {
        try {
            setLogoBusy(true);
            await organization.setLogo({ file: null });
            toast.success("Logo removed");
        } catch (error) {
            toast.error(errorMessage(error, "Failed to remove logo"));
        } finally {
            setLogoBusy(false);
        }
    };

    const copyId = async () => {
        try {
            await navigator.clipboard.writeText(organization.id);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
        } catch {
            toast.error("Could not copy to clipboard");
        }
    };

    return (
        <div>
            <SectionHeader title="General" description="Your workspace's identity as it appears to everyone on the team." />

            {!isOwner && <ReadOnlyNotice>Only workspace owners can change these settings.</ReadOnlyNotice>}

            <SettingsCard title="Workspace logo" description="Shown in the workspace switcher. Square images work best (PNG, JPG, or GIF, up to 10 MB).">
                <div className="flex items-center gap-4">
                    <div className="size-16 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800 overflow-hidden flex items-center justify-center shrink-0">
                        {organization.hasImage ? (
                            <img src={organization.imageUrl} alt={organization.name} className="size-full object-cover" />
                        ) : (
                            <Building2 className="size-6 text-zinc-400" />
                        )}
                    </div>
                    {isOwner && (
                        <div className="flex flex-wrap gap-2">
                            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoChange} />
                            <button type="button" onClick={() => fileInputRef.current?.click()} disabled={logoBusy} className={secondaryButtonClass}>
                                {logoBusy ? <Loader2Icon className="size-4 animate-spin" /> : <Upload className="size-4" />}
                                Upload new
                            </button>
                            {organization.hasImage && (
                                <button type="button" onClick={handleLogoRemove} disabled={logoBusy} className="px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:underline disabled:opacity-50">
                                    Remove
                                </button>
                            )}
                        </div>
                    )}
                </div>
            </SettingsCard>

            <form onSubmit={handleSave}>
                <SettingsCard
                    title="Workspace details"
                    footer={isOwner && (
                        <>
                            <p className="text-xs text-zinc-500 dark:text-zinc-400">Changes apply to all members immediately.</p>
                            <div className="flex gap-2">
                                <button type="button" disabled={!isDirty || saving} onClick={() => { setName(organization.name); setSlug(organization.slug || ""); }} className={secondaryButtonClass}>
                                    Reset
                                </button>
                                <button type="submit" disabled={!isDirty || saving} className={primaryButtonClass}>
                                    {saving && <Loader2Icon className="size-4 animate-spin" />}
                                    Save changes
                                </button>
                            </div>
                        </>
                    )}
                >
                    <FieldRow label="Workspace name" help="Usually your company or team name.">
                        <input value={name} onChange={(e) => setName(e.target.value)} maxLength={64} disabled={!isOwner} className={inputClass} required />
                    </FieldRow>
                    <FieldRow label="Workspace URL slug" help="Lowercase letters, numbers, and hyphens.">
                        <input value={slug} onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))} maxLength={64} disabled={!isOwner} className={inputClass} placeholder="my-company" />
                    </FieldRow>
                    <FieldRow label="Workspace ID" help="Share this with support if you need help.">
                        <div className="flex gap-2">
                            <input value={organization.id} readOnly className={`${inputClass} font-mono text-xs`} />
                            <button type="button" onClick={copyId} className={secondaryButtonClass} aria-label="Copy workspace ID">
                                {copied ? <Check className="size-4 text-emerald-500" /> : <Copy className="size-4" />}
                            </button>
                        </div>
                    </FieldRow>
                    <FieldRow label="Created">
                        <p className="text-sm text-zinc-700 dark:text-zinc-300 py-2">{format(organization.createdAt, "MMMM d, yyyy")}</p>
                    </FieldRow>
                    <FieldRow label="Members">
                        <p className="text-sm text-zinc-700 dark:text-zinc-300 py-2">
                            {organization.membersCount} {organization.membersCount === 1 ? "member" : "members"}
                            {isOwner && organization.pendingInvitationsCount > 0 && ` · ${organization.pendingInvitationsCount} pending invitation${organization.pendingInvitationsCount === 1 ? "" : "s"}`}
                        </p>
                    </FieldRow>
                </SettingsCard>
            </form>
        </div>
    );
}
