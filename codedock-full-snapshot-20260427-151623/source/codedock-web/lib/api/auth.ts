import { apiRequest } from "./client";
import type { AuthResponse, CurrentUser } from "@/types/auth";

export function register(email: string, password: string) {
  return apiRequest<AuthResponse>("/auth/register", {
    method: "POST",
    body: { email, password },
  });
}

export function login(email: string, password: string) {
  return apiRequest<AuthResponse>("/auth/login", {
    method: "POST",
    body: { email, password },
  });
}

export function getCurrentUser(token: string) {
  return apiRequest<CurrentUser>("/auth/me", {
    token,
  });
}