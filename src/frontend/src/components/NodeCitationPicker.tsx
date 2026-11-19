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
import { Loader2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { GraphRefInput } from "../backend";
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
}

export function NodeCitationPicker({
  open,
  onOpenChange,
  onSelect,
}: NodeCitationPickerProps) {
  const [scope, setScope] = useState<string>(ALL);
  const [query, setQuery] = useState("");
  const [highlighted, setHighlighted] = useState(0);

  const graphs = useHyvmindGraphs();
  const single = useHyvmindNodes(scope === ALL ? null : scope);
  const all = useAllHyvmindNodes(open && scope === ALL);

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
    }
  }, [open]);

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
      <DialogContent className="max-w-2xl gap-0 p-0">
        <DialogHeader className="border-b px-4 py-3">
          <DialogTitle className="font-mono text-sm font-medium">
            Cite a node
          </DialogTitle>
          <DialogDescription className="font-mono text-xs">
            A citation makes this a graph post: it cannot be edited or deleted.
          </DialogDescription>
        </DialogHeader>

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
              Couldn't reach hyvmind.app. You can still post without a citation.
            </p>
          ) : loading && results.length === 0 ? (
            <div className="flex items-center gap-2 px-4 py-6 font-mono text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading nodes…
            </div>
          ) : query.trim().length === 0 ? (
            <p className="px-4 py-6 font-mono text-xs text-muted-foreground">
              Type to search. Only law tokens and interpretations can be cited.
            </p>
          ) : results.length === 0 ? (
            <p className="px-4 py-6 font-mono text-xs text-muted-foreground">
              No citable node matches that.
            </p>
          ) : (
            results.map((node, i) => (
              <button
                key={node.id}
                type="button"
                onMouseEnter={() => setHighlighted(i)}
                onClick={() => choose(node)}
                className={cn(
                  "flex w-full items-start gap-2 border-b px-4 py-2 text-left last:border-b-0",
                  i === highlighted ? "bg-muted/60" : "hover:bg-muted/30",
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
                    {node.type} · {node.graphName}
                  </span>
                </span>
              </button>
            ))
          )}
        </div>

        {preview && (
          <div className="space-y-2 border-t px-4 py-3">
            <p className="font-mono text-[11px] text-muted-foreground">
              {preview.path}
            </p>
            {preview.content && (
              <p className="line-clamp-3 text-[13px] leading-relaxed">
                {preview.content}
              </p>
            )}
            {preview.sources && preview.sources.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {preview.sources.slice(0, 4).map((s) => (
                  <Badge
                    key={`${s.name}-${s.url}`}
                    variant="outline"
                    className="font-mono text-[10px]"
                  >
                    {s.name}
                  </Badge>
                ))}
              </div>
            )}
            <div className="flex justify-end">
              <Button
                type="button"
                size="sm"
                onClick={() => choose(preview)}
                className="font-mono text-xs"
              >
                Cite this node
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
