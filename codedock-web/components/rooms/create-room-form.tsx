// components/rooms/create-room-form.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { createRoom } from "@/lib/api/rooms";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

import posthog from "posthog-js";

type SourceType = "local_workspace" | "github_repo";

export default function CreateRoomForm() {
  const router = useRouter();
  const { token } = useAuth();

  const [name, setName] = useState("");
  const [sourceType, setSourceType] = useState<SourceType>("local_workspace");
  const [repoUrl, setRepoUrl] = useState("");
  const [branch, setBranch] = useState("main");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    if (!token) {
      setError("You are not logged in.");
      return;
    }

    setSubmitting(true);
    posthog.capture("room_creation_started", { source_type: sourceType });

    try {
      let sourceMetadata = {};

      if (sourceType === "github_repo") {
        // Simple regex to extract owner and repo from various GitHub URL formats
        // Matches: https://github.com/owner/repo, git@github.com:owner/repo.git, etc.
        const githubRegex = /(?:github\.com[:/])([^/]+)\/([^/.]+)(?:\.git)?$/i;
        const match = repoUrl.trim().match(githubRegex);

        if (!match) {
          throw new Error(
            "Invalid GitHub repository URL. Please use the format: https://github.com/owner/repo",
          );
        }

        sourceMetadata = {
          repo_owner: match[1],
          repo_name: match[2],
          branch: branch || "main",
        };
      }

      const payload = {
        name,
        source_type: sourceType,
        source_metadata:
          sourceType === "github_repo" ? sourceMetadata : undefined,
      };

      const room = await createRoom(token, payload);
      posthog.capture("room_created", {
        roomId: room.id,
        source_type: sourceType,
      });
      router.push(`/rooms/${room.id}`);
      router.refresh();
    } catch (err) {
      const errorMessage =
        err instanceof Error
          ? err.message
          : "Failed to create room. Please try again.";
      setError(errorMessage);
      posthog.capture("room_creation_failed", {
        error: errorMessage,
        source_type: sourceType,
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card className="mx-auto max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-white">Create room</h1>
        <p className="mt-2 text-sm text-[rgb(158,183,211)]">
          Start a new collaboration room and configure its source type.
        </p>
      </div>

      <form className="space-y-5" onSubmit={onSubmit}>
        <div>
          <Label htmlFor="room-name">Room name</Label>
          <Input
            id="room-name"
            placeholder="e.g. CodeDock core platform"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </div>

        <div>
          <Label htmlFor="source-type">Source type</Label>
          <select
            id="source-type"
            value={sourceType}
            onChange={(e) => setSourceType(e.target.value as SourceType)}
            className="flex h-11 w-full rounded-[12px] border border-white/12 bg-[rgba(255,255,255,0.04)] px-4 py-2 text-sm text-white outline-none transition-all focus:border-[rgba(36,166,242,0.55)] focus:bg-[rgba(255,255,255,0.06)] focus:ring-2 focus:ring-[rgba(36,166,242,0.16)]"
          >
            <option value="local_workspace" className="bg-[rgb(1,26,61)]">
              Local workspace
            </option>
            <option value="github_repo" className="bg-[rgb(1,26,61)]">
              GitHub repository
            </option>
          </select>
        </div>

        {sourceType === "github_repo" ? (
          <div className="space-y-5">
            <div>
              <Label htmlFor="repo-url">GitHub Repository URL</Label>
              <Input
                id="repo-url"
                placeholder="https://github.com/jerryjuche/CodeDock"
                value={repoUrl}
                onChange={(e) => setRepoUrl(e.target.value)}
                required
              />
            </div>

            <div>
              <Label htmlFor="branch">Branch</Label>
              <Input
                id="branch"
                placeholder="main"
                value={branch}
                onChange={(e) => setBranch(e.target.value)}
              />
            </div>

            <div className="rounded-[14px] border border-white/8 bg-white/[0.03] p-4 text-sm text-[rgb(158,183,211)]">
              The host must hydrate the GitHub repository workspace in VS Code
              before guests can open the room.
            </div>
          </div>
        ) : (
          <div className="rounded-[14px] border border-white/8 bg-white/[0.03] p-4 text-sm text-[rgb(158,183,211)]">
            The host will bind a local project folder later from VS Code before
            guests can launch the room.
          </div>
        )}

        {error ? (
          <p className="rounded-[12px] border border-[rgba(255,90,107,0.3)] bg-[rgba(255,90,107,0.08)] px-4 py-3 text-sm text-[rgb(255,160,170)]">
            {error}
          </p>
        ) : null}

        <div className="pt-2">
          <Button type="submit" size="lg" disabled={submitting}>
            {submitting ? "Creating..." : "Create room"}
          </Button>
        </div>
      </form>
    </Card>
  );
}
