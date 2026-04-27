#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="${1:-codedock-web}"

mkdir -p \
  "$ROOT/app/(auth)/login" \
  "$ROOT/app/(auth)/register" \
  "$ROOT/app/(app)/dashboard" \
  "$ROOT/app/(app)/join" \
  "$ROOT/app/(app)/rooms/new" \
  "$ROOT/app/(app)/rooms/[roomId]" \
  "$ROOT/components/auth" \
  "$ROOT/components/dashboard" \
  "$ROOT/components/rooms" \
  "$ROOT/components/ui" \
  "$ROOT/lib/api" \
  "$ROOT/lib/config" \
  "$ROOT/lib/utils" \
  "$ROOT/hooks" \
  "$ROOT/types"

write_file() {
  local path="$1"
  shift
  cat > "$path" <<'EOF'
'"$*"'
EOF
}

# -------------------------
# Root config files
# -------------------------

cat > "$ROOT/package.json" <<'EOF'
{
  "name": "codedock-web",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev -p 3000",
    "build": "next build",
    "start": "next start -p 3000",
    "lint": "next lint"
  },
  "dependencies": {
    "@tanstack/react-query": "^5.59.0",
    "@tanstack/react-query-devtools": "^5.59.0",
    "next": "^15.0.0",
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  },
  "devDependencies": {
    "@types/node": "^22.8.0",
    "@types/react": "^18.3.3",
    "@types/react-dom": "^18.3.0",
    "autoprefixer": "^10.4.20",
    "postcss": "^8.4.47",
    "tailwindcss": "^3.4.13",
    "typescript": "^5.6.3"
  }
}
EOF

cat > "$ROOT/tsconfig.json" <<'EOF'
{
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": false,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "baseUrl": ".",
    "paths": {
      "@/*": ["./*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
EOF

cat > "$ROOT/next.config.ts" <<'EOF'
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true
};

export default nextConfig;
EOF

cat > "$ROOT/next-env.d.ts" <<'EOF'
/// <reference types="next" />
/// <reference types="next/image-types/global" />

// This file is auto-used by Next.js
EOF

cat > "$ROOT/postcss.config.js" <<'EOF'
module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {}
  }
};
EOF

cat > "$ROOT/tailwind.config.ts" <<'EOF'
import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./hooks/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {}
  },
  plugins: []
};

export default config;
EOF

cat > "$ROOT/middleware.ts" <<'EOF'
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

export function middleware(_request: NextRequest) {
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"]
};
EOF

cat > "$ROOT/.env.example" <<'EOF'
NEXT_PUBLIC_API_BASE_URL=http://localhost:8080
EOF

# -------------------------
# App files
# -------------------------

cat > "$ROOT/app/globals.css" <<'EOF'
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  color-scheme: dark;
}

html,
body {
  min-height: 100%;
}

body {
  @apply bg-zinc-950 text-zinc-100 antialiased;
}

a {
  @apply text-inherit no-underline;
}
EOF

cat > "$ROOT/app/layout.tsx" <<'EOF'
import "./globals.css";
import type { Metadata } from "next";
import Providers from "@/components/ui/providers";

export const metadata: Metadata = {
  title: "CodeDock",
  description: "CodeDock control plane"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
EOF

cat > "$ROOT/app/page.tsx" <<'EOF'
import Link from "next/link";

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col items-center justify-center gap-6 px-6">
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-10 shadow-xl">
        <h1 className="text-4xl font-semibold tracking-tight">CodeDock</h1>
        <p className="mt-3 max-w-xl text-zinc-400">
          Web control plane for rooms, invites, launch tokens, and VS Code collaboration.
        </p>
        <div className="mt-6 flex gap-3">
          <Link className="rounded-xl bg-white px-4 py-2 text-sm font-medium text-black" href="/login">
            Login
          </Link>
          <Link className="rounded-xl border border-zinc-700 px-4 py-2 text-sm font-medium" href="/register">
            Register
          </Link>
          <Link className="rounded-xl border border-zinc-700 px-4 py-2 text-sm font-medium" href="/dashboard">
            Dashboard
          </Link>
        </div>
      </div>
    </main>
  );
}
EOF

cat > "$ROOT/app/(auth)/login/page.tsx" <<'EOF'
import LoginForm from "@/components/auth/login-form";

