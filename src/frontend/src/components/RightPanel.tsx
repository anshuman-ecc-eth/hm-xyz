import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useRouter } from "@tanstack/react-router";
import { Search } from "lucide-react";
import type React from "react";
import { useState } from "react";
import { useGraphActivity } from "../hooks/useGraphActivity";
import { useTrendingHashtags } from "../hooks/useQueries";
import { TAB_TRIGGER_CLASS } from "../utils/constants";
import { GraphActivityFeed } from "./GraphActivityFeed";
import { TrendingList } from "./TrendingList";

const pad = (value: number) => String(value).padStart(2, "0");

export function RightPanel() {
  const trending = useTrendingHashtags();
  const activity = useGraphActivity();
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
    <aside className="sticky top-0 hidden h-screen w-80 shrink-0 flex-col font-mono lg:flex">
      <form
        onSubmit={handleSearchSubmit}
        className="shrink-0 border-b border-border p-3"
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

      <Tabs
        defaultValue="trending"
        className="flex min-h-0 flex-1 flex-col gap-0"
      >
        <TabsList className="h-auto w-full shrink-0 justify-start gap-px rounded-none border-b border-border bg-background p-0">
          <TabsTrigger value="trending" className={TAB_TRIGGER_CLASS}>
            <span className="flex w-full items-baseline justify-between">
              <span>trending</span>
              <span className="tabular-nums">
                {trending.data ? pad(trending.data.length) : "…"}
              </span>
            </span>
          </TabsTrigger>
          <TabsTrigger value="activity" className={TAB_TRIGGER_CLASS}>
            <span className="flex w-full items-baseline justify-between">
              <span>activity</span>
              <span className="tabular-nums">
                {activity.isLoading ? "…" : pad(activity.events.length)}
              </span>
            </span>
          </TabsTrigger>
        </TabsList>

        <TabsContent
          value="trending"
          className="mt-0 min-h-0 flex-1 overflow-y-auto"
        >
          <TrendingList
            trending={trending.data}
            isLoading={trending.isLoading}
            isError={trending.isError}
          />
        </TabsContent>

        <TabsContent
          value="activity"
          className="mt-0 min-h-0 flex-1 overflow-hidden"
        >
          <GraphActivityFeed activity={activity} />
        </TabsContent>
      </Tabs>
    </aside>
  );
}
