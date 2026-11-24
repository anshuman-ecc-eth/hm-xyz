import { cn } from "@/lib/utils";
import { Check, Share2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { postShareUrl } from "../lib/posts";

interface SharePostButtonProps {
  postId: bigint | string | number;
  /** Feeds use the action-row size; the post page uses the larger one. */
  size?: "sm" | "lg";
  className?: string;
}

/**
 * Copies the post's public URL (`/post/<id>`). The icon swaps to a check for a
 * moment, matching the existing principal/node-id copy buttons.
 */
export function SharePostButton({
  postId,
  size = "sm",
  className,
}: SharePostButtonProps) {
  const [copied, setCopied] = useState(false);
  const timeoutRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current);
    };
  }, []);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(postShareUrl(postId));
      setCopied(true);
      if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current);
      timeoutRef.current = window.setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Couldn't copy the link");
    }
  };

  const Icon = copied ? Check : Share2;

  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        void copy();
      }}
      onKeyDown={(event) => event.stopPropagation()}
      aria-label={copied ? "Link copied" : "Copy link to post"}
      title={copied ? "Link copied" : "Copy link to post"}
      className={cn(
        "flex items-center gap-1 text-muted-foreground transition-colors hover:text-primary",
        className,
      )}
    >
      <Icon className={size === "lg" ? "h-5 w-5" : "h-4 w-4"} />
      <span className="sr-only" aria-live="polite">
        {copied ? "Link copied" : ""}
      </span>
    </button>
  );
}