export default function LoginPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md items-center px-6">
      <LoginForm />
    </main>
  );
}
EOF

cat > "$ROOT/app/(auth)/register/page.tsx" <<'EOF'
import RegisterForm from "@/components/auth/register-form";

export default function RegisterPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md items-center px-6">
      <RegisterForm />
    </main>
  );
}
EOF

cat > "$ROOT/app/(app)/dashboard/page.tsx" <<'EOF'
"use client";

import JoinCodeForm from "@/components/dashboard/join-code-form";
import RoomList from "@/components/dashboard/room-list";

export default function DashboardPage() {
  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-semibold">Dashboard</h1>
        <p className="mt-2 text-zinc-400">Manage rooms, join by code, and launch collaboration sessions.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_0.8fr]">
        <RoomList />
        <JoinCodeForm />
      </div>
    </main>
  );
}
EOF

cat > "$ROOT/app/(app)/join/page.tsx" <<'EOF'
"use client";

import JoinCodeForm from "@/components/dashboard/join-code-form";

export default function JoinPage() {
  return (
    <main className="mx-auto max-w-xl px-6 py-10">
      <h1 className="text-3xl font-semibold">Join Room</h1>
      <p className="mt-2 text-zinc-400">Enter a 6-character invite code to join a room.</p>
      <div className="mt-6">
        <JoinCodeForm />
      </div>
    </main>
  );
}
EOF

cat > "$ROOT/app/(app)/rooms/new/page.tsx" <<'EOF'
import CreateRoomForm from "@/components/rooms/create-room-form";

export default function NewRoomPage() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-10">
      <h1 className="text-3xl font-semibold">Create Room</h1>
      <p className="mt-2 text-zinc-400">Create a new CodeDock room and choose the project source.</p>
      <div className="mt-6">
        <CreateRoomForm />
      </div>
    </main>
  );
}
EOF

cat > "$ROOT/app/(app)/rooms/[roomId]/page.tsx" <<'EOF'
import InviteCreateForm from "@/components/rooms/invite-create-form";
import InviteList from "@/components/rooms/invite-list";
import OpenInVSCodeButton from "@/components/rooms/open-in-vscode-button";
import RoomHeader from "@/components/rooms/room-header";

type Props = {
  params: Promise<{
    roomId: string;
  }>;
};

export default async function RoomDetailsPage({ params }: Props) {
  const { roomId } = await params;

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <RoomHeader roomId={roomId} />
      <div className="mt-8 grid gap-6 lg:grid-cols-[1.3fr_0.7fr]">
        <InviteList roomId={roomId} />
        <div className="space-y-6">
          <InviteCreateForm roomId={roomId} />
          <OpenInVSCodeButton roomId={roomId} />
        </div>
      </div>
    </main>
  );
}
EOF

# -------------------------
# UI providers
# -------------------------

cat > "$ROOT/components/ui/providers.tsx" <<'EOF'
"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";

export default function Providers({
  children
}: {
  children: React.ReactNode;
}) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            retry: 1,
            staleTime: 10_000
          }
        }
      }),
  );

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
EOF

# -------------------------
# UI primitives
# -------------------------

cat > "$ROOT/components/ui/button.tsx" <<'EOF'
import * as React from "react";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "danger";
};

export function Button({
  className = "",
  variant = "primary",
  ...props
}: ButtonProps) {
  const variants: Record<string, string> = {
    primary: "bg-white text-black hover:bg-zinc-200",
    secondary: "border border-zinc-700 bg-zinc-900 text-zinc-100 hover:bg-zinc-800",
    danger: "bg-red-600 text-white hover:bg-red-500"
  };

  return (
    <button
      className={`inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-medium transition ${variants[variant]} ${className}`}
      {...props}
    />
  );
}
EOF

cat > "$ROOT/components/ui/card.tsx" <<'EOF'
import * as React from "react";

export function Card({
  className = "",
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`rounded-2xl border border-zinc-800 bg-zinc-900/70 p-6 shadow-xl ${className}`}
      {...props}
    />
  );
}
EOF

cat > "$ROOT/components/ui/input.tsx" <<'EOF'
import * as React from "react";

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm outline-none ring-0 placeholder:text-zinc-500 focus:border-zinc-600"
      {...props}
    />
  );
}
EOF

cat > "$ROOT/components/ui/label.tsx" <<'EOF'
import * as React from "react";

