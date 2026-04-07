"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ApiError = void 0;
class ApiError extends Error {
    constructor(status, message) {
        super(message);
        this.status = status;
        this.name = "ApiError";
    }
}
exports.ApiError = ApiError;
//# sourceMappingURL=types.js.map