import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { getRouteApi } from "@tanstack/react-router";
import { Link2, Loader2 } from "lucide-react";
import { useHyvmindGraphs, useHyvmindNodes } from "../hooks/useHyvmind";
import { usePostsByGraphNode } from "../hooks/useQueries";
import { formatNodeType } from "../utils/formatting";
import { BackButton } from "./BackButton";
import { PostCard } from "./PostCard";

const routeApi = getRouteApi("/node/$graphId");

export function NodePage() {
  const { graphId } = routeApi.useParams();
  const { node: nodeId } = routeApi.useSearch();

  const graphs = useHyvmindGraphs();
  const nodes = useHyvmindNodes(graphId);
  const posts = usePostsByGraphNode(graphId, nodeId);

  const graph = graphs.data?.find((g) => g.id === graphId);
  const node = (nodes.data ?? []).find((n) => n.id === nodeId);
  const pages = posts.data?.pages ?? [];
  const first = pages[0];
  const all = pages.flatMap((p) => p.posts);

  return (
    <div className="pb-16">
      <div className="sticky top-0 z-10 flex items-center gap-3 border-b bg-background/95 px-4 py-2 backdrop-blur">
        <BackButton />
        <div className="min-w-0">
          <p className="truncate font-mono text-[13px] font-medium">
            {node?.name ?? "Node"}
          </p>
          <p className="truncate font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            {graph?.name ?? "hyvmind.app"}
          </p>
        </div>
      </div>

      <div className="border-b px-4 py-4">
        {nodes.isLoading || graphs.isLoading ? (
          <Skeleton className="h-16 w-full" />
        ) : nodes.isError ? (
          <p className="font-mono text-xs text-muted-foreground">
            Couldn't reach hyvmind.app for this node.
          </p>
        ) : !node ? (
          <p className="font-mono text-xs text-muted-foreground">
            This node is no longer in the published graph.
          </p>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              <Link2 className="h-3 w-3" />
              <span>{formatNodeType(node.type)}</span>
              <span>·</span>
              <span>xyz weight {(first?.nodeWeight ?? 0n).toString()}</span>
              <span>·</span>
              <span>{first?.tokenCount?.toString() ?? "0"} tokens</span>
            </div>
            <p className="font-mono text-[11px] leading-relaxed text-muted-foreground">
              {node.path}
            </p>
            {node.content && (
              <p className="whitespace-pre-wrap font-sans text-[14px] leading-relaxed">
                {node.content}
              </p>
            )}
            {node.sources && node.sources.length > 0 && (
              <ul className="space-y-1">
                {node.sources.map((s) => (
                  <li
                    key={`${s.name}-${s.url}`}
                    className="truncate font-mono text-[11px]"
                  >
                    <a
                      href={s.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline underline-offset-2"
                    >
                      {s.name}
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      {posts.isLoading && (
        <div className="space-y-4 p-4">
          {Array.from({ length: 3 }).map((_, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: stable skeleton list
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      )}

      {!posts.isLoading && all.length === 0 && (
        <p className="px-4 py-10 text-center font-mono text-xs text-muted-foreground">
          No contributions to this node yet.
        </p>
      )}

      {all.map((post) => (
        <PostCard key={post.id.toString()} post={post} />
      ))}

      {posts.hasNextPage && (
        <div className={cn("flex justify-center px-4 py-4")}>
          <Button
            variant="outline"
            size="sm"
            className="font-mono text-[11px]"
            onClick={() => posts.fetchNextPage()}
            disabled={posts.isFetchingNextPage}
          >
            {posts.isFetchingNextPage && (
              <Loader2 className="mr-2 h-3 w-3 animate-spin" />
            )}
            Load more
          </Button>
        </div>
      )}
    </div>
  );
}
