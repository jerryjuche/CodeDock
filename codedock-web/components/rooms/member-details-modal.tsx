// components/rooms/member-details-modal.tsx
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CodeBlock } from "@/components/ui/code-block";
import type { RoomPresenceMember } from "@/types/room";
import type { ActivityEvent } from "./activity-timeline-card";

export default function MemberDetailsModal({
  member,
  activities,
  onClose,
}: {
  member: RoomPresenceMember;
  activities: ActivityEvent[];
  onClose: () => void;
}) {
  const [showEdits, setShowEdits] = useState(false);

  // Filter activities for this member
  const memberActivities = activities.filter(
    (activity) => activity.user_id === member.user_id,
  );

  // Get edit activities
  const editActivities = memberActivities.filter(
    (activity) => activity.type === "file_edited",
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto">
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-white">Member Details</h2>
            <Button variant="ghost" size="sm" onClick={onClose}>
              ✕
            </Button>
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-[rgb(158,183,211)]">
                Email
              </label>
              <p className="text-white">{member.email}</p>
            </div>

            <div>
              <label className="text-sm font-medium text-[rgb(158,183,211)]">
                Role
              </label>
              <p className="text-white capitalize">{member.role}</p>
            </div>

            <div>
              <label className="text-sm font-medium text-[rgb(158,183,211)]">
                Status
              </label>
              <p className="text-white">
                {member.connected ? "Connected" : "Offline"}
              </p>
            </div>

            <div>
              <label className="text-sm font-medium text-[rgb(158,183,211)]">
                Recent Activity
              </label>
              <p className="text-white text-sm">
                {memberActivities.length} events in this session
              </p>
            </div>

            {editActivities.length > 0 && (
              <div>
                <button
                  onClick={() => setShowEdits(!showEdits)}
                  className="text-sm text-blue-400 hover:text-blue-300 transition-colors"
                >
                  {showEdits
                    ? "Hide edits"
                    : `Show ${editActivities.length} file edits`}
                </button>
                {showEdits && (
                  <div className="mt-4 space-y-4">
                    {editActivities.map((activity) => (
                      <div key={activity.id}>
                        <p className="text-xs text-[rgb(158,183,211)] mb-2">
                          Edited {activity.details?.file} at{" "}
                          {new Date(activity.timestamp).toLocaleString()}
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
        </Card>
      </div>
    </div>
  );
}
