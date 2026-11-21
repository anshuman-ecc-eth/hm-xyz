import { cn } from "@/lib/utils";

export const EDIT_DELETE_WINDOW_MS = 15 * 60 * 1000;

export const TAB_TRIGGER_CLASS = cn(
  "relative flex-1 h-auto rounded-none border-0 bg-transparent px-4 py-2.5 font-mono text-[11px] tracking-[0.08em] text-muted-foreground shadow-none transition-colors",
  "hover:bg-accent hover:text-foreground",
  "focus-visible:ring-0 focus-visible:outline-none",
  "data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:font-medium data-[state=active]:shadow-none",
  "after:absolute after:bottom-0 after:left-0 after:right-0 after:h-px after:bg-foreground after:opacity-0 after:transition-opacity",
  "data-[state=active]:after:opacity-100",
);
