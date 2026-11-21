import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "@tanstack/react-router";
import type { TrendingHashtag } from "../backend";

interface TrendingListProps {
  trending: TrendingHashtag[] | undefined;
  isLoading: boolean;
  isError: boolean;
}

export function TrendingList({
  trending,
  isLoading,
  isError,
}: TrendingListProps) {
  if (isLoading) {
    return (
      <div>
        {Array.from({ length: 5 }).map((_, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: stable list
          <div key={i} className="border-b border-border px-3 py-3">
            <Skeleton className="mb-1 h-3 w-16" />
            <Skeleton className="mb-1 h-3.5 w-24" />
            <Skeleton className="h-3 w-14" />
          </div>
        ))}
      </div>
    );
  }

  if (isError || !trending || trending.length === 0) {
    return (
      <p className="px-3 py-3 text-[11px] text-muted-foreground">
        No trending topics yet
      </p>
    );
  }

  return (
    <>
      <div>
        {trending.map((item) => (
          <Link
            key={item.tag}
            to="/hashtag/$tag"
            params={{ tag: item.tag }}
            className="block border-b border-border px-3 py-2.5 transition-colors hover:bg-accent"
          >
            <span className="text-[10px] tracking-[0.08em] text-muted-foreground">
              topic
            </span>
            <p className="text-[13px] text-foreground">#{item.tag}</p>
            <span className="text-[10px] tabular-nums text-muted-foreground">
              {item.count.toString()} posts
            </span>
          </Link>
        ))}
      </div>

      <Link
        to="/search"
        search={{ q: "" }}
        className="block px-3 py-2.5 text-[11px] text-primary transition-colors hover:bg-accent"
      >
        Show more
      </Link>
    </>
  );
}
