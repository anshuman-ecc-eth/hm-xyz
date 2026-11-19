import { cn } from "@/lib/utils";
import { useNavigate } from "@tanstack/react-router";
import { Link2 } from "lucide-react";

export interface CitationChipRef {
  graphId: string;
  nodeId: string;
  nodeName: string;
  nodeType: string;
  path: string;
}

/**
 * Server ids are opaque and can be very long, so the chip renders the display
 * path snapshot and links by id.
 */
export function CitationChip({
  graphRef,
  className,
}: {
  graphRef: CitationChipRef;
  className?: string;
}) {
  const navigate = useNavigate();
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        e.preventDefault();
        navigate({
          to: "/node/$graphId",
          params: { graphId: graphRef.graphId },
          search: { node: graphRef.nodeId },
        });
      }}
      className={cn(
        "mt-2 flex w-full items-center gap-2 border px-2 py-1 text-left transition-colors hover:bg-muted/50",
        className,
      )}
      title={graphRef.path}
    >
      <Link2 className="h-3 w-3 shrink-0 text-muted-foreground" />
      <span className="min-w-0 flex-1 truncate text-[11px] text-muted-foreground">
        {graphRef.path || graphRef.nodeName}
      </span>
      <span className="shrink-0 text-[10px] uppercase tracking-wider text-muted-foreground">
        {graphRef.nodeType}
      </span>
    </button>
  );
}
