import axios from "axios";

const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL,
});

// Updated from a top-level effect (see ApiTokenSync) whenever Clerk's session
// or active organization changes, so every request carries a fresh token.
let getTokenFn = null;

export const setApiTokenGetter = (fn) => {
    getTokenFn = fn;
};

api.interceptors.request.use(async (config) => {
    if (getTokenFn) {
        const token = await getTokenFn();
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
    }
    return config;
});

export default api;
