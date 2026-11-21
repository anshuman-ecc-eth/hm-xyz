import { cn } from "@/lib/utils";
import { useNavigate } from "@tanstack/react-router";
import { GitBranch, Link2 } from "lucide-react";
import type { Post } from "../utils/types";

/**
 * A chain post's summary. When it is an extension (or already published) there
 * is a graph ref to link to; a brand-new, unpublished graph has none yet.
 */
export function ChainChip({
  post,
  className,
}: { post: Post; className?: string }) {
  const navigate = useNavigate();
  const chain = post.chain;
  if (!chain) return null;

  const published = !!post.graphRef?.tokenNodeId;
  const startName = chain.start?.nodeName;
  const path = [
    ...(startName ? [startName] : []),
    ...chain.levels.map((level) => level.name),
  ].join(" › ");
  const newCount = chain.levels.length + 1;
  const label = published
    ? chain.start
      ? `chain published · ${newCount} nodes`
      : "new graph"
    : chain.start
      ? "new chain · unpublished"
      : "new graph · unpublished";

  const inner = (
    <>
      {published && post.graphRef ? (
        <Link2 className="h-3 w-3 shrink-0 text-muted-foreground" />
      ) : (
        <GitBranch className="h-3 w-3 shrink-0 text-muted-foreground" />
      )}
      <span className="min-w-0 flex-1 truncate text-[11px] text-muted-foreground">
        {startName ? `${startName} › ` : ""}
        {chain.levels.map((level) => level.name).join(" › ")}
      </span>
      <span className="shrink-0 text-[10px] tracking-wide text-muted-foreground">
        {label}
      </span>
    </>
  );

  const classes = cn(
    "mt-2 flex w-full items-center gap-2 border px-2 py-1 text-left transition-colors",
    published && post.graphRef
      ? "hover:bg-muted/50"
      : "border-dashed text-muted-foreground",
    className,
  );

  if (published && post.graphRef) {
    return (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          e.preventDefault();
          navigate({
            to: "/node/$graphId",
            params: { graphId: post.graphRef?.graphId ?? "" },
            search: { node: post.graphRef?.nodeId ?? "" },
          });
        }}
        className={classes}
        title={path}
      >
        {inner}
      </button>
    );
  }

  return (
    <div className={classes} title={path}>
      {inner}
    </div>
  );
}
