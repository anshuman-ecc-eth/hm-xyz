import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";
import { MAX_INLINE_CITATIONS } from "../lib/citations";
import type { NodeSearchResult, NodeType } from "../lib/hyvmind";

const TYPE_DOT: Record<NodeType, string> = {
  curation: "bg-blue-400",
  swarm: "bg-orange-400",
  location: "bg-emerald-600",
  lawEntity: "bg-amber-600",
  interpEntity: "bg-purple-400",
};

interface InlineCitationSuggestionsProps {
  open: boolean;
  query: string;
  results: NodeSearchResult[];
  loading: boolean;
  error: boolean;
  highlighted: number;
  remaining: number;
  listId: string;
  onHighlight: (index: number) => void;
  onSelect: (node: NodeSearchResult) => void;
}

/**
 * Mention-style node picker for `[[...]]`. The textarea keeps focus and owns
 * the query; rows only react to real pointer movement and never steal the
 * caret on click.
 */
export function InlineCitationSuggestions({
  open,
  query,
  results,
  loading,
  error,
  highlighted,
  remaining,
  listId,
  onHighlight,
  onSelect,
}: InlineCitationSuggestionsProps) {
  if (!open) return null;

  return (
    <div
      id={listId}
      aria-label="Citation suggestions"
      className="absolute left-0 right-0 top-full z-30 mt-1 max-h-64 overflow-y-auto border border-border bg-background shadow-md"
    >
      {remaining <= 0 ? (
        <p className="px-3 py-2 font-mono text-[11px] text-muted-foreground">
          Cross-reference limit reached ({MAX_INLINE_CITATIONS} per post).
        </p>
      ) : error ? (
        <p className="px-3 py-2 font-mono text-[11px] text-muted-foreground">
          Couldn't reach hyvmind.app. You can still post without a
          cross-reference.
        </p>
      ) : loading && results.length === 0 ? (
        <div className="flex items-center gap-2 px-3 py-2 font-mono text-[11px] text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" /> loading nodes…
        </div>
      ) : query.trim().length === 0 ? (
        <p className="px-3 py-2 font-mono text-[11px] text-muted-foreground">
          Type to search provisions, interpretations…
        </p>
      ) : results.length === 0 ? (
        <p className="px-3 py-2 font-mono text-[11px] text-muted-foreground">
          No citable node matches that.
        </p>
      ) : (
        results.map((node, index) => (
          <button
            key={node.id}
            type="button"
            data-node-id={node.id}
            aria-current={index === highlighted ? "true" : undefined}
            onMouseDown={(e) => e.preventDefault()}
            onMouseMove={(e) => {
              if (e.movementX === 0 && e.movementY === 0) return;
              if (index !== highlighted) onHighlight(index);
            }}
            onClick={() => onSelect(node)}
            className={cn(
              "flex w-full items-start gap-2 border-b border-l-2 border-l-transparent px-3 py-1.5 text-left last:border-b-0",
              index === highlighted
                ? "border-l-primary bg-accent"
                : "hover:bg-muted/30",
            )}
          >
            <span
              className={cn("mt-1.5 h-1.5 w-1.5 shrink-0", TYPE_DOT[node.type])}
            />
            <span className="min-w-0 flex-1">
              <span className="block truncate font-mono text-[12px]">
                {node.name}
              </span>
              <span className="block truncate font-mono text-[10px] text-muted-foreground">
                {node.path} · {node.graphName}
              </span>
            </span>
          </button>
        ))
      )}
    </div>
  );
}
