"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.debounce = debounce;
exports.throttle = throttle;
exports.joinUrl = joinUrl;
exports.colorFromUserId = colorFromUserId;
exports.safeDispose = safeDispose;
function debounce(fn, delay) {
    let timer = null;
    return (...args) => {
        if (timer) {
            clearTimeout(timer);
        }
        timer = setTimeout(() => {
            fn(...args);
            timer = null;
        }, delay);
    };
}
// --- Throttle ---
// Fires at most once per `interval` ms
// Ignores calls that arrive too soon
function throttle(fn, interval) {
    let lastFired = 0;
    return (...args) => {
        const now = Date.now();
        if (now - lastFired >= interval) {
            lastFired = now;
            fn(...args);
        }
    };
}
// --- URL Join ---
// Safely joins a base URL and a path
// Prevents double slashes
function joinUrl(base, path) {
    return base.replace(/\/+$/, "") + "/" + path.replace(/^\/+/, "");
}
// --- Stable Color From User ID ---
// Deterministically derives a hex color from any string
// Same user ID always produces the same color
function colorFromUserId(userId) {
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
        hash = userId.charCodeAt(i) + ((hash << 5) - hash);
        hash = hash & hash; // convert to 32-bit integer
    }
    const r = (hash >> 16) & 0xff;
    const g = (hash >> 8) & 0xff;
    const b = hash & 0xff;
    // ensure minimum brightness — avoid colors too dark to see
    const brightness = (r * 299 + g * 587 + b * 114) / 1000;
    if (brightness < 80) {
        return colorFromUserId(userId + "_");
    }
    return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}
// --- Safe Dispose ---
// Calls dispose on an object if it exists
// Prevents errors when disposing optional resources
function safeDispose(disposable) {
    try {
        disposable?.dispose();
    }
    catch {
        // ignore disposal errors
    }
}
//# sourceMappingURL=utils.js.map