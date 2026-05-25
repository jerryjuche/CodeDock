import { useMemo } from "react";
import { useRoomActivities } from "@/hooks/use-room-activities";
import { getDiffStrategy, getFileExtension } from "@/lib/diff/diff-strategy";
import type {
  ReviewCategory,
  ReviewFile,
  ReviewFilterValue,
  ReviewRiskLevel,
  ReviewSortValue,
} from "@/types/review";

type ActivityEvent = {
  id: string;
  user_id?: string;
  email?: string;
  type?: string;
  activity_type?: string;
  file_path?: string;
  details?: Record<string, unknown>;
  created_at?: string;
};

function normalizeString(value?: string): string {
  return (value ?? "").trim();
}

function getLanguage(filePath: string, fallback?: string): string {
  const extension = filePath.split(".").pop()?.toLowerCase() ?? "";
  if (fallback) {
    const normalized = fallback.toLowerCase();
    if (normalized === "typescript" || normalized === "tsx")
      return "TypeScript";
    if (normalized === "javascript" || normalized === "jsx")
      return "JavaScript";
  }

  switch (extension) {
    case "ts":
      return "TypeScript";
    case "tsx":
      return "TSX";
    case "js":
      return "JavaScript";
    case "jsx":
      return "JSX";
    case "go":
      return "Go";
    case "py":
      return "Python";
    case "rs":
      return "Rust";
    case "java":
      return "Java";
    case "json":
      return "JSON";
    case "md":
      return "Markdown";
    case "yaml":
    case "yml":
      return "YAML";
    case "css":
      return "CSS";
    case "scss":
      return "SCSS";
    case "html":
      return "HTML";
    case "sql":
      return "SQL";
    default:
      return fallback ? capitalize(fallback) : "Text";
  }
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function getCategory(filePath: string): ReviewCategory {
  const normalized = filePath.toLowerCase();
  if (
    normalized.endsWith(".json") ||
    normalized.endsWith(".yml") ||
    normalized.endsWith(".yaml") ||
    normalized.endsWith(".toml") ||
    normalized.endsWith(".ini") ||
    /(^|\/)(dockerfile|compose|nginx|haproxy|terraform)/.test(normalized)
  ) {
    return "Config";
  }
  if (
    normalized.endsWith(".css") ||
    normalized.endsWith(".scss") ||
    normalized.endsWith(".html") ||
    normalized.endsWith(".tsx") ||
    normalized.endsWith(".jsx")
  ) {
    return "Frontend";
  }
  if (
    normalized.endsWith(".go") ||
    normalized.endsWith(".py") ||
    normalized.endsWith(".rs") ||
    normalized.endsWith(".java") ||
    normalized.endsWith(".kt") ||
    normalized.endsWith(".ts") ||
    normalized.endsWith(".js")
  ) {
    return normalized.includes("/api/") ||
      normalized.includes("/server/") ||
      normalized.includes("/backend/")
      ? "Backend"
      : "Frontend";
  }
  return "General";
}

function getAuthorInitials(author: string): string {
  const parts = author
    .replace(/[^a-zA-Z0-9 ]/g, "")
    .split(" ")
    .filter(Boolean);
  if (parts.length === 0) {
    return author.slice(0, 2).toUpperCase();
  }
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return `${parts[0].charAt(0)}${parts[1].charAt(0)}`.toUpperCase();
}

function inferRiskLevel(
  filePath: string,
  diffCount: number,
  flags: string[],
): ReviewRiskLevel {
  const securitySensitive =
    /auth|secret|token|password|credential|ssh|crypto|cert|key|vault/i.test(
      filePath,
    );
  if (
    securitySensitive ||
    flags.includes("security-surface") ||
    diffCount > 120
  ) {
    return "high";
  }
  if (flags.length > 0 || diffCount > 45) {
    return "medium";
  }
  return "low";
}

function collectAiFlags(filePath: string, code: string): string[] {
  const flags: string[] = [];
  const normalized = code.toLowerCase();

  if (/(todo|fixme|hack|temporary)/.test(normalized)) {
    flags.push("needs cleanup");
  }
  if (
    /\b(any)\b/.test(normalized) &&
    /typescript/i.test(getLanguage(filePath, "TypeScript"))
  ) {
    flags.push("weak typing");
  }
  if (
    /\beval\s*\(|new Function\(|document\.cookie|window\.location|innerHTML\s*=/.test(
      normalized,
    )
  ) {
    flags.push("unsafe execution");
  }
  if (/console\.log\(|debugger\b/.test(normalized)) {
    flags.push("debug statements");
  }
  if (
    /password|secret|token|apiKey|credentials|private_key|ssh_key/i.test(
      filePath + " " + normalized,
    )
  ) {
    flags.push("security-sensitive");
  }

  return Array.from(new Set(flags));
}

function buildInsights(
  filePath: string,
  code: string,
  addedLines: number,
  removedLines: number,
) {
  const flags = collectAiFlags(filePath, code);
  const insights = [] as ReviewFile["aiInsights"];

  if (flags.includes("security-sensitive")) {
    insights.push({
      id: `${filePath}-security`,
      severity: "high",
      title: "Potential security sensitivity",
      description:
        "This file or code path contains secrets, tokens, or security-related identifiers that should be reviewed carefully.",
      confidence: 0.95,
      suggestion:
        "Confirm that sensitive information is not hard-coded and that secrets are stored in secure configuration or vaults.",
    });
  }

  if (flags.includes("unsafe execution")) {
    insights.push({
      id: `${filePath}-unsafe`,
      severity: "high",
      title: "Unsafe execution pattern",
      description:
        "This change contains dynamic evaluation or direct DOM execution which can introduce security and stability risks.",
      confidence: 0.84,
      suggestion:
        "Avoid eval-style behavior and use safer data-driven APIs or explicit parsing.",
    });
  }

  if (flags.includes("needs cleanup")) {
    insights.push({
      id: `${filePath}-todo`,
      severity: "medium",
      title: "Work-in-progress markers found",
      description:
        "Comments like TODO/FIXME indicate the change may not be final.",
      confidence: 0.78,
      suggestion:
        "Resolve pending tasks or add a code comment explaining what remains to be done.",
    });
  }

  if (flags.includes("weak typing")) {
    insights.push({
      id: `${filePath}-typing`,
      severity: "medium",
      title: "Weak TypeScript typing detected",
      description:
        "This change uses `any` or weak type constructs that could mask runtime issues.",
      confidence: 0.72,
      suggestion:
        "Replace `any` with a narrower type or add explicit interfaces for safety.",
    });
  }

  if (addedLines + removedLines > 60) {
    insights.push({
      id: `${filePath}-large-change`,
      severity: "low",
      title: "Large change set",
      description:
        "This file contains a large diff and may deserve extra review attention.",
      confidence: 0.68,
      suggestion:
        "Verify the most critical lines and check that the refactor preserves existing behavior.",
    });
  }

  return insights;
}

function formatTimestamp(timestamp: string): string {
  const date = new Date(timestamp);
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export function useReviewFiles(roomId: string) {
  const { activities, loading, error, reload } = useRoomActivities(roomId);

  const reviewFiles = useMemo(() => {
    const fileMap = new Map<
      string,
      {
        file: string;
        language: string;
        category: ReviewCategory;
        author: string;
        authorInitials: string;
        firstTimestamp: number;
        lastTimestamp: number;
        firstCode: string;
        lastCode: string;
        snapshots: Set<string>;
        activityCount: number;
      }
    >();

    activities.forEach((activity: ActivityEvent) => {
      const filePath = normalizeString(
        activity.file_path ?? (activity.details?.file as string),
      );
      const code =
        typeof activity.details?.code === "string"
          ? normalizeString(activity.details?.code)
          : "";
      if (!filePath || !code) {
        return;
      }

      const timestamp = Math.max(
        new Date(activity.created_at ?? "").getTime() || 0,
        new Date((activity as any).createdAt ?? "").getTime() || 0,
      );
      const author = normalizeString(
        activity.email ?? activity.user_id ?? "Unknown",
      );
      const language = getLanguage(
        filePath,
        typeof activity.details?.language === "string"
          ? activity.details.language
          : undefined,
      );
      const category = getCategory(filePath);
      const authorInitials = getAuthorInitials(author);

      const existing = fileMap.get(filePath);
      if (!existing) {
        fileMap.set(filePath, {
          file: filePath.split("/").pop() ?? filePath,
          language,
          category,
          author,
          authorInitials,
          firstTimestamp: timestamp || Date.now(),
          lastTimestamp: timestamp || Date.now(),
          firstCode: code,
          lastCode: code,
          snapshots: new Set([code]),
          activityCount: 1,
        });
        return;
      }

      if (timestamp < existing.firstTimestamp) {
        existing.firstTimestamp = timestamp;
        existing.firstCode = code;
      }
      if (timestamp > existing.lastTimestamp) {
        existing.lastTimestamp = timestamp;
        existing.lastCode = code;
        existing.author = author;
        existing.authorInitials = authorInitials;
      }
      existing.snapshots.add(code);
      existing.activityCount += 1;
    });

    const reviewItems: ReviewFile[] = [];

    for (const [path, file] of fileMap.entries()) {
      if (
        typeof file.firstCode !== "string" ||
        typeof file.lastCode !== "string"
      ) {
        throw new Error(
          `computeDiff received non-string inputs for file ${path}`,
        );
      }

      const extension = getFileExtension(path);
      const chunks = getDiffStrategy(extension)(file.firstCode, file.lastCode);
      const addedLines = chunks
        .filter((c) => c.type === "add")
        .reduce((s, c) => s + c.lines.length, 0);
      const removedLines = chunks
        .filter((c) => c.type === "remove")
        .reduce((s, c) => s + c.lines.length, 0);
      if (addedLines === 0 && removedLines === 0) {
        continue;
      }

      const aiInsights = buildInsights(
        path,
        file.lastCode,
        addedLines,
        removedLines,
      );
      const aiFlagged = aiInsights.length > 0;
      const riskLevel = inferRiskLevel(
        path,
        addedLines + removedLines,
        aiInsights.map((insight) => insight.severity),
      );
      const isSecuritySensitive =
        /auth|secret|token|password|credential|ssh|crypto|cert|key|vault/i.test(
          path,
        );
      const isConfig = file.category === "Config";

      reviewItems.push({
        id: `${path}:${file.lastTimestamp}`,
        path,
        file: file.file,
        language: file.language,
        category: file.category,
        lastModified: formatTimestamp(
          new Date(file.lastTimestamp).toISOString(),
        ),
        author: file.author,
        authorInitials: file.authorInitials,
        reviewStatus: "unreviewed",
        riskLevel,
        riskReasons: aiInsights.map((insight) => insight.title),
        aiInsights,
        aiFlagged,
        isSecuritySensitive,
        isConfig,
        addedLines,
        removedLines,
        totalChanges: addedLines + removedLines,
        baseCode: file.firstCode,
        currentCode: file.lastCode,
      });
    }

    return reviewItems.sort(
      (a, b) =>
        new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime(),
    );
  }, [activities]);

  return {
    reviewFiles,
    loading,
    error,
    reload,
  };
}