export function Label({
  className = "",
  ...props
}: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={`mb-2 block text-sm font-medium text-zinc-300 ${className}`} {...props} />;
}
EOF

cat > "$ROOT/components/ui/badge.tsx" <<'EOF'
import * as React from "react";

export function Badge({
  className = "",
  ...props
}: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={`inline-flex rounded-full border border-zinc-700 bg-zinc-950 px-2.5 py-1 text-xs font-medium text-zinc-300 ${className}`}
      {...props}
    />
  );
}
EOF

cat > "$ROOT/components/ui/spinner.tsx" <<'EOF'
export function Spinner() {
  return (
    <div className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-500 border-t-white" />
  );
}
EOF

cat > "$ROOT/components/ui/toast.tsx" <<'EOF'
export function toastInfo(message: string) {
  if (typeof window !== "undefined") {
    window.alert(message);
  }
}
EOF

# -------------------------
# Auth components
# -------------------------

cat > "$ROOT/components/auth/auth-guard.tsx" <<'EOF'
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";

export default function AuthGuard({
  children
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { isAuthenticated } = useAuth();

  useEffect(() => {
    if (!isAuthenticated) {
      router.replace("/login");
    }
  }, [isAuthenticated, router]);

  if (!isAuthenticated) {
    return null;
  }

  return <>{children}</>;
}
EOF

cat > "$ROOT/components/auth/login-form.tsx" <<'EOF'
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { login } from "@/lib/api/auth";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function LoginForm() {
  const router = useRouter();
  const { loginSession } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const response = await login(email, password);
      loginSession(response.token, response.email);
      router.push("/dashboard");
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Login failed");
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
          <Input id="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <div>
          <Label htmlFor="password">Password</Label>
          <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </div>
        <Button disabled={loading} type="submit">
          {loading ? "Signing in..." : "Login"}
        </Button>
      </form>
    </Card>
  );
}
EOF

cat > "$ROOT/components/auth/register-form.tsx" <<'EOF'
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { register } from "@/lib/api/auth";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function RegisterForm() {
  const router = useRouter();
  const { loginSession } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const response = await register(email, password);
      loginSession(response.token, response.email);
      router.push("/dashboard");
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Registration failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="w-full">
      <h1 className="text-2xl font-semibold">Register</h1>
      <p className="mt-2 text-sm text-zinc-400">Create your CodeDock account.</p>
      <form className="mt-6 space-y-4" onSubmit={onSubmit}>
        <div>
          <Label htmlFor="email">Email</Label>
          <Input id="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <div>
          <Label htmlFor="password">Password</Label>
          <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </div>
        <Button disabled={loading} type="submit">
          {loading ? "Creating account..." : "Register"}
        </Button>
      </form>
    </Card>
  );
}
EOF

# -------------------------
# Dashboard components
# -------------------------

cat > "$ROOT/components/dashboard/room-card.tsx" <<'EOF'
import Link from "next/link";
import type { Room } from "@/types/room";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function RoomCard({ room }: { room: Room }) {
  return (
    <Card>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold">{room.name}</h3>
          <p className="mt-1 text-sm text-zinc-400">{room.slug}</p>
        </div>
        <Badge>{room.source_type}</Badge>
      </div>
      <p className="mt-4 text-sm text-zinc-400">Primary code: {room.primary_join_code}</p>
      <Link className="mt-4 inline-block text-sm font-medium underline" href={`/rooms/${room.id}`}>
        Open room
      </Link>
    </Card>
  );
}
EOF

cat > "$ROOT/components/dashboard/room-list.tsx" <<'EOF'
"use client";

import Link from "next/link";
import { useRooms } from "@/hooks/use-rooms";
import { Card } from "@/components/ui/card";
import RoomCard from "./room-card";

export default function RoomList() {
  const { rooms, loading, error } = useRooms();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Your Rooms</h2>
        <Link className="rounded-xl border border-zinc-700 px-4 py-2 text-sm font-medium" href="/rooms/new">
          Create Room
        </Link>
      </div>

      {loading ? (
        <Card>Loading rooms...</Card>
      ) : error ? (
        <Card>{error}</Card>
      ) : rooms.length === 0 ? (
        <Card>No rooms yet.</Card>
      ) : (
        <div className="grid gap-4">
          {rooms.map((room) => (
            <RoomCard key={room.id} room={room} />
          ))}
        </div>
      )}
    </div>
  );
}
EOF

