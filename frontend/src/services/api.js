import { apiFetch } from "./apiClient";

/* =========================
   AUTH
========================= */

export const signup = (data) =>
    apiFetch("/auth/signup", {
        method: "POST",
        body: JSON.stringify(data),
    });

export const login = (data) =>
    apiFetch("/auth/login", {
        method: "POST",
        body: JSON.stringify(data),
    });

/* =========================
   CONVERSATIONS
========================= */

export const createConversation = (data) =>
    apiFetch("/conversation/create", {
        method: "POST",
        body: JSON.stringify(data),
    });

export const getConversations = (userId) =>
    apiFetch(`/conversation/${userId}`);

export const deleteConversation = (conversationId) =>
    apiFetch(`/conversation/${conversationId}`, {
        method: "DELETE",
    });

/* =========================
   PIN / UNPIN
========================= */

export const togglePinConversation = (conversationId) =>
    apiFetch(`/conversation/pin/${conversationId}`, {
        method: "POST",
    });

/* =========================
   RESET UNREAD
========================= */

export const resetUnread = (conversationId) =>
    apiFetch(`/conversation/reset-unread/${conversationId}`, {
        method: "POST",
    });

/* =========================
   SEARCH CONVERSATIONS
========================= */

export const searchConversations = (userId, query) =>
    apiFetch(`/conversation/search/${userId}?query=${query}`);

/* =========================
   MESSAGES (PAGINATED)
========================= */

export const getMessages = (
        conversationId,
        offset = 0,
        limit = 20
    ) =>
    apiFetch(
        `/messages/${conversationId}?offset=${offset}&limit=${limit}`
    );

/* =========================
   CHAT STREAM (RAW FETCH)
========================= */

export const sendMessage = async(data, signal) => {
    const fetchOptions = {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
    };

    if (signal) {
        fetchOptions.signal = signal;
    }

    const res = await fetch("http://localhost:8000/chat", fetchOptions);

    if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Chat request failed");
    }

    return res; // Return raw stream
};

/* =========================
   EDIT MESSAGE (STREAM)
========================= */

export const editMessage = async(data) => {
    const res = await fetch("http://localhost:8000/edit", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
    });

    if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Edit request failed");
    }

    return res;
};

/* =========================
   ADMIN FEEDS
========================= */

export const createFeed = (data) =>
    apiFetch("/admin/feed", {
        method: "POST",
        body: JSON.stringify(data),
    });

export const getAllFeeds = () =>
    apiFetch("/admin/feeds");

export const getUserFeeds = (username) =>
    apiFetch(`/admin/user-feeds/${username}`);

export const markFeedViewed = (feedId, username) =>
    apiFetch(`/admin/mark-feed-viewed/${feedId}/${username}`, {
        method: "POST",
    });

export const uploadAdminFeedDocument = async(formData) => {
    const res = await fetch("http://localhost:8000/admin/feed-document", {
        method: "POST",
        body: formData,
    });
    if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Admin feed document upload failed");
    }
    return res.json();
};

/* =========================
   FILE UPLOAD
========================= */

export const uploadFile = async(file) => {
    const formData = new FormData();
    formData.append("file", file);

    const res = await fetch("http://localhost:8000/upload", {
        method: "POST",
        body: formData,
    });

    if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Upload failed");
    }

    return res.json();
};