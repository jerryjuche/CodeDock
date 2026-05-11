// components/auth/login-form.tsx
// NOTE: AuthShell already provides the outer card panel.
// This form renders INSIDE that shell — no wrapping <Card> needed.
"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { login } from "@/lib/api/auth";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { loginSession } = useAuth();

  const nextPath = useMemo(
    () => searchParams.get("next") || "/dashboard",
    [searchParams],
  );

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const response = await login(email.trim(), password);
      loginSession(response.token, response.email);
      router.replace(nextPath);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Login failed. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="space-y-5" onSubmit={onSubmit}>
      <div className="space-y-1.5">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          placeholder="you@company.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          type="password"
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoComplete="current-password"
        />
      </div>

      {error ? (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-[12px] border border-[rgba(255,90,107,0.25)] bg-[rgba(255,90,107,0.08)] px-4 py-3"
        >
          <span className="mt-0.5 h-4 w-4 flex-shrink-0 text-[rgb(255,90,107)]">
            <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <circle
                cx="8"
                cy="8"
                r="7"
                stroke="currentColor"
                strokeWidth="1.5"
              />
              <path
                d="M8 5v4M8 11h.01"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </span>
          <p className="text-sm leading-relaxed text-[rgb(255,160,170)]">
            {error}
          </p>
        </div>
      ) : null}

      <div className="pt-1">
        <Button disabled={loading} type="submit" className="w-full">
          {loading ? "Signing in…" : "Sign in"}
        </Button>
      </div>

      <p className="text-center text-sm text-[rgb(158,183,211)]">
        No account?{" "}
        <Link
          className="font-medium text-white underline-offset-2 transition-all duration-200 ease-out hover:-translate-y-[1px] hover:text-[rgb(47,203,255)] hover:underline"
          href="/register"
        >
          Create one
        </Link>
      </p>
    </form>
  );
}