cat > "$ROOT/components/dashboard/join-code-form.tsx" <<'EOF'
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useJoinCode } from "@/hooks/use-join-code";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function JoinCodeForm() {
  const router = useRouter();
  const { resolveCode, loading } = useJoinCode();
  const [code, setCode] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      const result = await resolveCode(code);
      router.push(`/rooms/${result.room.id}`);
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Join failed");
    }
  }

  return (
    <Card>
      <h2 className="text-xl font-semibold">Join by Code</h2>
      <p className="mt-2 text-sm text-zinc-400">Enter a 6-character invite code.</p>
      <form className="mt-6 space-y-4" onSubmit={onSubmit}>
        <div>
          <Label htmlFor="join-code">Invite Code</Label>
          <Input
            id="join-code"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            maxLength={6}
            required
          />
        </div>
        <Button disabled={loading} type="submit">
          {loading ? "Joining..." : "Join Room"}
        </Button>
      </form>
    </Card>
  );
}
EOF

# -------------------------
# Room components
# -------------------------

cat > "$ROOT/components/rooms/create-room-form.tsx" <<'EOF'
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createRoom } from "@/lib/api/rooms";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function CreateRoomForm() {
  const router = useRouter();
  const { token } = useAuth();

  const [name, setName] = useState("");
  const [sourceType, setSourceType] = useState<"local_workspace" | "github_repo">("local_workspace");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!token) {
      window.alert("You must be logged in.");
      return;
    }

    setLoading(true);
    try {
      const room = await createRoom(token, {
        name,
        source_type: sourceType,
        source_metadata: {}
      });
      router.push(`/rooms/${room.id}`);
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Create room failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <form className="space-y-4" onSubmit={onSubmit}>
        <div>
          <Label htmlFor="room-name">Room Name</Label>
          <Input id="room-name" value={name} onChange={(e) => setName(e.target.value)} required />
        </div>

        <div>
          <Label htmlFor="source-type">Source Type</Label>
          <select
            id="source-type"
            className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm"
            value={sourceType}
            onChange={(e) => setSourceType(e.target.value as "local_workspace" | "github_repo")}
          >
            <option value="local_workspace">Local Workspace</option>
            <option value="github_repo">GitHub Repository</option>
          </select>
        </div>

        <Button disabled={loading} type="submit">
          {loading ? "Creating..." : "Create Room"}
        </Button>
      </form>
    </Card>
  );
}
EOF

cat > "$ROOT/components/rooms/invite-list.tsx" <<'EOF'
"use client";

import { useInvites } from "@/hooks/use-invites";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function InviteList({ roomId }: { roomId: string }) {
  const { invites, loading, error, revokeInvite } = useInvites(roomId);

  return (
    <Card>
      <h2 className="text-xl font-semibold">Invite Tokens</h2>
      <p className="mt-2 text-sm text-zinc-400">Manage room-specific invite tokens.</p>

      <div className="mt-6 space-y-3">
        {loading ? (
          <div>Loading invites...</div>
        ) : error ? (
          <div>{error}</div>
        ) : invites.length === 0 ? (
          <div className="text-sm text-zinc-400">No invite tokens yet.</div>
        ) : (
          invites.map((invite) => (
            <div
              key={invite.id}
              className="rounded-xl border border-zinc-800 bg-zinc-950 p-4"
            >
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="font-mono text-sm font-semibold">{invite.code}</div>
                  <div className="mt-1 text-xs text-zinc-500">
                    uses: {invite.uses_count}
                    {invite.max_uses ? ` / ${invite.max_uses}` : ""}
                    {invite.is_revoked ? " · revoked" : ""}
                  </div>
                </div>
                <Button variant="secondary" onClick={() => revokeInvite(invite.id)}>
                  Revoke
                </Button>
              </div>
            </div>
          ))
        )}
      </div>
    </Card>
  );
}
EOF

cat > "$ROOT/components/rooms/invite-create-form.tsx" <<'EOF'
"use client";

