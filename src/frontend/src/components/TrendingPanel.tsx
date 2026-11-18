import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Link, useRouter } from "@tanstack/react-router";
import { Search } from "lucide-react";
import type React from "react";
import { useState } from "react";
import { useTrendingHashtags } from "../hooks/useQueries";

export function TrendingPanel() {
  const { data: trending, isLoading, isError } = useTrendingHashtags();
  const [searchValue, setSearchValue] = useState("");
  const router = useRouter();

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = searchValue.trim();
    if (!trimmed) return;
    router.navigate({ to: "/search", search: { q: trimmed } });
    setSearchValue("");
  };

  return (
    <aside className="sticky top-0 hidden h-screen w-80 shrink-0 overflow-y-auto font-mono lg:block">
      <form
        onSubmit={handleSearchSubmit}
        className="border-b border-border p-3"
      >
        <div className="relative">
          <Search
            className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
            strokeWidth={1.5}
          />
          <Input
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            placeholder="Search"
            className="h-9 rounded-none border-border bg-background pl-8 text-[12px] focus-visible:ring-0 focus-visible:border-foreground"
          />
        </div>
      </form>

      <div className="flex items-baseline justify-between border-b border-border px-3 py-2.5 text-[10px] tracking-[0.08em] text-muted-foreground">
        <span>trending</span>
        <span className="tabular-nums">
          {trending ? String(trending.length).padStart(2, "0") : "…"}
        </span>
      </div>

      {isLoading ? (
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
      ) : isError || !trending || trending.length === 0 ? (
        <p className="px-3 py-3 text-[11px] text-muted-foreground">
          No trending topics yet
        </p>
      ) : (
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
      )}

      <Link
        to="/search"
        search={{ q: "" }}
        className="block px-3 py-2.5 text-[11px] text-primary transition-colors hover:bg-accent"
      >
        Show more
      </Link>
    </aside>
  );
}
