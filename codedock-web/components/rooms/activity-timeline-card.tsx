// components/rooms/activity-timeline-card.tsx
import { Card } from "@/components/ui/card";
import { CodeBlock } from "@/components/ui/code-block";
import { Button } from "@/components/ui/button";
import { Activity, FileText, Home, Link2, UserPlus } from "lucide-react";
import { useState } from "react";

// Define activity event type
export type ActivityEvent = {
  id: string;
  type: "member_joined" | "member_connected" | "file_edited" | "room_created";
  user_id: string;
  email: string;
  subject?: string;
  timestamp: string;
  details?: {
    file?: string;
    code?: string;
    language?: string;
    highlightLines?: number[];
  };
};

function getEventIcon(type: ActivityEvent["type"]) {
  switch (type) {
    case "member_joined":
      return <UserPlus className="h-4 w-4 text-sky-400" aria-hidden="true" />;
    case "member_connected":
      return <Link2 className="h-4 w-4 text-emerald-400" aria-hidden="true" />;
    case "file_edited":
      return (
        <FileText className="h-4 w-4 text-violet-400" aria-hidden="true" />
      );
    case "room_created":
      return <Home className="h-4 w-4 text-orange-400" aria-hidden="true" />;
    default:
      return <Activity className="h-4 w-4 text-slate-300" aria-hidden="true" />;
  }
}

function getEventDescription(event: ActivityEvent) {
  const label = event.subject || event.email;

  switch (event.type) {
    case "member_joined":
      return `${label} joined the room`;
    case "member_connected":
      return `${label} is currently active`;
    case "file_edited":
      return `${label} edited ${event.details?.file || "a file"}`;
    case "room_created":
      return `${label} session created`;
    default:
      return `${label} performed an action`;
  }
}

export default function ActivityTimelineCard({
  events,
  loading,
  error,
  onRetry,
}: {
  events: ActivityEvent[] | null;
  loading: boolean;
  error: string | null;
  onRetry?: () => void;
}) {
  const [expandedEvent, setExpandedEvent] = useState<string | null>(null);

  return (
    <Card>
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-white">
          Activity Timeline
        </h3>
        {events && !loading && (
          <div className="text-xs text-[rgb(158,183,211)]">
            {events.length} events
          </div>
        )}
      </div>

      {loading ? (
        <div className="mt-5 space-y-3">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="flex items-center gap-3 rounded-xl bg-white/[0.02] px-4 py-3"
            >
              <div className="h-6 w-6 animate-pulse rounded bg-white/10" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3.5 w-48 animate-pulse rounded bg-white/10" />
                <div className="h-3 w-24 animate-pulse rounded bg-white/[0.06]" />
              </div>
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="mt-4 rounded-lg border border-red-500/30 bg-red-500/5 p-3">
          <p className="text-sm text-[rgb(255,160,170)] mb-3">{error}</p>
          {onRetry && (
            <Button variant="destructive" size="sm" onClick={onRetry}>
              Retry
            </Button>
          )}
        </div>
      ) : !events || events.length === 0 ? (
        <p className="mt-3 text-sm text-[rgb(158,183,211)]">No activity yet.</p>
      ) : (
        <div className="mt-5 space-y-3">
          {events.map((event) => (
            <div
              key={event.id}
              className="rounded-xl border border-white/[0.06] bg-white/[0.03] px-4 py-3 transition-colors"
            >
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/[0.04] shadow-sm shadow-black/10">
                  {getEventIcon(event.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white">
                    {getEventDescription(event)}
                  </p>
                  <p className="text-xs text-[rgb(158,183,211)] mt-1">
                    {new Date(event.timestamp).toLocaleString()}
                  </p>
                  {event.type === "file_edited" && event.details?.code && (
                    <div className="mt-3">
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-[10px] font-medium"
                        onClick={() =>
                          setExpandedEvent(
                            expandedEvent === event.id ? null : event.id,
                          )
                        }
                      >
                        {expandedEvent === event.id ? "Hide code" : "View code"}
                      </Button>
                      {expandedEvent === event.id && (
                        <div className="mt-3">
                          <CodeBlock
                            language={event.details.language || "text"}
                            filename={event.details.file || "file"}
                            code={event.details.code}
                            highlightLines={event.details.highlightLines}
                          />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
