import { createSlice } from "@reduxjs/toolkit";

// The saved theme is read and applied synchronously at startup (before the
// first render) so there's no light-mode flash, and so theme-aware providers
// like Clerk and the toaster start with the right colors.
function readSavedTheme() {
    try {
        return localStorage.getItem("theme") === "dark" ? "dark" : "light";
    } catch {
        return "light";
    }
}

function applyTheme(theme) {
    document.documentElement.classList.toggle("dark", theme === "dark");
    try {
        localStorage.setItem("theme", theme);
    } catch {
        // storage unavailable (private mode): the theme still applies for this visit
    }
}

const initialTheme = readSavedTheme();
if (typeof document !== "undefined") {
    document.documentElement.classList.toggle("dark", initialTheme === "dark");
}

const themeSlice = createSlice({
    name: "theme",
    initialState: { theme: initialTheme },
    reducers: {
        toggleTheme: (state) => {
            state.theme = state.theme === "light" ? "dark" : "light";
            applyTheme(state.theme);
        },
        setTheme: (state, action) => {
            state.theme = action.payload === "dark" ? "dark" : "light";
            applyTheme(state.theme);
        },
        // Kept for existing callers; the theme is already loaded at startup.
        loadTheme: (state) => {
            state.theme = readSavedTheme();
            document.documentElement.classList.toggle("dark", state.theme === "dark");
        },
    },
});

export const { toggleTheme, setTheme, loadTheme } = themeSlice.actions;
export default themeSlice.reducer;
