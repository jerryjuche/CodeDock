"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ApiClient = void 0;
const types_1 = require("./types");
const REQUEST_TIMEOUT_MS = 10000;
class ApiClient {
    constructor(baseUrl) {
        this.baseUrl = baseUrl;
    }
    async login(email, password) {
        return this.request('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ email, password })
        }, false);
    }
    async validateToken(token) {
        return this.request('/auth/me', { method: 'GET' }, true, token);
    }
    async getRooms(token) {
        return this.request('/rooms', { method: 'GET' }, true, token);
    }
    async createRoom(token, name) {
        return this.request('/rooms', {
            method: 'POST',
            body: JSON.stringify({ name })
        }, true, token);
    }
    async request(path, options, authenticated, token) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
        const headers = {
            'Content-Type': 'application/json',
            ...(options.headers ?? {})
        };
        if (authenticated && token) {
            headers['Authorization'] = `Bearer ${token}`;
        }
        try {
            const response = await fetch(`${this.baseUrl}${path}`, {
                ...options,
                headers,
                signal: controller.signal
            });
            if (!response.ok) {
                const body = await response.text();
                throw new types_1.ApiError(response.status, body || `HTTP ${response.status}`);
            }
            const text = await response.text();
            return text ? JSON.parse(text) : {};
        }
        catch (err) {
            if (err instanceof types_1.ApiError) {
                throw err;
            }
            if (err instanceof DOMException && err.name === 'AbortError') {
                throw new types_1.ApiError(408, 'Request timed out — is the server reachable?');
            }
            throw new types_1.ApiError(0, `Network error: ${err instanceof Error ? err.message : 'unknown'}`);
        }
        finally {
            clearTimeout(timeout);
        }
    }
}
exports.ApiClient = ApiClient;
//# sourceMappingURL=api.js.map