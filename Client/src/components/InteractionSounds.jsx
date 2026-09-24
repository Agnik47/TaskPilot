import { useEffect, useRef } from "react";
import { useUser } from "@clerk/clerk-react";
import { useToasterStore } from "react-hot-toast";
import { setUiSoundsEnabled, sfx } from "../lib/sound";

const CLICKABLE = "button, a[href], [role='button'], [role='option'], [role='menuitem'], [role='tab'], [role='switch'], select, summary, input[type='checkbox'], input[type='radio']";
const TEXT_INPUT_TYPES = new Set(["text", "search", "email", "url", "tel", "password", "number", ""]);

const isDisabled = (el) => el.disabled || el.getAttribute("aria-disabled") === "true";

function isTextField(el) {
    if (!el) return false;
    if (el.isContentEditable || el.tagName === "TEXTAREA") return true;
    return el.tagName === "INPUT" && TEXT_INPUT_TYPES.has((el.getAttribute("type") || "").toLowerCase());
}

// App-wide interface sounds, attached once at the document level so every
// control gets consistent feedback without per-component wiring.
//   - Elements can opt out or pick a specific sound with data-sfx="none" / data-sfx="<name>".
//   - Switches/checkboxes get an on/off tone based on the state they're moving to.
//   - Success/error toasts play a confirmation tone.
export default function InteractionSounds() {
    const { user } = useUser();
    const uiSounds = user?.unsafeMetadata?.notificationPrefs?.uiSounds !== false;

    useEffect(() => {
        setUiSoundsEnabled(uiSounds);
    }, [uiSounds]);

    useEffect(() => {
        const onPointerDown = (e) => {
            if (e.button !== 0) return;
            const el = e.target.closest?.(CLICKABLE);
            if (!el || isDisabled(el)) return;

            const override = el.closest("[data-sfx]")?.dataset.sfx;
            if (override === "none") return;
            if (override) return sfx(override);

            if (el.getAttribute("role") === "switch") {
                return sfx(el.getAttribute("aria-checked") === "true" ? "toggleOff" : "toggleOn");
            }
            if (el.matches("input[type='checkbox'], input[type='radio']")) {
                return sfx(el.checked ? "toggleOff" : "toggleOn");
            }
            sfx("tap");
        };

        const onKeyDown = (e) => {
            if (e.ctrlKey || e.metaKey || e.altKey || e.isComposing) return;
            if (!isTextField(e.target) || e.target.readOnly || e.target.closest("[data-sfx='none']")) return;
            if (e.key.length === 1 || e.key === "Backspace" || e.key === "Delete") sfx("type");
        };

        document.addEventListener("pointerdown", onPointerDown, true);
        document.addEventListener("keydown", onKeyDown, true);
        return () => {
            document.removeEventListener("pointerdown", onPointerDown, true);
            document.removeEventListener("keydown", onKeyDown, true);
        };
    }, []);

    // Confirmation tones for toast.success / toast.error, played once per toast.
    const { toasts } = useToasterStore();
    const seen = useRef(new Set());
    useEffect(() => {
        for (const t of toasts) {
            if (seen.current.has(t.id)) continue;
            seen.current.add(t.id);
            if (t.type === "success") sfx("success");
            else if (t.type === "error") sfx("error");
        }
    }, [toasts]);

    return null;
}
