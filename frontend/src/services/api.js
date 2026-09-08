import { apiFetch, getApiUrl } from "./apiClient";

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

export const oauthCallback = (data) =>
    apiFetch("/auth/oauth-callback", {
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

    const res = await fetch(getApiUrl() + "/chat", fetchOptions);

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
    const res = await fetch(getApiUrl() + "/edit", {
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
   EXPORT PDF
========================= */

export const exportPdf = (data) =>
    apiFetch("/export/pdf", {
        method: "POST",
        body: JSON.stringify(data),
    });

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
    return apiFetch("/admin/feed-document", {
        method: "POST",
        body: formData,
    });
};

/* =========================
   FILE UPLOAD
========================= */

export const uploadFile = async(file) => {
    const formData = new FormData();
    formData.append("file", file);

    return apiFetch("/upload", {
        method: "POST",
        body: formData,
    });
};

/* =========================
   AI MODELS
========================= */

export const getAvailableModels = () => apiFetch("/models");

/* =========================
   PROMPTS
========================= */

export const createPrompt = (data) =>
    apiFetch("/prompts", {
        method: "POST",
        body: JSON.stringify(data),
    });

export const getPrompts = (userId) => apiFetch(`/prompts/${userId}`);

export const deletePrompt = (promptId) =>
    apiFetch(`/prompts/${promptId}`, {
        method: "DELETE",
    });

/* =========================
   CHAT SHARING
========================= */

export const generateShareLink = (conversationId) =>
    apiFetch(`/share/conversation/${conversationId}`, {
        method: "POST",
    });

export const getSharedChat = (shareUuid) => apiFetch(`/share/${shareUuid}`);