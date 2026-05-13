// components/rooms/member-details-modal.tsx
import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CodeBlock } from "@/components/ui/code-block";
import { Badge } from "@/components/ui/badge";
import { X, User, Activity, FileText, ClipboardCopy } from "lucide-react";
import type { RoomPresenceMember } from "@/types/room";
import type { ActivityEvent } from "./activity-timeline-card";

const formatTimestamp = (timestamp: string) => {
  const date = new Date(timestamp);
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
};

export default function MemberDetailsModal({
  member,
  activities = [],
  onClose,
}: {
  member: RoomPresenceMember;
  activities?: Array<ActivityEvent | any>;
  onClose: () => void;
}) {
  const [showCodeReview, setShowCodeReview] = useState(false);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);

  const transformedActivities: ActivityEvent[] = activities.map((activity) => ({
    id: activity.id,
    type: activity.type || "file_edited",
    user_id: activity.user_id,
    email: member.email,
    subject: member.email,
    timestamp: activity.created_at || new Date().toISOString(),
    details: activity.details
      ? {
          file: activity.file_path || activity.details?.file,
          code: activity.details?.code,
          language: activity.details?.language,
          highlightLines: activity.details?.highlightLines,
        }
      : undefined,
  }));

  const memberActivities = transformedActivities.filter(
    (activity) => activity.user_id === member.user_id,
  );

  const editActivities = memberActivities.filter(
    (activity) => activity.type === "file_edited",
  );

  const fileGroups = useMemo(() => {
    const groups = new Map<
      string,
      { file: string; activities: ActivityEvent[] }
    >();

    editActivities.forEach((activity) => {
      const file = activity.details?.file || "Unknown file";
      const existing = groups.get(file) ?? { file, activities: [] };
      existing.activities.push(activity);
      groups.set(file, existing);
    });

    return Array.from(groups.values()).map((group) => ({
      file: group.file,
      activities: group.activities.sort(
        (a, b) =>
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
      ),
    }));
  }, [editActivities]);

  const selectedFileGroup = selectedFile
    ? (fileGroups.find((group) => group.file === selectedFile) ?? fileGroups[0])
    : fileGroups[0];

  const filesModifiedCount = fileGroups.length;
  const latestEdit = editActivities[0];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 p-4 backdrop-blur-sm">
      <div className="w-full max-w-5xl overflow-hidden rounded-[32px] border border-white/10 bg-slate-950 shadow-2xl shadow-black/40">
        <div className="flex flex-col gap-6 border-b border-white/10 bg-slate-900 px-6 py-6 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-[0.32em] text-[rgb(158,183,211)]">
              Member profile overview
            </p>
            <h2 className="mt-3 text-3xl font-semibold text-white sm:text-4xl">
              {member.email}
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-[rgb(158,183,211)]">
              A concise view of this participant’s session activity, code
              contributions, and recent file edits.
            </p>
          </div>

          <div className="flex items-center gap-3 self-start">
            <Button
              variant="secondary"
              size="sm"
              className="rounded-full"
              onClick={onClose}
            >
              Close profile
            </Button>
          </div>
        </div>

        <div className="grid gap-6 px-6 py-6 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="space-y-6">
            <Card className="border border-white/10 bg-slate-900 p-6 shadow-none">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.24em] text-[rgb(158,183,211)]">
                    Session Activity
                  </p>
                  <h3 className="mt-3 text-xl font-semibold text-white">
                    {memberActivities.length} contribution
                    {memberActivities.length === 1 ? "" : "s"}
                  </h3>
                  <p className="mt-3 text-sm leading-6 text-[rgb(158,183,211)]">
                    Captured this member’s collaboration footprint for the
                    current session, including file edits and presence events.
                  </p>
                </div>
                <Activity className="h-8 w-8 text-[rgb(239,102,46)]" />
              </div>
            </Card>

            <div className="grid gap-4 sm:grid-cols-2">
              <Card className="border border-white/10 bg-slate-900 p-6 shadow-none">
                <p className="text-xs uppercase tracking-[0.22em] text-[rgb(158,183,211)]">
                  Files modified
                </p>
                <p className="mt-3 text-3xl font-semibold text-white">
                  {filesModifiedCount}
                </p>
                <p className="mt-2 text-sm leading-6 text-[rgb(158,183,211)]">
                  unique files touched during this session.
                </p>
              </Card>
              <Card className="border border-white/10 bg-slate-900 p-6 shadow-none">
                <p className="text-xs uppercase tracking-[0.22em] text-[rgb(158,183,211)]">
                  Latest edit
                </p>
                <p className="mt-3 text-xl font-semibold text-white">
                  {latestEdit
                    ? formatTimestamp(latestEdit.timestamp)
                    : "No edits yet"}
                </p>
                <p className="mt-2 text-sm leading-6 text-[rgb(158,183,211)]">
                  {latestEdit?.details?.file ??
                    "No code changes have been captured."}
                </p>
              </Card>
            </div>
          </div>

          <div className="space-y-6">
            <Card className="border border-white/10 bg-slate-900 p-6 shadow-none">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.24em] text-[rgb(158,183,211)]">
                    Code contributions
                  </p>
                  <h3 className="mt-3 text-xl font-semibold text-white">
                    {editActivities.length} edit
                    {editActivities.length === 1 ? "" : "s"}
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-[rgb(158,183,211)]">
                    {filesModifiedCount > 0
                      ? `${filesModifiedCount} file${filesModifiedCount === 1 ? "" : "s"} modified across this session.`
                      : "No code contributions recorded yet."}
                  </p>
                </div>
                <FileText className="h-8 w-8 text-[rgb(36,166,242)]" />
              </div>
            </Card>

            <div className="rounded-[24px] border border-white/10 bg-slate-950 p-6 shadow-none">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.24em] text-[rgb(158,183,211)]">
                    Recent code review
                  </p>
                  <p className="mt-2 text-sm leading-6 text-[rgb(158,183,211)]">
                    Inspect the latest changed files and preview updated content
                    with contextual line highlighting.
                  </p>
                </div>
                <Button
                  variant="secondary"
                  onClick={() => setShowCodeReview((current) => !current)}
                >
                  {showCodeReview ? "Hide review" : "Review changes"}
                </Button>
              </div>

              {filesModifiedCount === 0 ? (
                <div className="mt-6 rounded-[24px] border border-dashed border-white/10 bg-white/5 p-5 text-sm text-[rgb(158,183,211)]">
                  No code changes available for review yet.
                </div>
              ) : (
                <div className="mt-6 space-y-4">
                  <div className="grid gap-3">
                    {fileGroups.map((group) => (
                      <button
                        key={group.file}
                        type="button"
                        onClick={() => setSelectedFile(group.file)}
                        className={`flex w-full items-center justify-between rounded-3xl border px-4 py-3 text-left transition ${
                          selectedFileGroup?.file === group.file
                            ? "border-[rgba(63,188,255,0.75)] bg-slate-900"
                            : "border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/10"
                        }`}
                      >
                        <div>
                          <p className="text-sm font-semibold text-white">
                            {group.file}
                          </p>
                          <p className="mt-1 text-xs text-[rgb(158,183,211)]">
                            {group.activities.length} edit
                            {group.activities.length === 1 ? "" : "s"} •{" "}
                            {formatTimestamp(group.activities[0].timestamp)}
                          </p>
                        </div>
                        <Badge className="border-white/10 text-[rgb(158,183,211)]">
                          {group.activities.length}x
                        </Badge>
                      </button>
                    ))}
                  </div>

                  {showCodeReview && selectedFileGroup ? (
                    selectedFileGroup.activities[0]?.details?.code ? (
                      <div className="space-y-4 rounded-[28px] border border-white/10 bg-slate-900 p-5">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                          <div>
                            <p className="text-xs uppercase tracking-[0.24em] text-[rgb(158,183,211)]">
                              {selectedFileGroup.file}
                            </p>
                            <p className="mt-1 text-sm text-[rgb(158,183,211)]">
                              Latest update{" "}
                              {formatTimestamp(
                                selectedFileGroup.activities[0].timestamp,
                              )}
                            </p>
                          </div>
                          <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-[rgb(148,163,184)]">
                            {selectedFileGroup.activities.length} edit
                            {selectedFileGroup.activities.length === 1
                              ? ""
                              : "s"}
                          </div>
                        </div>
                        <CodeBlock
                          language={
                            selectedFileGroup.activities[0].details?.language ||
                            "text"
                          }
                          filename={selectedFileGroup.file}
                          code={selectedFileGroup.activities[0].details.code}
                          highlightLines={
                            selectedFileGroup.activities[0].details
                              ?.highlightLines
                          }
                        />
                      </div>
                    ) : (
                      <div className="rounded-[24px] border border-dashed border-white/10 bg-white/5 p-5 text-sm text-[rgb(158,183,211)]">
                        No editable code preview is available for this selected
                        file.
                      </div>
                    )
                  ) : null}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
