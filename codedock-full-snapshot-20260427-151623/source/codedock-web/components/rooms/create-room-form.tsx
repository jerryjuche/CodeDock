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
  const [sourceType, setSourceType] = useState<"local_workspace" | "github_repo">(
    "local_workspace",
  );
  const [repoOwner, setRepoOwner] = useState("");
  const [repoName, setRepoName] = useState("");
  const [branch, setBranch] = useState("main");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!token) {
      window.alert("You must be logged in.");
      return;
    }

    const sourceMetadata =
      sourceType === "github_repo"
        ? {
            repo_owner: repoOwner.trim(),
            repo_name: repoName.trim(),
            branch: branch.trim() || "main",
          }
        : {};

    if (
      sourceType === "github_repo" &&
      (!sourceMetadata.repo_owner || !sourceMetadata.repo_name)
    ) {
      window.alert("GitHub rooms require repo owner and repo name.");
      return;
    }

    setLoading(true);
    try {
      const room = await createRoom(token, {
        name: name.trim(),
        source_type: sourceType,
        source_metadata: sourceMetadata,
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
          <Input
            id="room-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Frontend Revamp"
            required
          />
        </div>

        <div>
          <Label htmlFor="source-type">Source Type</Label>
          <select
            id="source-type"
            className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm"
            value={sourceType}
            onChange={(e) =>
              setSourceType(e.target.value as "local_workspace" | "github_repo")
            }
          >
            <option value="local_workspace">Local Workspace</option>
            <option value="github_repo">GitHub Repository</option>
          </select>
        </div>

        {sourceType === "github_repo" && (
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label htmlFor="repo-owner">Repo Owner</Label>
              <Input
                id="repo-owner"
                value={repoOwner}
                onChange={(e) => setRepoOwner(e.target.value)}
                placeholder="jerryjuche"
              />
            </div>

            <div>
              <Label htmlFor="repo-name">Repo Name</Label>
              <Input
                id="repo-name"
                value={repoName}
                onChange={(e) => setRepoName(e.target.value)}
                placeholder="CodeDock"
              />
            </div>

            <div className="md:col-span-2">
              <Label htmlFor="repo-branch">Branch</Label>
              <Input
                id="repo-branch"
                value={branch}
                onChange={(e) => setBranch(e.target.value)}
                placeholder="main"
              />
            </div>
          </div>
        )}

        <Button disabled={loading} type="submit">
          {loading ? "Creating..." : "Create Room"}
        </Button>
      </form>
    </Card>
  );
}