from pathlib import Path

content = '''"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DiffView } from "@/components/ui/diff-view";
import { useLaunchIDE } from "@/hooks/use-launch";
import { useRoomDetails } from "@/hooks/use-room-details";
import { useRoomSync } from "@/hooks/use-room-sync";
import { useReviewFiles } from "@/hooks/use-review-files";
import { Search, Sparkles, FileText, Clock3, Layers, BellRing, TrendingUp } from "lucide-react";
import type { ReviewFilterValue, ReviewSortValue } from "@/types/review";

const FILTERS: Array<{ value: ReviewFilterValue; label: string }> = [
  { value: "all", label: "All" },
  { value: "highRisk", label: "High Risk" },
  { value: "unreviewed", label: "Unreviewed" },
  { value: "aiFlagged", label: "AI Flagged" },
  { value: "frontend", label: "Frontend" },
  { value: "backend", label: "Backend" },
  { value: "config", label: "Config" },
  { value: "security", label: "Security" },
];

const SORTERS: Array<{ value: ReviewSortValue; label: string }> = [
  { value: "recent", label: "Recent" },
  { value: "risky", label: "Risky" },
  { value: "largest", label: "Largest diff" },
  { value: "author", label: "Author" },
];

const statusClasses = {
  high: "bg-rose-500/15 text-rose-300",
  medium: "bg-amber-500/15 text-amber-300",
  low: "bg-emerald-500/10 text-emerald-200",
};

function groupByDate(files: Array<{ lastModified: string }>) {
  const groups: Record<string, Array<{ lastModified: string }>> = {
    Today: [],
    Yesterday: [],
    Earlier: [],
  };

  const now = new Date();
  const today = now.toDateString();
  const yesterday = new Date(now.getTime() - 86400000).toDateString();

  files.forEach((file) => {
    const fileDate = new Date(file.lastModified);
    const fileDateString = fileDate.toDateString();

    if (fileDateString === today) {
      groups.Today.push(file);
    } else if (fileDateString === yesterday) {
      groups.Yesterday.push(file);
    } else {
      groups.Earlier.push(file);
    }
  });

  return groups;
}

const getFilterMatch = (filter: ReviewFilterValue, file: any) => {
  switch (filter) {
    case "highRisk":
      return file.riskLevel === "high";
    case "unreviewed":
      return file.reviewStatus === "unreviewed";
    case "aiFlagged":
      return file.aiFlagged;
    case "frontend":
      return file.category === "Frontend";
    case "backend":
      return file.category === "Backend";
    case "config":
      return file.category === "Config";
    case "security":
      return file.isSecuritySensitive;
    default:
      return true;
  }
};

export default function CodeReviewPageClient({
  roomId,
  userId,
}: {
  roomId: string;
  userId: string;
}) {
  useRoomSync(roomId);
  const { details } = useRoomDetails(roomId);
  const { reviewFiles, reload } = useReviewFiles(roomId);
  const { launchIDE, loading: openingIDE } = useLaunchIDE(roomId);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeFilter, setActiveFilter] = useState<ReviewFilterValue>("all");
  const [sortBy, setSortBy] = useState<ReviewSortValue>("recent");
  const [selectedFilePath, setSelectedFilePath] = useState<string | null>(null);
  const [reviewedFiles, setReviewedFiles] = useState<Record<string, boolean>>({});
  const aiRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const saved = window.sessionStorage.getItem(`codedock-review:${roomId}`);
    if (saved) {
      try {
        setReviewedFiles(JSON.parse(saved));
      } catch {
        setReviewedFiles({});
      }
    }
  }, [roomId]);

  useEffect(() => {
    window.sessionStorage.setItem(`codedock-review:${roomId}`, JSON.stringify(reviewedFiles));
  }, [reviewedFiles, roomId]);

  const filteredFiles = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();

    let result = reviewFiles.filter((file) => getFilterMatch(activeFilter, file));

    if (query) {
      result = result.filter(
        (file) =>
          file.path.toLowerCase().includes(query) ||
          file.author.toLowerCase().includes(query) ||
          file.language.toLowerCase().includes(query),
      );
    }

    return result.sort((a, b) => {
      if (sortBy === "risky") {
        const rank = { high: 2, medium: 1, low: 0 } as const;
        const riskDiff = rank[b.riskLevel] - rank[a.riskLevel];
        return riskDiff || b.totalChanges - a.totalChanges;
      }
      if (sortBy === "largest") {
        return b.totalChanges - a.totalChanges;
      }
      if (sortBy === "author") {
        return a.author.localeCompare(b.author);
      }
      return new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime();
    });
  }, [activeFilter, reviewFiles, searchTerm, sortBy]);

  useEffect(() => {
    if (!selectedFilePath && filteredFiles.length > 0) {
      setSelectedFilePath(filteredFiles[0].path);
    }
  }, [filteredFiles, selectedFilePath]);

  useEffect(() => {
    if (selectedFilePath && !filteredFiles.some((file) => file.path === selectedFilePath)) {
      setSelectedFilePath(filteredFiles[0]?.path ?? null);
    }
  }, [filteredFiles, selectedFilePath]);

  const selectedFile = useMemo(
    () => filteredFiles.find((file) => file.path === selectedFilePath) ?? filteredFiles[0] ?? null,
    [filteredFiles, selectedFilePath],
  );

  const groupedFiles = useMemo(() => groupByDate(filteredFiles), [filteredFiles]);

  const totalReviewed = filteredFiles.filter((file) => reviewedFiles[file.path]).length;
  const totalHighRisk = filteredFiles.filter((file) => file.riskLevel === "high").length;
  const totalAiFlagged = filteredFiles.filter((file) => file.aiFlagged).length;

  const handleMarkReviewed = (path: string) => {
    setReviewedFiles((current) => ({ ...current, [path]: true }));
  };

  const handleAiJump = () => {
    aiRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const roomName = details?.room.name ?? "Code review";

  return (
    <main className="mx-auto max-w-[1500px] px-4 py-6">
      <div className="flex flex-col gap-4 border-b border-white/10 pb-6 md:flex-row md:items-end md:justify-between">
        <div className="space-y-3">
          <p className="text-xs uppercase tracking-[0.32em] text-slate-500">Review workspace</p>
          <div className="space-y-2">
            <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">Recent code reviews</h1>
            <p className="max-w-3xl text-sm leading-6 text-slate-400">
              A curated engineering review center for changed files, AI insights, and fast issue triage.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button variant="outline" size="sm" onClick={() => reload()}>
            Refresh feed
          </Button>
          <Button variant="secondary" size="sm" onClick={handleAiJump}>
            <Sparkles className="mr-2 h-4 w-4" /> Ask AI
          </Button>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[360px_1.5fr_360px] pt-6">
        <aside className="space-y-5">
          <Card className="space-y-4 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.28em] text-slate-500">Search review</p>
                <h2 className="text-lg font-semibold text-white">Files</h2>
              </div>
              <div className="rounded-full bg-white/5 px-3 py-1 text-xs text-slate-300">{filteredFiles.length}</div>
            </div>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-500" />
              <input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search files, author, language"
                className="w-full rounded-2xl border border-white/10 bg-slate-950/90 py-3 pl-10 pr-4 text-sm text-slate-100 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20"
              />
            </div>
            <div className="grid gap-2">
              {FILTERS.map((filter) => (
                <button
                  key={filter.value}
                  type="button"
                  onClick={() => setActiveFilter(filter.value)}
                  className={`w-full rounded-2xl border px-3 py-2 text-left text-sm transition ${
                    activeFilter === filter.value
                      ? "border-sky-500/30 bg-sky-500/10 text-white"
                      : "border-white/10 bg-slate-900/90 text-slate-300 hover:border-white/20"
                  }`}
                >
                  {filter.label}
                </button>
              ))}
            </div>
            <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-slate-900/90 p-3 text-sm text-slate-300">
              <span>Sort</span>
              <select
                value={sortBy}
                onChange={(event) => setSortBy(event.target.value as ReviewSortValue)}
                className="w-full bg-transparent text-right text-sm outline-none"
              >
                {SORTERS.map((sortOption) => (
                  <option key={sortOption.value} value={sortOption.value}>
                    {sortOption.label}
                  </option>
                ))}
              </select>
            </div>
          </Card>

          <Card className="space-y-4 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.28em] text-slate-500">Review progress</p>
                <h2 className="text-lg font-semibold text-white">Workspace health</h2>
              </div>
              <TrendingUp className="h-5 w-5 text-slate-300" />
            </div>
            <div className="rounded-2xl bg-slate-900/90 p-4">
              <div className="mb-3 flex items-center justify-between text-sm text-slate-400">
                <span>Reviewed</span>
                <span>{totalReviewed}/{filteredFiles.length}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-white/5">
                <div
                  className="h-full rounded-full bg-sky-500"
                  style={{ width: `${filteredFiles.length ? (totalReviewed / filteredFiles.length) * 100 : 0}%` }}
                />
              </div>
            </div>
            <div className="grid gap-3 text-sm text-slate-400">
              <div className="flex items-center justify-between gap-2">
                <span>High risk</span>
                <span>{totalHighRisk}</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span>AI flagged</span>
                <span>{totalAiFlagged}</span>
              </div>
            </div>
          </Card>

          <Card className="space-y-4 p-4">
            <div className="flex items-center gap-3 text-sm text-slate-400">
              <Layers className="h-4 w-4 text-slate-300" />
              <span>Room</span>
            </div>
            <div className="space-y-2">
              <div className="text-sm text-slate-400">Session</div>
              <div className="text-base font-medium text-white">{roomName}</div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-400">
              <span className="rounded-full bg-white/5 px-3 py-1">Reviewer: {userId}</span>
              <span className="rounded-full bg-white/5 px-3 py-1">Files: {reviewFiles.length}</span>
            </div>
          </Card>
        </aside>

        <section className="space-y-5">
          <Card className="space-y-4 p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <p className="text-xs uppercase tracking-[0.28em] text-slate-500">Review target</p>
                <h2 className="text-2xl font-semibold text-white">{selectedFile?.file || "Nothing selected"}</h2>
                <p className="mt-2 max-w-2xl text-sm text-slate-400">
                  {selectedFile
                    ? `Review the latest patch for ${selectedFile.path}. Inspect the diff, AI insights, and risk metadata before approving.`
                    : "No reviewable files are available right now. Adjust your filters or refresh the feed."}
                </p>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <Button
                  onClick={() => void launchIDE("vscode")}
                  disabled={openingIDE || !selectedFile}
                  variant="outline"
                  size="sm"
                >
                  Open in editor
                </Button>
                <Button onClick={handleAiJump} size="sm" variant="secondary">
                  AI review
                </Button>
              </div>
            </div>

            {selectedFile ? (
              <div className="grid gap-5 lg:grid-cols-[1fr_1fr]">
                <div className="rounded-2xl bg-slate-900/80 p-4 text-sm text-slate-300">
                  <div className="mb-3 flex items-center justify-between text-xs uppercase tracking-[0.28em] text-slate-500">
                    <span>Category</span>
                    <span>{selectedFile.category}</span>
                  </div>
                  <div className="text-base text-white">{selectedFile.language}</div>
                </div>
                <div className="rounded-2xl bg-slate-900/80 p-4 text-sm text-slate-300">
                  <div className="mb-3 flex items-center justify-between text-xs uppercase tracking-[0.28em] text-slate-500">
                    <span>Modified</span>
                    <span>{selectedFile.lastModified}</span>
                  </div>
                  <div className="text-base text-white">{selectedFile.author}</div>
                </div>
              </div>
            ) : null}
          </Card>

          {selectedFile ? (
            <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
              <div className="space-y-5">
                <Card className="rounded-3xl border border-white/10 p-4">
                  <div className="flex items-center justify-between gap-3 pb-4">
                    <div>
                      <div className="text-sm uppercase tracking-[0.28em] text-slate-500">Diff overview</div>
                      <div className="mt-2 text-lg font-semibold text-white">{selectedFile.addedLines} additions · {selectedFile.removedLines} deletions</div>
                    </div>
                    <div className={`rounded-full px-3 py-1 text-xs font-semibold ${statusClasses[selectedFile.riskLevel]}`}>
                      {selectedFile.riskLevel} risk
                    </div>
                  </div>
                  <div className="rounded-[24px] border border-white/10 bg-[#020613]">
                    <DiffView
                      oldCode={selectedFile.baseCode}
                      newCode={selectedFile.currentCode}
                      language={selectedFile.language.toLowerCase()}
                    />
                  </div>
                </Card>

                <section ref={aiRef} className="space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs uppercase tracking-[0.28em] text-slate-500">AI review</p>
                      <h3 className="text-xl font-semibold text-white">Generated insights</h3>
                    </div>
                    <span className="rounded-full bg-slate-900/80 px-3 py-1 text-xs uppercase tracking-[0.24em] text-slate-400">
                      {selectedFile.aiInsights.length} results
                    </span>
                  </div>

                  {selectedFile.aiInsights.length > 0 ? (
                    <div className="space-y-3">
                      {selectedFile.aiInsights.map((insight) => (
                        <div key={insight.id} className="rounded-3xl border border-white/10 bg-slate-950/90 p-4 shadow-[0_20px_40px_rgba(0,0,0,0.22)]">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-sm font-semibold text-white">{insight.title}</p>
                              <p className="mt-1 text-sm leading-6 text-slate-400">{insight.description}</p>
                            </div>
                            <div className="rounded-full bg-white/5 px-3 py-1 text-xs uppercase tracking-[0.24em] text-slate-300">
                              {insight.severity}
                            </div>
                          </div>
                          <div className="mt-4 rounded-2xl bg-slate-900/80 p-4 text-sm text-slate-300">
                            <p className="text-sm text-slate-300">Suggested fix</p>
                            <p className="mt-2 text-sm text-slate-200">{insight.suggestion}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-3xl border border-dashed border-white/10 bg-slate-950/80 p-8 text-center text-slate-400">
                      <FileText className="mx-auto mb-3 h-6 w-6 text-slate-500" />
                      <p className="text-sm font-semibold text-white">No AI issues detected</p>
                      <p className="mt-2 text-sm text-slate-400">This file looks clean based on the current review heuristics.</p>
                    </div>
                  )}
                </section>
              </div>

              <div className="space-y-4">
                <Card className="space-y-4 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="text-xs uppercase tracking-[0.28em] text-slate-500">Review status</p>
                      <h3 className="text-lg font-semibold text-white">Take action</h3>
                    </div>
                  </div>
                  <div className="space-y-3 text-sm text-slate-400">
                    <div className="rounded-2xl bg-slate-900/80 p-4">
                      <p className="text-sm text-white">Selected file</p>
                      <p className="mt-1 text-sm text-slate-400">{selectedFile.path}</p>
                    </div>
                    <div className="rounded-2xl bg-slate-900/80 p-4">
                      <p className="text-sm text-white">Review status</p>
                      <p className="mt-1 text-sm text-slate-400">{reviewedFiles[selectedFile.path] ? "Reviewed" : "Pending review"}</p>
                    </div>
                  </div>
                  <Button
                    onClick={() => handleMarkReviewed(selectedFile.path)}
                    variant="default"
                    className="w-full"
                  >
                    Mark reviewed
                  </Button>
                </Card>

                <Card className="space-y-3 p-4">
                  <div className="flex items-center gap-3 text-sm text-slate-400">
                    <BellRing className="h-4 w-4 text-slate-300" />
                    <span>Review insights</span>
                  </div>
                  <div className="space-y-2 text-sm text-slate-300">
                    <div className="flex items-center justify-between rounded-2xl bg-slate-900/80 px-4 py-3">
                      <span>Change count</span>
                      <span>{selectedFile.totalChanges} lines</span>
                    </div>
                    <div className="flex items-center justify-between rounded-2xl bg-slate-900/80 px-4 py-3">
                      <span>Author</span>
                      <span>{selectedFile.author}</span>
                    </div>
                    <div className="flex items-center justify-between rounded-2xl bg-slate-900/80 px-4 py-3">
                      <span>Risk</span>
                      <span className="capitalize">{selectedFile.riskLevel}</span>
                    </div>
                  </div>
                </Card>
              </div>
            </div>
          ) : (
            <Card className="rounded-3xl border border-white/10 p-8 text-center text-slate-400">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-3xl bg-slate-900/80 text-slate-300">
                <FileText className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-semibold text-white">No reviewable changes found</h3>
              <p className="mt-2 text-sm text-slate-400">Switch filters or refresh the feed to collect the latest review candidates.</p>
            </Card>
          )}
        </section>

        <aside className="space-y-5">
          <Card className="space-y-4 p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-900/80 text-slate-200">
                <Layers className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.28em] text-slate-500">Workspace summary</p>
                <h3 className="text-lg font-semibold text-white">Review intelligence</h3>
              </div>
            </div>
            <div className="grid gap-3">
              <div className="rounded-2xl bg-slate-900/80 p-4">
                <p className="text-xs uppercase tracking-[0.28em] text-slate-500">Files total</p>
                <p className="mt-2 text-2xl font-semibold text-white">{reviewFiles.length}</p>
              </div>
              <div className="rounded-2xl bg-slate-900/80 p-4">
                <p className="text-xs uppercase tracking-[0.28em] text-slate-500">AI findings</p>
                <p className="mt-2 text-2xl font-semibold text-white">{totalAiFlagged}</p>
              </div>
              <div className="rounded-2xl bg-slate-900/80 p-4">
                <p className="text-xs uppercase tracking-[0.28em] text-slate-500">High-risk files</p>
                <p className="mt-2 text-2xl font-semibold text-white">{totalHighRisk}</p>
              </div>
            </div>
          </Card>

          <Card className="space-y-4 p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-900/80 text-slate-200">
                <Clock3 className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.28em] text-slate-500">Recent activity</p>
                <h3 className="text-lg font-semibold text-white">Last reviewed</h3>
              </div>
            </div>
            <div className="grid gap-3 text-sm text-slate-400">
              <div className="rounded-2xl bg-slate-900/80 p-4">
                <p className="text-sm text-slate-300">Most recent candidate</p>
                <p className="mt-2 text-sm font-medium text-white">{filteredFiles[0]?.file ?? "—"}</p>
              </div>
              <div className="rounded-2xl bg-slate-900/80 p-4">
                <p className="text-sm text-slate-300">Review status</p>
                <p className="mt-2 text-sm font-medium text-white">{totalReviewed} reviewed</p>
              </div>
            </div>
          </Card>
        </aside>
      </div>

      <div className="mt-6 space-y-3">
        <div className="flex items-center justify-between gap-3 text-sm text-slate-400">
          <div className="font-medium text-slate-200">Review navigation</div>
          <div>{filteredFiles.length} files matched</div>
        </div>
        <div className="grid gap-3">
          {Object.entries(groupedFiles).map(([section, files]) =>
            files.length > 0 ? (
              <div key={section} className="rounded-3xl border border-white/10 bg-slate-950/90 p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h3 className="text-sm font-semibold uppercase tracking-[0.3em] text-slate-500">{section}</h3>
                  <span className="text-xs text-slate-400">{files.length} file{files.length === 1 ? "" : "s"}</span>
                </div>
                <div className="space-y-2">
                  {files.map((file) => (
                    <button
                      key={file.path}
                      type="button"
                      onClick={() => setSelectedFilePath(file.path)}
                      className={`w-full rounded-3xl border px-4 py-3 text-left transition ${
                        selectedFile?.path === file.path
                          ? "border-sky-500/25 bg-sky-500/10 text-white"
                          : "border-white/10 bg-slate-900/90 text-slate-300 hover:border-white/20 hover:bg-white/5"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 text-sm font-semibold text-white">
                            <FileText className="h-4 w-4 text-slate-400" />
                            <span className="truncate">{file.file}</span>
                          </div>
                          <p className="mt-1 text-xs text-slate-500">{file.path}</p>
                        </div>
                        <div className="flex gap-2 text-xs text-slate-400">
                          <span>{file.lastModified}</span>
                        </div>
                      </div>
                      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-400">
                        <span className="rounded-full bg-white/5 px-3 py-1">{file.category}</span>
                        <span className="rounded-full bg-white/5 px-3 py-1">{file.language}</span>
                        {file.aiFlagged ? (
                          <span className="rounded-full bg-amber-500/15 px-3 py-1 text-amber-300">AI flagged</span>
                        ) : null}
                        {file.riskLevel === "high" ? (
                          <span className="rounded-full bg-rose-500/15 px-3 py-1 text-rose-300">High risk</span>
                        ) : null}
                        {reviewedFiles[file.path] ? (
                          <span className="rounded-full bg-sky-500/15 px-3 py-1 text-sky-300">Reviewed</span>
                        ) : null}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ) : null,
          )}
        </div>
      </div>
    </main>
  );
}
'''
Path('codedock-web/components/rooms/code-review-page.tsx').write_text(content, encoding='utf-8')
PY