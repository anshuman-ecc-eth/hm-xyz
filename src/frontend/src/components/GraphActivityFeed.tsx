import { useNavigate } from "@tanstack/react-router";
import { ArrowUp, GitBranch, Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { GraphActivityResult } from "../hooks/useGraphActivity";
import { useInfiniteScroll } from "../hooks/useInfiniteScroll";
import { formatShortAgo } from "../utils/formatting";
import { activityContext } from "../utils/graphActivity";

export function GraphActivityFeed({
  activity,
}: {
  activity: GraphActivityResult;
}) {
  const {
    events,
    isLoading,
    isError,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
  } = activity;

  const navigate = useNavigate();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [atTop, setAtTop] = useState(true);
  const [seenTopId, setSeenTopId] = useState<string | null>(null);

  const sentinelRef = useInfiniteScroll({
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
    rootMargin: "80px",
  });

  // While the reader is at the top, new rows are seen immediately. Once they
  // scroll down, keep the top item pinned and surface a count instead.
  useEffect(() => {
    if (atTop && events[0]) setSeenTopId(events[0].id);
  }, [atTop, events]);

  const newCount = seenTopId
    ? Math.max(
        0,
        events.findIndex((event) => event.id === seenTopId),
      )
    : 0;

  const showNew = () => {
    scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
    if (events[0]) setSeenTopId(events[0].id);
  };

  return (
    <div
      ref={scrollRef}
      onScroll={(e) => {
        const next = e.currentTarget.scrollTop <= 4;
        if (next !== atTop) setAtTop(next);
      }}
      className="h-full overflow-y-auto"
    >
      {newCount > 0 && (
        <div className="sticky top-0 z-10 flex justify-center border-b border-border bg-background/90 py-1.5 backdrop-blur-sm">
          <button
            type="button"
            onClick={showNew}
            className="flex items-center gap-1 text-[10px] text-primary transition-colors hover:text-foreground"
          >
            <ArrowUp className="h-3 w-3" />
            {newCount} new {newCount === 1 ? "update" : "updates"}
          </button>
        </div>
      )}

      {isLoading ? (
        <div>
          {Array.from({ length: 5 }).map((_, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: stable list
            <div key={i} className="border-b border-border px-3 py-3">
              <div className="mb-1.5 h-3 w-32 animate-pulse bg-muted" />
              <div className="h-3 w-40 animate-pulse bg-muted" />
            </div>
          ))}
        </div>
      ) : isError ? (
        <p className="px-3 py-3 text-[11px] text-muted-foreground">
          Couldn't load graph activity
        </p>
      ) : events.length === 0 ? (
        <div className="px-3 py-6 text-center">
          <GitBranch
            className="mx-auto mb-2 h-5 w-5 text-muted-foreground"
            strokeWidth={1.5}
          />
          <p className="text-[11px] text-foreground">No graph activity yet</p>
          <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground">
            Published interpretations by you and people you follow will appear
            here.
          </p>
        </div>
      ) : (
        <div>
          {events.map((event) => (
            <button
              key={event.id}
              type="button"
              title={event.path || `${event.nodeName} · ${event.graphName}`}
              onClick={() =>
                navigate({
                  to: "/node/$graphId",
                  params: { graphId: event.graphId },
                  search: { node: event.nodeId },
                })
              }
              className="block w-full border-b border-border px-3 py-2.5 text-left transition-colors hover:bg-accent"
            >
              <p className="truncate text-[11px] leading-snug">
                <span className="font-medium">
                  {event.isSelf ? "you" : event.actorName}
                </span>
                <span className="text-muted-foreground"> {event.verb}</span>
              </p>
              <p className="mt-0.5 flex items-baseline justify-between gap-2 text-[10px] text-muted-foreground">
                <span className="min-w-0 truncate">
                  {activityContext(event)}
                </span>
                <span className="shrink-0 tabular-nums">
                  {formatShortAgo(event.at)}
                </span>
              </p>
            </button>
          ))}
        </div>
      )}

      <div ref={sentinelRef} className="h-1" />
      {isFetchingNextPage && (
        <div className="flex justify-center p-3">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        </div>
      )}
    </div>
  );
}