import { useState } from "react";
import { useInvites } from "@/hooks/use-invites";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function InviteCreateForm({ roomId }: { roomId: string }) {
  const { createInvite } = useInvites(roomId);
  const [expiresInHours, setExpiresInHours] = useState("");
  const [maxUses, setMaxUses] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();

    try {
      await createInvite({
        expires_in_hours: expiresInHours ? Number(expiresInHours) : undefined,
        max_uses: maxUses ? Number(maxUses) : undefined
      });
      setExpiresInHours("");
      setMaxUses("");
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Invite creation failed");
    }
  }

  return (
    <Card>
      <h3 className="text-lg font-semibold">Create Invite</h3>
      <form className="mt-4 space-y-4" onSubmit={onSubmit}>
        <div>
          <Label htmlFor="expires-in-hours">Expires In Hours</Label>
          <Input
            id="expires-in-hours"
            type="number"
            min={1}
            value={expiresInHours}
            onChange={(e) => setExpiresInHours(e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="max-uses">Max Uses</Label>
          <Input
            id="max-uses"
            type="number"
            min={1}
            value={maxUses}
            onChange={(e) => setMaxUses(e.target.value)}
          />
        </div>
        <Button type="submit">Create Invite Token</Button>
      </form>
    </Card>
  );
}
EOF

cat > "$ROOT/components/rooms/open-in-vscode-button.tsx" <<'EOF'
"use client";

import { useLaunch } from "@/hooks/use-launch";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default function OpenInVSCodeButton({ roomId }: { roomId: string }) {
  const { openRoom, loading } = useLaunch(roomId);

  return (
    <Card>
      <h3 className="text-lg font-semibold">Launch</h3>
      <p className="mt-2 text-sm text-zinc-400">
        Generate a one-time launch token and open the room in VS Code.
      </p>
      <div className="mt-4">
        <Button disabled={loading} onClick={openRoom}>
          {loading ? "Opening..." : "Open in VS Code"}
        </Button>
      </div>
    </Card>
  );
}
EOF

cat > "$ROOT/components/rooms/room-header.tsx" <<'EOF'
"use client";

import { useRoom } from "@/hooks/use-room";
import RoomSourceBadge from "./room-source-badge";
import { Card } from "@/components/ui/card";

export default function RoomHeader({ roomId }: { roomId: string }) {
  const { room, loading, error } = useRoom(roomId);

  if (loading) {
    return <Card>Loading room...</Card>;
  }

  if (error || !room) {
    return <Card>{error ?? "Room not found"}</Card>;
  }

  return (
    <Card>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold">{room.name}</h1>
          <p className="mt-2 text-sm text-zinc-400">Slug: {room.slug}</p>
          <p className="mt-1 text-sm text-zinc-400">Primary code: {room.primary_join_code}</p>
        </div>
        <RoomSourceBadge sourceType={room.source_type} />
      </div>
    </Card>
  );
}
EOF

cat > "$ROOT/components/rooms/room-source-badge.tsx" <<'EOF'
import { Badge } from "@/components/ui/badge";

export default function RoomSourceBadge({
  sourceType
}: {
  sourceType: "local_workspace" | "github_repo";
}) {
  return <Badge>{sourceType}</Badge>;
}
EOF

# -------------------------
# Hooks
# -------------------------

cat > "$ROOT/hooks/use-auth.ts" <<'EOF'
"use client";

import { useMemo, useState } from "react";
import { clearAuthSession, getAuthToken, setAuthSession } from "@/lib/utils/storage";

export function useAuth() {
  const [token, setToken] = useState<string | null>(() => getAuthToken());

  const isAuthenticated = useMemo(() => Boolean(token), [token]);

  function loginSession(nextToken: string, email: string) {
    setAuthSession(nextToken, email);
    setToken(nextToken);
  }

  function logoutSession() {
    clearAuthSession();
    setToken(null);
  }

  return {
    token,
    isAuthenticated,
    loginSession,
    logoutSession
  };
}
EOF

cat > "$ROOT/hooks/use-rooms.ts" <<'EOF'
"use client";

import { useEffect, useState } from "react";
import { getRooms } from "@/lib/api/rooms";
import { useAuth } from "@/hooks/use-auth";
import type { Room } from "@/types/room";

export function useRooms() {
  const { token } = useAuth();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function run() {
      if (!token) {
        setLoading(false);
        setError("You are not logged in.");
        return;
      }

      try {
        const response = await getRooms(token);
        setRooms(response);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load rooms");
      } finally {
        setLoading(false);
      }
    }

    void run();
  }, [token]);

  return { rooms, loading, error };
}
EOF

