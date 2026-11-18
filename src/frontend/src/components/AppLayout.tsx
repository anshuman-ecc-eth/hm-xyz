import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { useRouterState } from "@tanstack/react-router";
import { Menu } from "lucide-react";
import { useState } from "react";
import type { ReactNode } from "react";
import { AppSidebar } from "./AppSidebar";
import { TrendingPanel } from "./TrendingPanel";

function getPageTitle(pathname: string): string {
  if (pathname === "/") return "home";
  if (pathname.startsWith("/search")) return "search";
  if (pathname.startsWith("/hashtag/")) return "search";
  if (pathname.startsWith("/notifications")) return "notifications";
  if (pathname.startsWith("/post/")) return "post";
  return "profile";
}

export function AppLayout({ children }: { children: ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const routerState = useRouterState();
  const title = getPageTitle(routerState.location.pathname);

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <aside className="sticky top-0 hidden h-screen w-56 shrink-0 flex-col border-r border-border md:flex">
        <AppSidebar />
      </aside>

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-56 border-r border-border p-0">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <AppSidebar onNavigate={() => setMobileOpen(false)} />
        </SheetContent>
      </Sheet>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-12 shrink-0 items-center gap-3 border-b border-border px-3 md:hidden">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="-ml-1 flex h-8 w-8 items-center justify-center text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ring"
            aria-label="Open menu"
          >
            <Menu className="h-4 w-4" strokeWidth={1.5} />
          </button>
          <span className="font-mono text-[11px] tracking-[0.08em] text-muted-foreground">
            {title}
          </span>
        </header>

        <div className="flex flex-1">
          <main className="min-w-0 flex-1 border-r border-border">
            {children}
          </main>
          <TrendingPanel />
        </div>
      </div>
    </div>
  );
}
