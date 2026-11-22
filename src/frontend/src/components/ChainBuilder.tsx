import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Principal } from "@icp-sdk/core/principal";
import { Loader2, Plus, X } from "lucide-react";
import { useMemo, useState } from "react";
import type { ChainInput } from "../backend";
import { type GraphMeta, type ResolvedNode, searchNodes } from "../lib/hyvmind";
import { formatNodeType } from "../utils/formatting";

type StartLevel = "new" | "curation" | "swarm" | "location";

const LEVELS: Record<StartLevel, string[]> = {
  new: ["curation", "swarm", "location", "lawEntity"],
  curation: ["swarm", "location", "lawEntity"],
  swarm: ["location", "lawEntity"],
  location: ["lawEntity"],
};

const TYPE_NOUN: Record<string, string> = {
  curation: "curation",
  swarm: "swarm",
  location: "location",
  lawEntity: "law token",
  interpEntity: "interpretation token",
};

const typeNoun = (type: string) => TYPE_NOUN[type] ?? formatNodeType(type);

const NODE_COST: Record<string, number> = {
  curation: 10,
  swarm: 20,
  location: 30,
  lawEntity: 40,
};

const TYPE_DOT: Record<string, string> = {
  curation: "bg-[#4a9eff]",
  swarm: "bg-[#ff7f50]",
  location: "bg-[#90EE90]",
  lawEntity: "bg-[#FFD700]",
  interpEntity: "bg-[#DA70D6]",
};

interface LevelMeta {
  attributes: { key: string; values: string }[];
  sources: { name: string; url: string }[];
}

const emptyMeta = (): LevelMeta => ({ attributes: [], sources: [] });

function trimToRef(node: ResolvedNode) {
  return {
    graphId: node.graphId,
    graphName: node.graphName,
    nodeId: node.id,
    nodeName: node.name,
    nodeType: node.type,
    path: node.path,
    swarmNodeId: node.swarmNodeId ?? undefined,
    swarmCreator: node.swarmCreator
      ? Principal.fromText(node.swarmCreator)
      : undefined,
    communityName: node.swarmLabel ?? undefined,
  };
}

function nameError(name: string): string | null {
  const trimmed = name.trim();
  if (trimmed.length === 0) return "A name is required";
  if (trimmed.length > 120) return "120 characters max";
  if (trimmed.includes("@")) return "No '@'";
  if (trimmed.includes("›")) return "No '›'";
  if ([...trimmed].some((char) => char.charCodeAt(0) < 32)) {
    return "No control characters";
  }
  return null;
}

