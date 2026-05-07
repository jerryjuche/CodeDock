import { spawn } from "child_process";
import * as fs from "fs/promises";
import * as path from "path";
import * as vscode from "vscode";

export class GitError extends Error {
  constructor(
    message: string,
    public readonly code?: number,
  ) {
    super(message);
    this.name = "GitError";
  }
}

/**
 * Transforms a GitHub SSH URL to an HTTPS URL to avoid SSH auth issues.
 * Examples:
 *   git@github.com:owner/repo.git -> https://github.com/owner/repo.git
 *   git@github.com:owner/repo     -> https://github.com/owner/repo
 */
function toHttpsUrl(url: string): string {
  const githubSshRegex = /^git@github\.com:([^/]+)\/(.+)$/;
  const match = url.match(githubSshRegex);
  if (match) {
    const owner = match[1];
    const repo = match[2];
    return `https://github.com/${owner}/${repo}`;
  }
  return url;
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
        GIT_SSH_COMMAND:
          "ssh -o BatchMode=yes -o StrictHostKeyChecking=accept-new",
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
        reject(
          new GitError(`git ${args[0]} failed: ${stderr}`, code ?? undefined),
        );
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
        reject(
          new GitError(
            `git remote get-url failed: ${stderr}`,
            code ?? undefined,
          ),
        );
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
  const safeRepoUrl = toHttpsUrl(repoUrl);
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
    const normalizedTarget = safeRepoUrl.replace(/\.git$/, "").toLowerCase();

    if (normalizedExisting !== normalizedTarget) {
      throw new GitError(
        `Existing repository's origin (${originUrl}) does not match the room's repository (${safeRepoUrl}). Please clear the ~/.codedock/rooms folder.`,
      );
    }

    await runGitCommand(["fetch", "origin"], targetPath, outputChannel);
    await runGitCommand(["checkout", branch], targetPath, outputChannel);
    return;
  }

  outputChannel.appendLine(
    `CodeDock[git]: cloning ${safeRepoUrl} (branch: ${branch}) into ${targetPath}`,
  );

  // Clear target path of non-.git files to avoid "destination path already exists" error
  try {
    const entries = await fs.readdir(targetPath);
    for (const entry of entries) {
      if (entry !== ".git") {
        const entryPath = path.join(targetPath, entry);
        const stat = await fs.stat(entryPath);
        if (stat.isDirectory()) {
          await fs.rm(entryPath, { recursive: true, force: true });
        } else {
          await fs.unlink(entryPath);
        }
      }
    }
  } catch (e) {
    outputChannel.appendLine(
      `CodeDock[git]: warning - failed to clean target path: ${e instanceof Error ? e.message : "unknown"}`,
    );
  }

  // Clone into the targetPath
  await runGitCommand(
    ["clone", "--branch", branch, safeRepoUrl, "."],
    targetPath,
    outputChannel,
  );
}