cat > "$ROOT/hooks/use-room.ts" <<'EOF'
"use client";

import { useEffect, useState } from "react";
import { getRoom } from "@/lib/api/rooms";
import { useAuth } from "@/hooks/use-auth";
import type { Room } from "@/types/room";

export function useRoom(roomId: string) {
  const { token } = useAuth();
  const [room, setRoom] = useState<Room | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function run() {
      if (!token) {
        setLoading(false);
        setError("You are not logged in.");
        return;
      }

      try {
        const response = await getRoom(token, roomId);
        setRoom(response);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load room");
      } finally {
        setLoading(false);
      }
    }

    void run();
  }, [token, roomId]);

  return { room, loading, error };
}
EOF

cat > "$ROOT/hooks/use-join-code.ts" <<'EOF'
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
EOF

cat > "$ROOT/hooks/use-invites.ts" <<'EOF'
"use client";

import { useCallback, useEffect, useState } from "react";
import { createRoomInvite, getRoomInvites, revokeRoomInvite } from "@/lib/api/invites";
import { useAuth } from "@/hooks/use-auth";
import type { RoomInviteToken } from "@/types/invite";

export function useInvites(roomId: string) {
  const { token } = useAuth();
  const [invites, setInvites] = useState<RoomInviteToken[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) {
      setError("You are not logged in.");
      setLoading(false);
      return;
    }

    try {
      const response = await getRoomInvites(token, roomId);
      setInvites(response);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load invites");
    } finally {
      setLoading(false);
    }
  }, [roomId, token]);

  useEffect(() => {
    void load();
  }, [load]);

  async function createInvite(payload: {
    expires_in_hours?: number;
    max_uses?: number;
  }) {
    if (!token) {
      throw new Error("You are not logged in.");
    }

    await createRoomInvite(token, roomId, payload);
    await load();
  }

  async function revokeInvite(inviteId: string) {
    if (!token) {
      throw new Error("You are not logged in.");
    }

    await revokeRoomInvite(token, roomId, inviteId);
    await load();
  }

  return { invites, loading, error, createInvite, revokeInvite, reload: load };
}
EOF

cat > "$ROOT/hooks/use-launch.ts" <<'EOF'
"use client";

import { useState } from "react";
import { openInVSCode } from "@/lib/api/launch";
import { useAuth } from "@/hooks/use-auth";

export function useLaunch(roomId: string) {
  const { token } = useAuth();
  const [loading, setLoading] = useState(false);

  async function openRoom() {
    if (!token) {
      throw new Error("You are not logged in.");
    }

    setLoading(true);
    try {
      const response = await openInVSCode(token, roomId);
      window.location.href = response.deep_link;
    } finally {
      setLoading(false);
    }
  }

  return { openRoom, loading };
}
EOF

# -------------------------
# Types
# -------------------------

cat > "$ROOT/types/auth.ts" <<'EOF'
export type AuthResponse = {
  token: string;
  email: string;
};

export type CurrentUser = {
  id: string;
  email: string;
};
EOF

cat > "$ROOT/types/room.ts" <<'EOF'
export type Room = {
  id: string;
  name: string;
  slug: string;
  created_by?: string;
  owner_user_id: string;
  source_type: "local_workspace" | "github_repo";
  source_metadata: Record<string, unknown>;
  primary_join_code: string;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
};
EOF

cat > "$ROOT/types/invite.ts" <<'EOF'
export type RoomInviteToken = {
  id: string;
  room_id: string;
  code: string;
  created_by_user_id: string;
  expires_at: string | null;
  max_uses: number | null;
  uses_count: number;
  is_revoked: boolean;
  created_at: string;
};
EOF

cat > "$ROOT/types/launch.ts" <<'EOF'
export type LaunchTokenResponse = {
  launch_token: string;
  deep_link: string;
};

export type LaunchContext = {
  room_id: string;
  room_name: string;
  room_slug: string;
  role: "host" | "editor";
  source_type: "local_workspace" | "github_repo";
  source_metadata: Record<string, unknown>;
  workspace_path_hint: string;
};
EOF

cat > "$ROOT/types/api.ts" <<'EOF'
export type ApiError = {
  message: string;
};
EOF

# -------------------------
# API files
# -------------------------

cat > "$ROOT/lib/api/client.ts" <<'EOF'
const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/+$/, "") ||
  "http://localhost:8080";

