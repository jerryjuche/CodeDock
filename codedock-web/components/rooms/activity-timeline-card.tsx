// components/rooms/activity-timeline-card.tsx
import { Card } from "@/components/ui/card";
import { CodeBlock } from "@/components/ui/code-block";
import { useState } from "react";

// Define activity event type
export type ActivityEvent = {
  id: string;
  type: 'member_joined' | 'member_connected' | 'file_edited' | 'room_created';
  user_id: string;
  email: string;
  timestamp: string;
  details?: {
    file?: string;
    code?: string;
    language?: string;
    highlightLines?: number[];
  };
};

function getEventIcon(type: ActivityEvent['type']) {
  switch (type) {
    case 'member_joined':
      return '👋';
    case 'member_connected':
      return '🔗';
    case 'file_edited':
      return '✏️';
    case 'room_created':
      return '🏠';
    default:
      return '📝';
  }
}

function getEventDescription(event: ActivityEvent) {
  switch (event.type) {
    case 'member_joined':
      return `${event.email} joined the room`;
    case 'member_connected':
      return `${event.email} connected`;
    case 'file_edited':
      return `${event.email} edited ${event.details?.file || 'a file'}`;
    case 'room_created':
      return `Room created by ${event.email}`;
    default:
      return `${event.email} performed an action`;
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
        <h3 className="text-base font-semibold text-white">Activity Timeline</h3>
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
          <p className="text-sm text-[rgb(255,160,170)] mb-2">{error}</p>
          {onRetry && (
            <button
              onClick={onRetry}
              className="px-3 py-1.5 text-xs font-medium rounded bg-red-500/20 text-red-300 hover:bg-red-500/30 transition-colors"
            >
              Try again
            </button>
          )}
        </div>
      ) : !events || events.length === 0 ? (
        <p className="mt-3 text-sm text-[rgb(158,183,211)]">
          No activity yet.
        </p>
      ) : (
        <div className="mt-5 space-y-3">
          {events.map((event) => (
            <div
              key={event.id}
              className="rounded-xl border border-white/[0.06] bg-white/[0.03] px-4 py-3 transition-colors"
            >
              <div className="flex items-start gap-3">
                <div className="text-lg">{getEventIcon(event.type)}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white">{getEventDescription(event)}</p>
                  <p className="text-xs text-[rgb(158,183,211)] mt-1">
                    {new Date(event.timestamp).toLocaleString()}
                  </p>
                  {event.type === 'file_edited' && event.details?.code && (
                    <div className="mt-3">
                      <button
                        onClick={() =>
                          setExpandedEvent(
                            expandedEvent === event.id ? null : event.id
                          )
                        }
                        className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
                      >
                        {expandedEvent === event.id ? 'Hide code' : 'Show code'}
                      </button>
                      {expandedEvent === event.id && (
                        <div className="mt-2">
                          <CodeBlock
                            language={event.details.language || 'text'}
                            filename={event.details.file || 'file'}
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