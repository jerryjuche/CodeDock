"use strict";
// extension/src/protocol.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.MessageType = void 0;
exports.encodeSyncPayload = encodeSyncPayload;
exports.decodeSyncPayload = decodeSyncPayload;
exports.encodeAwarenessPayload = encodeAwarenessPayload;
exports.decodeAwarenessPayload = decodeAwarenessPayload;
exports.encodeChatPayload = encodeChatPayload;
exports.decodeChatPayload = decodeChatPayload;
exports.isValidMessageType = isValidMessageType;
// --- Message Type Constants ---
exports.MessageType = {
    SYNC: 0x01,
    AWARENESS: 0x02,
    CHAT: 0x03,
};
// --- Sync Payload Encoding ---
// Binary format: [type: 1 byte][filePathLength: 2 bytes][filePath: N bytes][yjsUpdate: remaining]
function encodeSyncPayload(filePath, update) {
    const encoder = new TextEncoder();
    const filePathBytes = encoder.encode(filePath);
    if (filePathBytes.length > 65535) {
        throw new Error(`File path too long: ${filePathBytes.length} bytes. Maximum is 65535.`);
    }
    // 1 byte type + 2 bytes path length + N bytes path + update bytes
    const buffer = new Uint8Array(1 + 2 + filePathBytes.length + update.length);
    let offset = 0;
    // byte 0 — message type
    buffer[offset++] = exports.MessageType.SYNC;
    // bytes 1-2 — file path length as big-endian uint16
    buffer[offset++] = (filePathBytes.length >> 8) & 0xff;
    buffer[offset++] = filePathBytes.length & 0xff;
    // bytes 3 to 3+N — file path
    buffer.set(filePathBytes, offset);
    offset += filePathBytes.length;
    // remaining bytes — Yjs update
    buffer.set(update, offset);
    return buffer;
}
function decodeSyncPayload(buffer) {
    try {
        // minimum valid message: 1 type + 2 length + 1 path char + 1 update byte
        if (buffer.length < 5) {
            return null;
        }
        // byte 0 must be sync type
        if (buffer[0] !== exports.MessageType.SYNC) {
            return null;
        }
        let offset = 1;
        // read file path length — big-endian uint16
        const filePathLength = (buffer[offset++] << 8) | buffer[offset++];
        if (filePathLength === 0) {
            return null;
        }
        if (offset + filePathLength > buffer.length) {
            return null;
        }
        // decode file path
        const decoder = new TextDecoder();
        const filePath = decoder.decode(buffer.slice(offset, offset + filePathLength));
        offset += filePathLength;
        // remaining bytes are the Yjs update
        const update = buffer.slice(offset);
        if (update.length === 0) {
            return null;
        }
        return { filePath, update };
    }
    catch {
        return null;
    }
}
// --- Awareness Encoding ---
function encodeAwarenessPayload(state) {
    const encoder = new TextEncoder();
    const json = JSON.stringify(state);
    const jsonBytes = encoder.encode(json);
    const buffer = new Uint8Array(1 + jsonBytes.length);
    buffer[0] = exports.MessageType.AWARENESS;
    buffer.set(jsonBytes, 1);
    return buffer;
}
function decodeAwarenessPayload(buffer) {
    try {
        if (buffer.length < 2 || buffer[0] !== exports.MessageType.AWARENESS) {
            return null;
        }
        const decoder = new TextDecoder();
        const json = decoder.decode(buffer.slice(1));
        return JSON.parse(json);
    }
    catch {
        return null;
    }
}
// --- Chat Encoding ---
function encodeChatPayload(message) {
    const encoder = new TextEncoder();
    const json = JSON.stringify(message);
    const jsonBytes = encoder.encode(json);
    const buffer = new Uint8Array(1 + jsonBytes.length);
    buffer[0] = exports.MessageType.CHAT;
    buffer.set(jsonBytes, 1);
    return buffer;
}
function decodeChatPayload(buffer) {
    try {
        if (buffer.length < 2 || buffer[0] !== exports.MessageType.CHAT) {
            return null;
        }
        const decoder = new TextDecoder();
        const json = decoder.decode(buffer.slice(1));
        return JSON.parse(json);
    }
    catch {
        return null;
    }
}
// --- Type Guard ---
function isValidMessageType(byte) {
    return byte === exports.MessageType.SYNC
        || byte === exports.MessageType.AWARENESS
        || byte === exports.MessageType.CHAT;
}
//# sourceMappingURL=protocol.js.map