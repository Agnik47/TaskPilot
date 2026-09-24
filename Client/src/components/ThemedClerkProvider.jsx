import { ClerkProvider } from "@clerk/clerk-react";
import { dark } from "@clerk/themes";
import { useSelector } from "react-redux";

// Clerk renders its own UI (sign-in, account menu, profile, workspace
// switcher), so it needs to be told about the app's theme explicitly.
const shared = {
    colorPrimary: "#3b82f6", // blue-500, matches the app's primary buttons
    fontFamily: "'Outfit', sans-serif",
    borderRadius: "0.5rem",
};

const appearances = {
    light: { variables: shared },
    dark: {
        baseTheme: dark,
        variables: {
            ...shared,
            colorBackground: "#18181b", // zinc-900
            colorInputBackground: "#27272a", // zinc-800
            colorInputText: "#f4f4f5", // zinc-100
        },
    },
};

export default function ThemedClerkProvider({ publishableKey, children }) {
    const theme = useSelector((state) => state.theme.theme);
    return (
        <ClerkProvider publishableKey={publishableKey} appearance={appearances[theme] || appearances.light}>
            {children}
        </ClerkProvider>
    );
}
