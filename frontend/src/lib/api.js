/**
 * src/lib/api.js
 *
 * Centralized API client for communicating with the FastAPI backend.
 *
 * By default, requests go to '/api/...' which Next.js rewrites to the
 * backend via the proxy configured in next.config.js.
 * Set NEXT_PUBLIC_API_URL to override (e.g. for production builds).
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || '';

/**
 * GET helper — returns parsed JSON or throws.
 * @param {string} path - e.g. '/api/candidates'
 * @param {Record<string, string>} [params] - optional query params
 */
export async function apiGet(path, params = {}) {
    const url = new URL(`${API_BASE}${path}`, window.location.origin);
    Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== '') {
            url.searchParams.set(k, v);
        }
    });

    const res = await fetch(url.toString());
    if (!res.ok) {
        const detail = await res.text().catch(() => res.statusText);
        throw new Error(`API error ${res.status}: ${detail}`);
    }
    return res.json();
}

/**
 * POST helper — sends JSON body, returns parsed JSON.
 * @param {string} path
 * @param {object} body
 */
export async function apiPost(path, body) {
    const res = await fetch(`${API_BASE}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    if (!res.ok) {
        const detail = await res.text().catch(() => res.statusText);
        throw new Error(`API error ${res.status}: ${detail}`);
    }
    return res.json();
}

/**
 * PATCH helper — sends JSON body, returns parsed JSON.
 * @param {string} path
 * @param {object} body
 */
export async function apiPatch(path, body) {
    const res = await fetch(`${API_BASE}${path}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    if (!res.ok) {
        const detail = await res.text().catch(() => res.statusText);
        throw new Error(`API error ${res.status}: ${detail}`);
    }
    return res.json();
}

/**
 * Upload a file via multipart form data.
 * @param {string} path
 * @param {FormData} formData
 */
export async function apiUpload(path, formData) {
    const res = await fetch(`${API_BASE}${path}`, {
        method: 'POST',
        body: formData,
        // Don't set Content-Type — browser sets it with boundary
    });
    if (!res.ok) {
        const detail = await res.text().catch(() => res.statusText);
        throw new Error(`API error ${res.status}: ${detail}`);
    }
    return res.json();
}