export function ChainBuilder({
  nodes,
  graphs,
  loading,
  onConfirm,
}: {
  nodes: ResolvedNode[];
  graphs: GraphMeta[];
  loading: boolean;
  onConfirm: (chain: ChainInput) => void;
}) {
  const [startLevel, setStartLevel] = useState<StartLevel>("new");
  const [startNode, setStartNode] = useState<ResolvedNode | null>(null);
  const [query, setQuery] = useState("");
  const [names, setNames] = useState<Record<string, string>>({});
  const [meta, setMeta] = useState<Record<string, LevelMeta>>({});
  const [openMeta, setOpenMeta] = useState<Record<string, boolean>>({});

  const levels = LEVELS[startLevel];

  const startResults = useMemo(() => {
    if (startLevel === "new") return [];
    const candidates = nodes.filter((node) => node.type === startLevel);
    if (query.trim().length === 0) {
      return candidates
        .slice()
        .sort((a, b) => a.name.localeCompare(b.name))
        .slice(0, 6);
    }
    return searchNodes(candidates, query, 8);
  }, [nodes, startLevel, query]);

  const reset = (next: StartLevel) => {
    setStartLevel(next);
    setStartNode(null);
    setQuery("");
    setNames({});
    setMeta({});
    setOpenMeta({});
  };

  const setLevelName = (level: string, value: string) => {
    setNames((current) => ({ ...current, [level]: value }));
  };

  const patchMeta = (level: string, update: (m: LevelMeta) => LevelMeta) => {
    setMeta((current) => ({
      ...current,
      [level]: update(current[level] ?? emptyMeta()),
    }));
  };

  const levelErrors = levels.map((level) => nameError(names[level] ?? ""));
  const duplicateCuration =
    startLevel === "new" &&
    (graphs ?? []).some(
      (graph) =>
        graph.name.trim().toLowerCase() ===
        (names.curation ?? "").trim().toLowerCase(),
    );
  const valid =
    (startLevel === "new" || startNode != null) &&
    levelErrors.every((error) => error == null) &&
    !duplicateCuration;

  const cost =
    50 + levels.reduce((total, level) => total + (NODE_COST[level] ?? 0), 0);

  const previewParts = [
    ...(startNode ? [startNode.name] : []),
    ...levels.map((level) => names[level]?.trim() || `new ${typeNoun(level)}`),
    "your interpretation",
  ];

  const submit = () => {
    if (!valid) return;
    const chain: ChainInput = {
      start: startNode ? trimToRef(startNode) : undefined,
      levels: levels.map((level) => {
        const extra = meta[level] ?? emptyMeta();
        return {
          nodeType: level,
          name: (names[level] ?? "").trim(),
          tags: [],
          attributes: extra.attributes
            .map((attribute) => [
              attribute.key.trim(),
              attribute.values
                .split(",")
                .map((value) => value.trim())
                .filter(Boolean),
            ])
            .filter(([key, values]) => key.length > 0 && values.length > 0) as [
            string,
            string[],
          ][],
          sources: extra.sources
            .map((source) => ({
              name: source.name.trim(),
              url: source.url.trim(),
            }))
            .filter(
              (source) => source.name.length > 0 || source.url.length > 0,
            ),
        };
      }),
    };
    onConfirm(chain);
  };

  return (
    <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col">
      <div className="min-w-0 space-y-3 border-b px-4 py-3">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
            start from
          </p>
          <div className="mt-1.5 flex flex-wrap gap-1">
            {(
              [
                ["new", "New graph"],
                ["curation", "Curation"],
                ["swarm", "Swarm"],
                ["location", "Location"],
              ] as [StartLevel, string][]
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => reset(value)}
                className={cn(
                  "border px-2 py-1 font-mono text-[10px] uppercase tracking-[0.06em]",
                  startLevel === value
                    ? "border-primary bg-accent text-foreground"
                    : "border-border text-muted-foreground hover:border-foreground",
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {startLevel !== "new" && !startNode && (
          <div className="space-y-1.5">
            <Input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={`Search ${typeNoun(startLevel)}s…`}
              className="h-8 font-mono text-xs"
            />
            <div className="max-h-40 min-w-0 overflow-x-hidden overflow-y-auto border">
              {loading ? (
                <div className="flex items-center gap-2 px-3 py-2 font-mono text-[11px] text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" /> Loading…
                </div>
              ) : startResults.length === 0 ? (
                <p className="px-3 py-2 font-mono text-[11px] text-muted-foreground">
                  No {typeNoun(startLevel)} found.
                </p>
              ) : (
                startResults.map((node) => (
                  <button
                    key={node.id}
                    type="button"
                    onClick={() => {
                      setStartNode(node);
                      setQuery("");
                    }}
                    className="flex w-full items-start gap-2 border-b px-3 py-1.5 text-left last:border-b-0 hover:bg-accent"
                  >
                    <span
                      className={cn(
                        "mt-1 h-1.5 w-1.5 shrink-0",
                        TYPE_DOT[node.type],
                      )}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-mono text-xs">
                        {node.name}
                      </span>
                      <span className="block truncate font-mono text-[10px] text-muted-foreground">
                        {node.path}
                      </span>
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>
        )}

        {startNode && (
          <div className="flex items-center gap-2 border px-2 py-1.5">
            <span
              className={cn("h-1.5 w-1.5 shrink-0", TYPE_DOT[startNode.type])}
            />
            <span className="min-w-0 flex-1">
              <span className="block truncate font-mono text-xs">
                {startNode.name}
              </span>
              <span className="block truncate font-mono text-[10px] text-muted-foreground">
                {formatNodeType(startNode.type)} · {startNode.graphName}
              </span>
            </span>
            <button
              type="button"
              onClick={() => setStartNode(null)}
              className="shrink-0 font-mono text-[10px] uppercase tracking-[0.06em] text-muted-foreground hover:text-foreground"
            >
              change
            </button>
          </div>
        )}
      </div>

      <div className="min-h-0 min-w-0 flex-1 space-y-3 overflow-y-auto px-4 py-3">
        <p className="break-words font-mono text-[11px] leading-relaxed text-muted-foreground">
          {previewParts.join(" › ")}
        </p>

        {levels.map((level) => {
          const error = nameError(names[level] ?? "");
          const extra = meta[level] ?? emptyMeta();
          const isOpen = openMeta[level] ?? false;
          return (
            <div key={level} className="space-y-1.5">
              <div className="flex items-baseline justify-between gap-2">
                <label
                  htmlFor={`chain-${level}`}
                  className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground"
                >
                  <span className={cn("h-1.5 w-1.5", TYPE_DOT[level])} />
                  new {typeNoun(level)}
                </label>
                <button
                  type="button"
                  onClick={() =>
                    setOpenMeta((current) => ({
                      ...current,
                      [level]: !isOpen,
                    }))
                  }
                  className="font-mono text-[10px] uppercase tracking-[0.06em] text-muted-foreground hover:text-foreground"
                >
                  {isOpen ? "hide metadata" : "metadata"}
                </button>
              </div>
              <Input
                id={`chain-${level}`}
                value={names[level] ?? ""}
                onChange={(e) => setLevelName(level, e.target.value)}
                placeholder={`Name the new ${typeNoun(level)}`}
                className="h-8 font-mono text-xs"
                maxLength={120}
              />
              {error && (names[level] ?? "").length > 0 && (
                <p className="font-mono text-[10px] text-destructive">
                  {error}
                </p>
              )}
              {isOpen && (
                <div className="space-y-3 border px-2 py-2">
                  <div className="space-y-1.5">
                    <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
                      attributes
                    </p>
                    {extra.attributes.map((attribute, index) => (
                      <div
                        // biome-ignore lint/suspicious/noArrayIndexKey: rows are editable and order is the identity
                        key={`${level}-attribute-${index}`}
                        className="flex items-center gap-1"
                      >
                        <Input
                          value={attribute.key}
                          onChange={(e) =>
                            patchMeta(level, (current) => ({
                              ...current,
                              attributes: current.attributes.map((row, i) =>
                                i === index
                                  ? { ...row, key: e.target.value }
                                  : row,
                              ),
                            }))
                          }
                          placeholder="key"
                          className="h-7 w-28 font-mono text-[11px]"
                        />
                        <Input
                          value={attribute.values}
                          onChange={(e) =>
                            patchMeta(level, (current) => ({
                              ...current,
                              attributes: current.attributes.map((row, i) =>
                                i === index
                                  ? { ...row, values: e.target.value }
                                  : row,
                              ),
                            }))
                          }
                          placeholder="value, value"
                          className="h-7 flex-1 font-mono text-[11px]"
                        />
                        <button
                          type="button"
                          aria-label="Remove attribute"
                          onClick={() =>
                            patchMeta(level, (current) => ({
                              ...current,
                              attributes: current.attributes.filter(
                                (_, i) => i !== index,
                              ),
                            }))
                          }
                          className="p-1 text-muted-foreground hover:text-foreground"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() =>
                        patchMeta(level, (current) => ({
                          ...current,
                          attributes: [
                            ...current.attributes,
                            { key: "", values: "" },
                          ],
                        }))
                      }
                      className="inline-flex items-center gap-1 font-mono text-[10px] text-muted-foreground hover:text-foreground"
                    >
                      <Plus className="h-3 w-3" /> attribute
                    </button>
                  </div>

                  <div className="space-y-1.5">
                    <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
                      sources
                    </p>
                    {extra.sources.map((source, index) => (
                      <div
                        // biome-ignore lint/suspicious/noArrayIndexKey: rows are editable and order is the identity
                        key={`${level}-source-${index}`}
                        className="flex items-center gap-1"
                      >
                        <Input
                          value={source.name}
                          onChange={(e) =>
                            patchMeta(level, (current) => ({
                              ...current,
                              sources: current.sources.map((row, i) =>
                                i === index
                                  ? { ...row, name: e.target.value }
                                  : row,
                              ),
                            }))
                          }
                          placeholder="name"
                          className="h-7 w-24 font-mono text-[11px]"
                        />
                        <Input
                          value={source.url}
                          onChange={(e) =>
                            patchMeta(level, (current) => ({
                              ...current,
                              sources: current.sources.map((row, i) =>
                                i === index
                                  ? { ...row, url: e.target.value }
                                  : row,
                              ),
                            }))
                          }
                          placeholder="https://…"
                          className="h-7 flex-1 font-mono text-[11px]"
                        />
                        <button
                          type="button"
                          aria-label="Remove source"
                          onClick={() =>
                            patchMeta(level, (current) => ({
                              ...current,
                              sources: current.sources.filter(
                                (_, i) => i !== index,
                              ),
                            }))
                          }
                          className="p-1 text-muted-foreground hover:text-foreground"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() =>
                        patchMeta(level, (current) => ({
                          ...current,
                          sources: [...current.sources, { name: "", url: "" }],
                        }))
                      }
                      className="inline-flex items-center gap-1 font-mono text-[10px] text-muted-foreground hover:text-foreground"
                    >
                      <Plus className="h-3 w-3" /> source
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {duplicateCuration && (
          <p className="font-mono text-[11px] leading-relaxed text-destructive">
            A curation named “{(names.curation ?? "").trim()}” already exists.
            Choose another name.
          </p>
        )}

        {startLevel !== "new" && !startNode && (
          <p className="font-mono text-[10px] text-muted-foreground">
            Pick the existing {startLevel} this chain should grow from.
          </p>
        )}
      </div>

      <div className="flex min-w-0 items-center justify-between gap-2 border-t px-4 py-3">
        <Badge variant="outline" className="font-mono text-[10px]">
          {(cost / 10).toFixed(1)} BUZZ · {levels.length + 1} new nodes
        </Badge>
        <Button
          type="button"
          size="sm"
          onClick={submit}
          disabled={!valid}
          className="h-8 rounded-none px-3 font-mono text-[11px]"
        >
          Use this chain
        </Button>
      </div>
    </div>
  );
}