type RequestOptions = {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  token?: string | null;
  body?: unknown;
};

export async function apiRequest<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const headers: Record<string, string> = {};

  if (options.body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  if (options.token) {
    headers.Authorization = `Bearer ${options.token}`;
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: options.method ?? "GET",
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    cache: "no-store"
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Request failed with status ${response.status}`);
  }

  return response.json() as Promise<T>;
}
EOF

cat > "$ROOT/lib/api/auth.ts" <<'EOF'
import { apiRequest } from "./client";
import type { AuthResponse, CurrentUser } from "@/types/auth";

export function register(email: string, password: string) {
  return apiRequest<AuthResponse>("/auth/register", {
    method: "POST",
    body: { email, password }
  });
}

export function login(email: string, password: string) {
  return apiRequest<AuthResponse>("/auth/login", {
    method: "POST",
    body: { email, password }
  });
}

export function getCurrentUser(token: string) {
  return apiRequest<CurrentUser>("/auth/me", {
    token
  });
}
EOF

cat > "$ROOT/lib/api/rooms.ts" <<'EOF'
import { apiRequest } from "./client";
import type { Room } from "@/types/room";

export function getRooms(token: string) {
  return apiRequest<Room[]>("/rooms", { token });
}

export function getRoom(token: string, roomId: string) {
  return apiRequest<Room>(`/rooms/${roomId}`, { token });
}

export function createRoom(
  token: string,
  payload: {
    name: string;
    source_type: "local_workspace" | "github_repo";
    source_metadata?: Record<string, unknown>;
  },
) {
  return apiRequest<Room>("/rooms", {
    method: "POST",
    token,
    body: payload
  });
}

export function resolveJoinCode(token: string, code: string) {
  return apiRequest<{
    room: Room;
    membership: {
      role: "host" | "editor";
      joined: boolean;
    };
  }>("/join-code/resolve", {
    method: "POST",
    token,
    body: { code }
  });
}
EOF

cat > "$ROOT/lib/api/invites.ts" <<'EOF'
import { apiRequest } from "./client";
import type { RoomInviteToken } from "@/types/invite";

export function getRoomInvites(token: string, roomId: string) {
  return apiRequest<RoomInviteToken[]>(`/rooms/${roomId}/invites`, { token });
}

export function createRoomInvite(
  token: string,
  roomId: string,
  payload: {
    expires_in_hours?: number;
    max_uses?: number;
  },
) {
  return apiRequest<RoomInviteToken>(`/rooms/${roomId}/invites`, {
    method: "POST",
    token,
    body: payload
  });
}

export function revokeRoomInvite(
  token: string,
  roomId: string,
  inviteId: string,
) {
  return apiRequest<{ success: boolean }>(
    `/rooms/${roomId}/invites/${inviteId}/revoke`,
    {
      method: "POST",
      token
    },
  );
}
EOF

cat > "$ROOT/lib/api/launch.ts" <<'EOF'
import { apiRequest } from "./client";
import type { LaunchTokenResponse } from "@/types/launch";

export function openInVSCode(token: string, roomId: string) {
  return apiRequest<LaunchTokenResponse>(`/rooms/${roomId}/open-in-vscode`, {
    method: "POST",
    token,
    body: {}
  });
}
EOF

# -------------------------
# Config + utils
# -------------------------

cat > "$ROOT/lib/config/env.ts" <<'EOF'
export const env = {
  apiBaseUrl:
    process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/+$/, "") ||
    "http://localhost:8080"
};
EOF

cat > "$ROOT/lib/utils/storage.ts" <<'EOF'
const TOKEN_KEY = "codedock.token";
const EMAIL_KEY = "codedock.email";

export function setAuthSession(token: string, email: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(EMAIL_KEY, email);
}

export function getAuthToken() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function clearAuthSession() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(EMAIL_KEY);
}
EOF

cat > "$ROOT/lib/utils/format.ts" <<'EOF'
export function formatDateTime(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}
EOF

cat > "$ROOT/lib/utils/slug.ts" <<'EOF'
export function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-|-$/g, "");
}
EOF

echo "CodeDock web scaffold created at: $ROOT"
echo "Next steps:"
echo "  cd $ROOT"
echo "  npm install"
echo "  cp .env.example .env.local"
echo "  npm run dev"