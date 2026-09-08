export const getApiUrl = () => {
    if (process.env.REACT_APP_API_URL && process.env.REACT_APP_API_URL.trim()) {
        return process.env.REACT_APP_API_URL.trim().replace(/\/+$/, "");
    }
    if (typeof window !== "undefined" && (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1")) {
        return "http://localhost:8000";
    }
    return "https://relex-ai-backend.onrender.com";
};

export async function apiFetch(path, options = {}) {
    const API = getApiUrl();
    const token = localStorage.getItem("token");

    const headers = {};

    // Only set JSON header if body is NOT FormData
    if (!(options.body instanceof FormData)) {
        headers["Content-Type"] = "application/json";
    }

    if (token) {
        headers["Authorization"] = "Bearer " + token;
    }

    if (options.headers) {
        Object.assign(headers, options.headers);
    }

    const cleanPath = path.startsWith("/") ? path : `/${path}`;
    const res = await fetch(API + cleanPath, {
        ...options,
        headers: headers
    });

    // =========================
    // STREAMING SUPPORT
    // =========================
    if (options.stream === true) {
        if (!res.ok) {
            throw new Error("Streaming request failed");
        }
        return res;
    }

    // =========================
    // NORMAL JSON RESPONSE
    // =========================
    let data = null;

    try {
        data = await res.json();
    } catch (err) {
        data = null; // handles empty responses like 204
    }

    if (!res.ok) {

        let message = "Server error";

        if (data) {
            if (data.detail) {
                message = data.detail;
            } else if (data.error) {
                message = data.error;
            } else if (data.message) {
                message = data.message;
            }
        }

        throw new Error(message);
    }

    return data;
}