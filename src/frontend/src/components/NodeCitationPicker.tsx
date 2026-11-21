import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { Loader2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ChainInput, GraphRefInput } from "../backend";
import {
  useAllHyvmindNodes,
  useHyvmindGraphs,
  useHyvmindNodes,
} from "../hooks/useHyvmind";
import {
  type NodeSearchResult,
  type NodeType,
  type ResolvedNode,
  isCitable,
  searchNodes,
} from "../lib/hyvmind";
import { formatNodeType } from "../utils/formatting";
import { ChainBuilder } from "./ChainBuilder";

const TYPE_DOT: Record<NodeType, string> = {
  curation: "bg-blue-400",
  swarm: "bg-orange-400",
  location: "bg-emerald-600",
  lawEntity: "bg-amber-600",
  interpEntity: "bg-purple-400",
};

const ALL = "__all__";

export interface NodeCitationPickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (ref: GraphRefInput) => void;
  onSelectChain: (chain: ChainInput) => void;
}

export function NodeCitationPicker({
  open,
  onOpenChange,
  onSelect,
  onSelectChain,
}: NodeCitationPickerProps) {
  const [mode, setMode] = useState<"node" | "chain">("node");
  const [scope, setScope] = useState<string>(ALL);
  const [query, setQuery] = useState("");
  const [highlighted, setHighlighted] = useState(0);
  const [detailsNode, setDetailsNode] = useState<ResolvedNode | null>(null);
  const rowRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const graphs = useHyvmindGraphs();
  const single = useHyvmindNodes(scope === ALL ? null : scope);
  const all = useAllHyvmindNodes(open);

  const loading = scope === ALL ? all.isFetching : single.isFetching;
  const error = scope === ALL ? all.error : single.error;
  const nodes: ResolvedNode[] = useMemo(
    () => (scope === ALL ? (all.data ?? []) : (single.data ?? [])),
    [scope, all.data, single.data],
  );

  const results: NodeSearchResult[] = useMemo(
    () => searchNodes(nodes.filter(isCitable), query, 12),
    [nodes, query],
  );

  useEffect(() => {
    if (!open) {
      setQuery("");
      setHighlighted(0);
      setDetailsNode(null);
      setMode("node");
    }
  }, [open]);

  // Keep the index inside the list as it shrinks, so the preview never
  // disappears while the user is still looking at a result.
  useEffect(() => {
    setHighlighted((i) => Math.min(i, Math.max(0, results.length - 1)));
  }, [results.length]);

  // Keyboard navigation must keep the active row visible; the list scrolls
  // rather than the selection wandering off-screen.
  useEffect(() => {
    rowRefs.current[highlighted]?.scrollIntoView?.({ block: "nearest" });
  }, [highlighted]);

  function choose(node: ResolvedNode) {
    onSelect({
      graphId: node.graphId,
      graphName: node.graphName,
      nodeId: node.id,
      nodeName: node.name,
      nodeType: node.type,
      path: node.path,
    });
    onOpenChange(false);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (results.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlighted((i) => (i + 1) % results.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlighted((i) => (i - 1 + results.length) % results.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const hit = results[highlighted];
      if (hit) choose(hit);
    }
  }

  const preview = results[highlighted];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        aria-describedby={undefined}
        className="grid-cols-1 gap-0 p-0 sm:max-w-2xl"
      >
        <DialogHeader className="border-b px-4 py-3">
          <DialogTitle className="font-mono text-sm font-medium">
            Add to graph
          </DialogTitle>
        </DialogHeader>

        <div className="flex border-b">
          {(
            [
              ["node", "Existing node"],
              ["chain", "New chain"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setMode(value)}
              className={cn(
                "flex-1 border-b px-4 py-2 font-mono text-[11px] uppercase tracking-[0.08em]",
                mode === value
                  ? "border-b-primary bg-accent text-foreground"
                  : "border-b-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {mode === "node" ? (
          <>
            <div className="flex gap-2 border-b p-3">
              <Select
                value={scope}
                onValueChange={(v) => {
                  setScope(v);
                  setHighlighted(0);
                }}
              >
                <SelectTrigger className="w-[200px] shrink-0 font-mono text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>All graphs</SelectItem>
                  {(graphs.data ?? []).map((g) => (
                    <SelectItem key={g.id} value={g.id}>
                      {g.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                autoFocus
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setHighlighted(0);
                }}
                onKeyDown={handleKeyDown}
                placeholder="Search provisions, interpretations…"
                className="font-mono text-sm"
              />
            </div>

            <div className="max-h-[320px] min-h-[160px] overflow-y-auto">
              {error ? (
                <p className="px-4 py-6 font-mono text-xs text-muted-foreground">
                  Couldn't reach hyvmind.app. You can still post without a
                  citation.
                </p>
              ) : loading && results.length === 0 ? (
                <div className="flex items-center gap-2 px-4 py-6 font-mono text-xs text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading
                  nodes…
                </div>
              ) : query.trim().length === 0 ? (
                <p className="px-4 py-6 font-mono text-xs text-muted-foreground">
                  Type to search. Only law tokens and interpretations can be
                  cited.
                </p>
              ) : results.length === 0 ? (
                <p className="px-4 py-6 font-mono text-xs text-muted-foreground">
                  No citable node matches that.
                </p>
              ) : (
                results.map((node, i) => (
                  <button
                    key={node.id}
                    ref={(el) => {
                      rowRefs.current[i] = el;
                    }}
                    type="button"
                    data-node-id={node.id}
                    aria-current={i === highlighted ? "true" : undefined}
                    onMouseMove={(e) => {
                      // Only react to real pointer movement. Layout shifts (e.g.
                      // the list scrolling under a still cursor) fire `mouseenter`
                      // but not `mousemove`, which is what caused the picker to
                      // chase its own hover state.
                      if (e.movementX === 0 && e.movementY === 0) return;
                      if (i !== highlighted) setHighlighted(i);
                    }}
                    onClick={() => choose(node)}
                    className={cn(
                      "flex w-full items-start gap-2 border-b border-l-2 border-l-transparent px-4 py-2 text-left last:border-b-0",
                      i === highlighted
                        ? "border-l-primary bg-accent"
                        : "hover:bg-muted/30",
                    )}
                  >
                    <span
                      className={cn(
                        "mt-1.5 h-1.5 w-1.5 shrink-0",
                        TYPE_DOT[node.type],
                      )}
                    />
                    <span className="min-w-0">
                      <span className="block truncate font-mono text-sm">
                        {node.name}
                      </span>
                      <span className="block truncate font-mono text-[11px] text-muted-foreground">
                        {formatNodeType(node.type)} · {node.graphName}
                      </span>
                    </span>
                  </button>
                ))
              )}
            </div>

            <div
              data-slot="citation-preview"
              className="h-[144px] overflow-hidden border-t px-4 py-3"
            >
              {preview ? (
                <div className="flex h-full flex-col justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="min-w-0 truncate font-mono text-[11px] text-muted-foreground">
                        {preview.path}
                      </p>
                      <button
                        type="button"
                        onClick={() => setDetailsNode(preview)}
                        className="shrink-0 font-mono text-[10px] uppercase tracking-[0.08em] text-primary underline-offset-2 hover:underline"
                      >
                        see full
                      </button>
                    </div>
                    {preview.content ? (
                      <p className="mt-1 line-clamp-2 text-[13px] leading-relaxed">
                        {preview.content}
                      </p>
                    ) : (
                      <p className="mt-1 truncate text-[13px] leading-relaxed text-muted-foreground">
                        No content for this node.
                      </p>
                    )}
                  </div>
                  <div className="flex items-end justify-between gap-2 overflow-hidden">
                    <div className="flex min-w-0 flex-nowrap items-center gap-1 overflow-hidden">
                      {(preview.sources ?? []).slice(0, 3).map((s) => (
                        <Badge
                          key={`${s.name}-${s.url}`}
                          variant="outline"
                          className="shrink-0 font-mono text-[10px]"
                        >
                          {s.name}
                        </Badge>
                      ))}
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => choose(preview)}
                      className="shrink-0 font-mono text-xs"
                    >
                      Cite this node
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex h-full items-center">
                  <p className="font-mono text-[11px] text-muted-foreground">
                    Pick a result to preview its path and content.
                  </p>
                </div>
              )}
            </div>
          </>
        ) : (
          <ChainBuilder
            nodes={all.data ?? []}
            graphs={graphs.data ?? []}
            loading={all.isFetching && (all.data?.length ?? 0) === 0}
            onConfirm={(chain) => {
              onSelectChain(chain);
              onOpenChange(false);
            }}
          />
        )}
      </DialogContent>

      <NodeDetailsDialog
        node={detailsNode}
        onOpenChange={(next) => {
          if (!next) setDetailsNode(null);
        }}
      />
    </Dialog>
  );
}

function NodeDetailsDialog({
  node,
  onOpenChange,
}: {
  node: ResolvedNode | null;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={!!node} onOpenChange={onOpenChange}>
      <DialogContent className="grid-cols-1 gap-0 p-0 sm:max-w-xl">
        {node && (
          <>
            <DialogHeader className="border-b px-4 py-3 pr-12">
              <DialogTitle className="truncate font-mono text-sm font-medium">
                {node.name}
              </DialogTitle>
              <DialogDescription className="font-mono text-[10px] uppercase tracking-[0.08em]">
                {formatNodeType(node.type)} · {node.graphName}
              </DialogDescription>
            </DialogHeader>

            <div className="max-h-[70vh] overflow-y-auto px-4 py-3">
              <p className="break-words font-mono text-[11px] leading-relaxed text-muted-foreground">
                {node.path}
              </p>

              {node.content ? (
                <p className="mt-3 whitespace-pre-wrap break-words text-[13px] leading-relaxed">
                  {node.content}
                </p>
              ) : (
                <p className="mt-3 text-[13px] text-muted-foreground">
                  No content for this node.
                </p>
              )}

              <dl className="mt-4 grid grid-cols-[auto_1fr] items-start gap-x-4 gap-y-2 border-t pt-3 font-mono text-[11px]">
                <dt className="text-muted-foreground">Type</dt>
                <dd>{formatNodeType(node.type)}</dd>
                <dt className="text-muted-foreground">Node ID</dt>
                <dd className="min-w-0 select-all break-all">{node.id}</dd>
                <dt className="text-muted-foreground">Timestamp</dt>
                <dd>
                  {node.createdAt != null
                    ? formatNodeTimestamp(node.createdAt)
                    : "—"}
                </dd>
                {node.creator && (
                  <>
                    <dt className="text-muted-foreground">Creator</dt>
                    <dd className="min-w-0 select-all break-all">
                      {node.creator}
                    </dd>
                  </>
                )}
                {node.attributes && node.attributes.length > 0 && (
                  <>
                    <dt className="text-muted-foreground">Attributes</dt>
                    <dd className="min-w-0 space-y-0.5">
                      {node.attributes.map((attribute) => (
                        <div key={attribute.key}>
                          <span className="text-muted-foreground">
                            {attribute.key}:
                          </span>{" "}
                          {attribute.weightedValues.map((entry, index) => (
                            <span key={`${attribute.key}-${entry.value}`}>
                              {index > 0 && ", "}
                              {entry.value}
                              {entry.weight !== 1 && (
                                <span className="text-muted-foreground">
                                  {" "}
                                  (weight {entry.weight})
                                </span>
                              )}
                            </span>
                          ))}
                        </div>
                      ))}
                    </dd>
                  </>
                )}
                {node.sources && node.sources.length > 0 && (
                  <>
                    <dt className="text-muted-foreground">Sources</dt>
                    <dd className="min-w-0 space-y-0.5">
                      {node.sources.map((source) => (
                        <div key={`${source.name}-${source.url}`}>
                          <a
                            href={source.url}
                            target="_blank"
                            rel="noreferrer noopener"
                            className="break-all text-primary underline-offset-4 hover:underline"
                          >
                            {source.name || source.url}
                          </a>
                        </div>
                      ))}
                    </dd>
                  </>
                )}
              </dl>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** Node timestamps arrive as u64 nanoseconds; Date wants milliseconds. */
function formatNodeTimestamp(value: number): string {
  const ms = Number(value) / 1_000_000;
  if (!Number.isFinite(ms) || ms <= 0) return "—";
  return format(new Date(ms), "d MMM yyyy, HH:mm");
}
