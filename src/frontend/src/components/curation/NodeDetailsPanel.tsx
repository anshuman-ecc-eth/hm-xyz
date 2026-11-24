import { ArrowUpRight } from "lucide-react";
import type { SourceNode } from "../../lib/graphView";

const NODE_TYPE_LABELS: Record<string, string> = {
  curation: "CURATION",
  swarm: "SWARM",
  location: "LOCATION",
  lawEntity: "LAW TOKEN",
  interpEntity: "INTERPRETATION TOKEN",
};

interface NodeDetailsPanelProps {
  node: SourceNode;
  onClose: () => void;
  /** The contributions page, shown only when the viewer can open it. */
  contributionsHref?: string | null;
}

/** The app's node panel: type, path, content, attributes and sources. */
export function NodeDetailsPanel({
  node,
  onClose,
  contributionsHref,
}: NodeDetailsPanelProps) {
  const typeLabel =
    NODE_TYPE_LABELS[node.nodeType] ?? node.nodeType.toUpperCase();
  const attrs = node.attributes
    ? Object.entries(node.attributes).filter(([, value]) => value !== "")
    : [];
  const tags =
    node.tags && node.tags.length > 0
      ? node.tags
      : node.attributes?.tags
        ? [node.attributes.tags]
        : null;
  const content = node.content?.trim();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm">
      <dialog
        open
        className="relative m-0 w-full max-w-md border border-border bg-card p-0 font-mono text-foreground shadow-lg"
        aria-label="Node details"
      >
        <div className="flex items-center justify-between border-b border-border bg-secondary px-4 py-2">
          <span className="text-xs uppercase tracking-widest text-muted-foreground">
            NODE_DETAILS
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
            aria-label="Close node details"
          >
            [X]
          </button>
        </div>

        <div className="max-h-[70vh] space-y-3 overflow-y-auto p-4 text-xs">
          <div>
            <span className="text-xs uppercase tracking-widest text-muted-foreground">
              NAME
            </span>
            <p className="mt-0.5 break-words text-foreground">{node.name}</p>
          </div>

          <div>
            <span className="text-xs uppercase tracking-widest text-muted-foreground">
              TYPE
            </span>
            <p className="mt-0.5 text-foreground">{typeLabel}</p>
          </div>

          <div>
            <span className="text-xs uppercase tracking-widest text-muted-foreground">
              ID
            </span>
            <p className="mt-0.5 break-all text-foreground/70">{node.id}</p>
          </div>

          {node.parentName && (
            <div>
              <span className="text-xs uppercase tracking-widest text-muted-foreground">
                PARENT
              </span>
              <p className="mt-0.5 break-words text-foreground">
                {node.parentName}
              </p>
            </div>
          )}

          {tags && (
            <div>
              <span className="text-xs uppercase tracking-widest text-muted-foreground">
                TAGS
              </span>
              <div className="mt-0.5 flex flex-wrap gap-1">
                {tags.map((tag) => (
                  <span
                    key={tag}
                    className="border border-border px-1.5 py-0.5 text-xs text-muted-foreground"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {content && (
            <div>
              <span className="text-xs uppercase tracking-widest text-muted-foreground">
                CONTENT
              </span>
              <p className="mt-0.5 whitespace-pre-wrap break-words text-foreground/80">
                {content}
              </p>
            </div>
          )}

          <div>
            <span className="text-xs uppercase tracking-widest text-muted-foreground">
              ATTRIBUTES
            </span>
            {attrs.length === 0 ? (
              <p className="mt-0.5 text-muted-foreground italic">
                No attributes
              </p>
            ) : (
              <div className="mt-1 divide-y divide-border border border-border">
                {attrs.map(([key, value]) => (
                  <div key={key} className="flex gap-2 px-2 py-1">
                    <span className="min-w-0 shrink-0 break-words text-muted-foreground">
                      {key}
                    </span>
                    <span className="ml-auto break-words text-right text-foreground/80">
                      {value}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {node.sources !== undefined && (
            <div>
              <span className="text-xs uppercase tracking-widest text-muted-foreground">
                SOURCES
              </span>
              {node.sources.length === 0 ? (
                <p className="mt-0.5 text-muted-foreground italic">
                  No sources
                </p>
              ) : (
                <div className="mt-1 space-y-1">
                  {node.sources.map((source) => (
                    <div
                      key={`${source.name}-${source.url}`}
                      className="break-words text-xs"
                    >
                      {source.url ? (
                        <a
                          href={source.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-foreground/80 underline transition-colors hover:text-foreground"
                        >
                          {source.name}
                        </a>
                      ) : (
                        <span className="text-foreground/80">
                          {source.name}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-border px-4 py-2">
          {contributionsHref ? (
            <a
              href={contributionsHref}
              className="inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              contributions
              <ArrowUpRight className="h-3 w-3" />
            </a>
          ) : (
            <span />
          )}
          <button
            type="button"
            onClick={onClose}
            className="border border-border px-3 py-1 text-xs text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            CLOSE
          </button>
        </div>
      </dialog>
    </div>
  );
}
