"use client";

import { useEffect, useMemo, useState } from "react";
import { getCurrentUser } from "@/lib/api/auth";
import {
  clearAuthSession,
  getAuthEmail,
  getAuthToken,
  setAuthSession,
} from "@/lib/utils/storage";

export function useAuth() {
  const [token, setToken] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const storedToken = getAuthToken();
    const storedEmail = getAuthEmail();

    if (!storedToken) {
      setToken(null);
      setEmail(null);
      setHydrated(true);
      return;
    }

    setToken(storedToken);
    setEmail(storedEmail);

    void (async () => {
      try {
        const me = await getCurrentUser(storedToken);
        setEmail(me.email);
      } catch {
        clearAuthSession();
        setToken(null);
        setEmail(null);
      } finally {
        setHydrated(true);
      }
    })();
  }, []);

  const isAuthenticated = useMemo(() => Boolean(token), [token]);

  function loginSession(nextToken: string, nextEmail: string) {
    setAuthSession(nextToken, nextEmail);
    setToken(nextToken);
    setEmail(nextEmail);
  }

  function logoutSession() {
    clearAuthSession();
    setToken(null);
    setEmail(null);
  }

  return {
    token,
    email,
    hydrated,
    isAuthenticated,
    loginSession,
    logoutSession,
  };
}