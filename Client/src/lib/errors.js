// Extracts a human-readable message from Clerk SDK errors, axios errors
// (our API's { message } body), or plain Errors.
export function errorMessage(error, fallback) {
    return error?.errors?.[0]?.longMessage || error?.errors?.[0]?.message || error?.response?.data?.message || error?.message || fallback;
}
