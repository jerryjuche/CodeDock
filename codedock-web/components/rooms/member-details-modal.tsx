// components/rooms/member-details-modal.tsx
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CodeBlock } from "@/components/ui/code-block";
import { Badge } from "@/components/ui/badge";
import { X, User, ClipboardCopy, Activity, FileText } from "lucide-react";
import type { RoomPresenceMember } from "@/types/room";
import type { ActivityEvent } from "./activity-timeline-card";

export default function MemberDetailsModal({
  member,
  activities = [],
  onClose,
}: {
  member: RoomPresenceMember;
  activities?: ActivityEvent[];
  onClose: () => void;
}) {
  const [showEdits, setShowEdits] = useState(false);

  const memberActivities = activities.filter(
    (activity) => activity.user_id === member.user_id,
  );

  const editActivities = memberActivities.filter(
    (activity) => activity.type === "file_edited",
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
      <div className="w-full max-w-3xl overflow-hidden rounded-[28px] border border-white/10 bg-slate-950 shadow-2xl shadow-black/40">
        <div className="flex items-center justify-between gap-4 border-b border-white/10 bg-slate-900 px-6 py-5">
          <div>
            <p className="text-xs uppercase tracking-[0.28em] text-[rgb(158,183,211)]">
              Member profile
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-white">
              {member.email}
            </h2>
          </div>
          <Button variant="ghost" size="sm" className="rounded-full p-2" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="grid gap-6 px-6 py-6 sm:grid-cols-[1.15fr_0.85fr]">
          <div className="space-y-6">
            <Card className="border border-white/10 bg-slate-900 p-5 shadow-none">
              <div className="flex items-center gap-3 text-sm text-[rgb(158,183,211)]">
                <User className="h-4 w-4 text-[rgb(239,102,46)]" />
                <span>Team member</span>
              </div>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div className="rounded-3xl bg-white/5 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-[rgb(158,183,211)]">
                    Role
                  </p>
                  <p className="mt-2 text-sm font-semibold text-white capitalize">
                    {member.role}
                  </p>
                </div>
                <div className="rounded-3xl bg-white/5 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-[rgb(158,183,211)]">
                    Connection
                  </p>
                  <div className="mt-2 flex items-center gap-2">
                    <Badge className={member.connected ? "border-emerald-500 text-emerald-300" : "border-slate-400 text-slate-300"}>
                      {member.connected ? "Connected" : "Offline"}
                    </Badge>
                  </div>
                </div>
              </div>
            </Card>

            <Card className="border border-white/10 bg-slate-900 p-5 shadow-none">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-[rgb(158,183,211)]">
                    Activity overview
                  </p>
                  <p className="mt-2 text-sm text-white">
                    {memberActivities.length} event{memberActivities.length === 1 ? "" : "s"} in this session
                  </p>
                </div>
                <Activity className="h-5 w-5 text-[rgb(239,102,46)]" />
              </div>
            </Card>
          </div>

          <div className="space-y-6">
            <Card className="border border-white/10 bg-slate-900 p-5 shadow-none">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-[rgb(158,183,211)]">
                    Editing insights
                  </p>
                  <p className="mt-2 text-sm text-white">
                    {editActivities.length > 0
                      ? `${editActivities.length} recent file change${editActivities.length === 1 ? "" : "s"}`
                      : "No file edits captured yet"}
                  </p>
                </div>
                <FileText className="h-5 w-5 text-[rgb(36,166,242)]" />
              </div>
            </Card>

            <div className="rounded-3xl border border-white/10 bg-slate-900 p-5 shadow-none">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-[rgb(158,183,211)]">
                    Recent edits
                  </p>
                  <p className="mt-2 text-sm text-white">
                    View recent code changes or snapshots when available.
                  </p>
                </div>
                <ClipboardCopy className="h-5 w-5 text-[rgb(239,102,46)]" />
              </div>

              {editActivities.length === 0 ? (
                <div className="mt-6 rounded-3xl border border-dashed border-white/10 bg-white/5 p-5 text-sm text-[rgb(158,183,211)]">
                  No code edits are available for this member yet.
                </div>
              ) : (
                <div className="mt-5 space-y-4">
                  <Button
                    variant="secondary"
                    onClick={() => setShowEdits(!showEdits)}
                  >
                    {showEdits ? "Hide file preview" : "Reveal recent edits"}
                  </Button>
                  {showEdits && (
                    <div className="space-y-4">
                      {editActivities.map((activity) => (
                        <div key={activity.id}>
                          <p className="text-xs text-[rgb(158,183,211)] mb-2">
                            {activity.details?.file || "Untitled file"} • {new Date(activity.timestamp).toLocaleString()}
                          </p>
                          {activity.details?.code && (
                            <CodeBlock
                              language={activity.details.language || "text"}
                              filename={activity.details.file || "file"}
                              code={activity.details.code}
                              highlightLines={activity.details.highlightLines}
                            />
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
