import { useEffect, useRef } from "react";

interface GraphFiltersProps {
  searchText: string;
  onSearchChange: (text: string) => void;
  visibleNodeTypes: Set<string>;
  onNodeTypesChange: (types: Set<string>) => void;
  attributeFilterText: string;
  onAttributeFilterChange: (text: string) => void;
  totalNodes: number;
  visibleNodes: number;
  onReset: () => void;
  onFitToVisible: () => void;
  isCollapsed: boolean;
  onToggleCollapsed: () => void;
}

const NODE_TYPES: { key: string; label: string; color: string }[] = [
  { key: "curation", label: "curation", color: "#4a9eff" },
  { key: "swarm", label: "swarm", color: "#ff7f50" },
  { key: "location", label: "location", color: "#90EE90" },
  { key: "lawEntity", label: "law token", color: "#FFD700" },
  { key: "interpEntity", label: "interp token", color: "#DA70D6" },
];

function NodeTypeCheckbox({
  nodeKey,
  label,
  color,
  checked,
  onChange,
}: {
  nodeKey: string;
  label: string;
  color: string;
  checked: boolean;
  onChange: (key: string) => void;
}) {
  const inputId = `curation-filter-${nodeKey}`;
  return (
    <div className="group flex cursor-pointer items-center gap-2">
      <div
        className="relative flex h-3 w-3 shrink-0 items-center justify-center border border-dashed transition-colors"
        style={{
          borderColor: checked ? color : "var(--border)",
          background: checked ? `${color}22` : "transparent",
        }}
      >
        {checked && (
          <span className="block h-1.5 w-1.5" style={{ background: color }} />
        )}
        <input
          id={inputId}
          type="checkbox"
          checked={checked}
          onChange={() => onChange(nodeKey)}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          aria-label={`Show ${label} nodes`}
        />
      </div>
      <label
        htmlFor={inputId}
        className="cursor-pointer text-xs text-muted-foreground transition-colors group-hover:text-foreground"
      >
        {label}
      </label>
    </div>
  );
}

/** The app's filter rail: search, attribute filter, node types, fit, reset. */
export function GraphFilters({
  searchText,
  onSearchChange,
  visibleNodeTypes,
  onNodeTypesChange,
  attributeFilterText,
  onAttributeFilterChange,
  totalNodes,
  visibleNodes,
  onReset,
  onFitToVisible,
  isCollapsed,
  onToggleCollapsed,
}: GraphFiltersProps) {
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isCollapsed) return;
    const timer = setTimeout(() => searchInputRef.current?.focus(), 150);
    return () => clearTimeout(timer);
  }, [isCollapsed]);

  const toggleNodeType = (key: string) => {
    const next = new Set(visibleNodeTypes);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    onNodeTypesChange(next);
  };

  const isFiltered =
    searchText.trim().length > 0 ||
    visibleNodeTypes.size < NODE_TYPES.length ||
    attributeFilterText.trim().length > 0;

  return (
    <div className="flex shrink-0 font-mono" style={{ zIndex: 10 }}>
      <button
        type="button"
        onClick={onToggleCollapsed}
        className="flex shrink-0 flex-col items-center justify-start border-t border-b border-l border-dashed border-border bg-background px-1.5 pt-3 text-muted-foreground transition-colors hover:border-foreground hover:text-foreground"
        style={{ writingMode: "vertical-rl", gap: "6px" }}
        aria-label={
          isCollapsed ? "Expand filter panel" : "Collapse filter panel"
        }
      >
        <span className="select-none text-xs uppercase tracking-widest">
          {isCollapsed ? "▶ filter" : "◀ filter"}
        </span>
        {isFiltered && (
          <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-foreground" />
        )}
      </button>

      <div
        className="overflow-hidden transition-all duration-200 ease-in-out"
        style={{ width: isCollapsed ? 0 : 200, opacity: isCollapsed ? 0 : 1 }}
      >
        <div className="flex h-full w-[200px] flex-col border-t border-b border-l border-dashed border-border bg-background">
          <div className="shrink-0 border-b border-dashed border-border px-3 pt-3 pb-2">
            <span className="mb-1.5 block text-xs uppercase tracking-widest text-muted-foreground">
              search
            </span>
            <input
              ref={searchInputRef}
              type="text"
              value={searchText}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder="filter by name..."
              className="w-full border border-dashed border-input bg-transparent px-2 py-1 text-xs text-foreground outline-none transition-colors placeholder:text-muted-foreground/50 focus:border-foreground"
              aria-label="Filter nodes by name"
            />
          </div>

          <div className="shrink-0 border-b border-dashed border-border px-3 pt-2 pb-2">
            <span className="mb-1.5 block text-xs uppercase tracking-widest text-muted-foreground">
              attributes
            </span>
            <input
              type="text"
              value={attributeFilterText}
              onChange={(event) => onAttributeFilterChange(event.target.value)}
              placeholder="key: value"
              className="w-full border border-dashed border-input bg-transparent px-2 py-1 text-xs text-foreground outline-none transition-colors placeholder:text-muted-foreground/50 focus:border-foreground"
              aria-label="Filter nodes by attribute key or key:value"
            />
          </div>

          <div className="shrink-0 border-b border-dashed border-border px-3 pt-2 pb-2">
            <span className="mb-2 block text-xs uppercase tracking-widest text-muted-foreground">
              node types
            </span>
            <div className="flex flex-col gap-1.5">
              {NODE_TYPES.map((type) => (
                <NodeTypeCheckbox
                  key={type.key}
                  nodeKey={type.key}
                  label={type.label}
                  color={type.color}
                  checked={visibleNodeTypes.has(type.key)}
                  onChange={toggleNodeType}
                />
              ))}
            </div>
          </div>

          <div className="shrink-0 border-b border-dashed border-border px-3 py-2">
            <span className="text-xs text-muted-foreground">
              showing{" "}
              <span className="font-semibold text-foreground">
                {visibleNodes}
              </span>{" "}
              of{" "}
              <span className="font-semibold text-foreground">
                {totalNodes}
              </span>{" "}
              nodes
            </span>
          </div>

          <div className="flex shrink-0 flex-col gap-1.5 px-3 py-2">
            <button
              type="button"
              onClick={onFitToVisible}
              className="w-full border border-dashed border-border px-2 py-1 text-left text-xs text-foreground transition-colors hover:border-foreground hover:bg-accent hover:text-accent-foreground"
            >
              fit to visible
            </button>
            <button
              type="button"
              onClick={onReset}
              disabled={!isFiltered}
              className="w-full border border-dashed border-border px-2 py-1 text-left text-xs text-muted-foreground transition-colors hover:border-foreground hover:bg-accent hover:text-accent-foreground disabled:cursor-not-allowed disabled:opacity-30"
            >
              reset filters
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
