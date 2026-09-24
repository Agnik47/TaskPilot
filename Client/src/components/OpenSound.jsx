import { useEffect } from "react";
import { sfx } from "../lib/sound";

// Render inside a dialog/sheet to play the "open" sound when it appears.
export default function OpenSound() {
    useEffect(() => {
        sfx("open");
    }, []);
    return null;
}
