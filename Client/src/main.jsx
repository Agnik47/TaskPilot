import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.jsx";
import { BrowserRouter } from "react-router-dom";
import { store } from "./app/store.js";
import { Provider } from "react-redux";
import ThemedClerkProvider from "./components/ThemedClerkProvider.jsx";

// Import your Publishable Key
const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

if (!PUBLISHABLE_KEY) {
  throw new Error("Missing Publishable Key");
}

// Redux wraps Clerk so Clerk's own UI can follow the app's light/dark theme.
createRoot(document.getElementById("root")).render(
  <Provider store={store}>
    <BrowserRouter>
      <ThemedClerkProvider publishableKey={PUBLISHABLE_KEY}>
        <App />
      </ThemedClerkProvider>
    </BrowserRouter>
  </Provider>
);
