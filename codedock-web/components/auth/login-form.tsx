// components/auth/login-form.tsx
"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { login } from "@/lib/api/auth";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { loginSession } = useAuth();

  const nextPath = useMemo(() => searchParams.get("next") || "/dashboard", [searchParams]);

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
      setError(err instanceof Error ? err.message : "Login failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="w-full">
      <h1 className="text-2xl font-semibold">Login</h1>
      <p className="mt-2 text-sm text-zinc-400">Sign in to your CodeDock account.</p>

      <form className="mt-6 space-y-4" onSubmit={onSubmit}>
        <div>
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>

        <div>
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>

        {error ? (
          <p className="rounded-[12px] border border-[rgba(255,90,107,0.3)] bg-[rgba(255,90,107,0.08)] px-4 py-3 text-sm text-[rgb(255,160,170)]">
            {error}
          </p>
        ) : null}

        <Button disabled={loading} type="submit">
          {loading ? "Signing in..." : "Login"}
        </Button>
      </form>

      <p className="mt-4 text-sm text-zinc-400">
        Don&apos;t have an account?{" "}
        <Link className="text-white underline" href="/register">
          Register
        </Link>
      </p>
    </Card>
  );
}