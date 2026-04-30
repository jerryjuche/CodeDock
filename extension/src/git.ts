import { spawn } from "child_process";
import * as fs from "fs/promises";
import * as path from "path";
import * as vscode from "vscode";

export class GitError extends Error {
  constructor(message: string, public readonly code?: number) {
    super(message);
    this.name = "GitError";
  }
}

async function runGitCommand(
  args: string[],
  cwd: string,
  outputChannel: vscode.OutputChannel,
): Promise<void> {
  return new Promise((resolve, reject) => {
    outputChannel.appendLine(`CodeDock[git]: git ${args.join(" ")}`);

    const child = spawn("git", args, {
      cwd,
      env: {
        ...process.env,
        GIT_TERMINAL_PROMPT: "0",
        GIT_SSH_COMMAND: "ssh -o BatchMode=yes -o StrictHostKeyChecking=accept-new",
      },
    });

    let stderr = "";

    child.stderr.on("data", (data: Buffer) => {
      const msg = data.toString();
      stderr += msg;
      // Output to channel without extra newlines
      outputChannel.append(msg);
    });

    child.stdout.on("data", (data: Buffer) => {
      outputChannel.append(data.toString());
    });

    child.on("error", (error) => {
      reject(new GitError(`Failed to start git process: ${error.message}`));
    });

    child.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new GitError(`git ${args[0]} failed: ${stderr}`, code ?? undefined));
      }
    });
  });
}

async function getGitRemoteOrigin(
  cwd: string,
  outputChannel: vscode.OutputChannel,
): Promise<string> {
  return new Promise((resolve, reject) => {
    outputChannel.appendLine(`CodeDock[git]: git remote get-url origin`);

    const child = spawn("git", ["remote", "get-url", "origin"], {
      cwd,
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (data: Buffer) => {
      stdout += data.toString();
    });

    child.stderr.on("data", (data: Buffer) => {
      stderr += data.toString();
    });

    child.on("error", (error) => {
      reject(new GitError(`Failed to start git process: ${error.message}`));
    });

    child.on("close", (code) => {
      if (code === 0) {
        resolve(stdout.trim());
      } else {
        reject(new GitError(`git remote get-url failed: ${stderr}`, code ?? undefined));
      }
    });
  });
}

export async function ensureGitRepo(
  repoUrl: string,
  branch: string,
  targetPath: string,
  outputChannel: vscode.OutputChannel,
): Promise<void> {
  const gitDir = path.join(targetPath, ".git");

  let isRepo = false;
  try {
    const stat = await fs.stat(gitDir);
    isRepo = stat.isDirectory();
  } catch {
    isRepo = false;
  }

  if (isRepo) {
    outputChannel.appendLine(
      `CodeDock[git]: found existing repository at ${targetPath}`,
    );

    let originUrl = "";
    try {
      originUrl = await getGitRemoteOrigin(targetPath, outputChannel);
    } catch (e) {
      throw new GitError(
        `Failed to read git remote 'origin' in existing repository. Is this a valid clone?`,
      );
    }

    // A loose normalization for matching https://github.com/foo/bar and https://github.com/foo/bar.git
    const normalizedExisting = originUrl.replace(/\.git$/, "").toLowerCase();
    const normalizedTarget = repoUrl.replace(/\.git$/, "").toLowerCase();

    if (normalizedExisting !== normalizedTarget) {
      throw new GitError(
        `Existing repository's origin (${originUrl}) does not match the room's repository (${repoUrl}). Please clear the ~/.codedock/rooms folder.`,
      );
    }

    await runGitCommand(["fetch", "origin"], targetPath, outputChannel);
    await runGitCommand(["checkout", branch], targetPath, outputChannel);
    return;
  }

  outputChannel.appendLine(
    `CodeDock[git]: cloning ${repoUrl} (branch: ${branch}) into ${targetPath}`,
  );

  // We must clone into the targetPath. Since ensureManagedWorkspace creates the empty dir,
  // we can clone into it, as long as it's perfectly empty.
  await runGitCommand(
    ["clone", "--branch", branch, repoUrl, "."],
    targetPath,
    outputChannel,
  );
}
