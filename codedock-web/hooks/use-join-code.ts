"use client";

import { useState } from "react";
import { resolveJoinCode } from "@/lib/api/rooms";
import { useAuth } from "@/hooks/use-auth";

export function useJoinCode() {
  const { token } = useAuth();
  const [loading, setLoading] = useState(false);

  async function resolveCode(code: string) {
    if (!token) {
      throw new Error("You are not logged in.");
    }

    setLoading(true);
    try {
      return await resolveJoinCode(token, code);
    } finally {
      setLoading(false);
    }
  }

  return { resolveCode, loading };
}
