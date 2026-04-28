"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { createRoom } from "@/lib/api/rooms";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

type SourceType = "local_workspace" | "github_repo";

export default function CreateRoomForm() {
  const router = useRouter();
  const { token } = useAuth();

  const [name, setName] = useState("");
  const [sourceType, setSourceType] = useState<SourceType>("local_workspace");
  const [repoOwner, setRepoOwner] = useState("");
  const [repoName, setRepoName] = useState("");
  const [branch, setBranch] = useState("main");
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();

    if (!token) {
      window.alert("You are not logged in.");
      return;
    }

    setSubmitting(true);

    try {
      const payload =
        sourceType === "github_repo"
          ? {
              name,
              source_type: sourceType,
              source_metadata: {
                repo_owner: repoOwner,
                repo_name: repoName,
                branch: branch || "main",
              },
            }
          : {
              name,
              source_type: sourceType,
            };

      const room = await createRoom(token, payload);
      router.push(`/rooms/${room.id}`);
      router.refresh();
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Failed to create room");
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
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <Label htmlFor="repo-owner">Repo owner</Label>
              <Input
                id="repo-owner"
                placeholder="e.g. jerryjuche"
                value={repoOwner}
                onChange={(e) => setRepoOwner(e.target.value)}
                required
              />
            </div>

            <div>
              <Label htmlFor="repo-name">Repo name</Label>
              <Input
                id="repo-name"
                placeholder="e.g. CodeDock"
                value={repoName}
                onChange={(e) => setRepoName(e.target.value)}
                required
              />
            </div>

            <div className="sm:col-span-2">
              <Label htmlFor="branch">Branch</Label>
              <Input
                id="branch"
                placeholder="main"
                value={branch}
                onChange={(e) => setBranch(e.target.value)}
              />
            </div>
          </div>
        ) : (
          <div className="rounded-[14px] border border-white/8 bg-white/[0.03] p-4 text-sm text-[rgb(158,183,211)]">
            The host will bind a local project folder later from VS Code before guests can launch the room.
          </div>
        )}

        <div className="pt-2">
          <Button type="submit" size="lg" disabled={submitting}>
            {submitting ? "Creating..." : "Create room"}
          </Button>
        </div>
      </form>
    </Card>
  );
}