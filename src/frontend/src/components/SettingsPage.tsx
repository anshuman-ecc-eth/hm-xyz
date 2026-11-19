import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useInternetIdentity } from "@caffeineai/core-infrastructure";
import { formatDistanceToNow } from "date-fns";
import { Check, Copy, Link2, Loader2, Unlink } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import {
  useConfirmAppLink,
  useMyAppLink,
  useReconcileAppLink,
  useResolveAppLinkCode,
  useUnlinkAppAccount,
} from "../hooks/useQueries";
import { fromNanoseconds } from "../utils/formatting";

function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        await navigator.clipboard.writeText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      aria-label={label}
      className="flex shrink-0 items-center gap-1 bg-muted px-2 py-1 text-[10px] text-muted-foreground transition-colors hover:text-foreground"
    >
      {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
      {copied ? "copied" : "copy"}
    </button>
  );
}

export function SettingsPage() {
  const { identity } = useInternetIdentity();
  const principal = identity?.getPrincipal().toText() ?? "";
  const link = useMyAppLink();

  const [code, setCode] = useState("");
  const [preview, setPreview] = useState<{
    appPrincipal: string;
    displayName?: string;
    expiresAt: bigint;
  } | null>(null);

  const resolve = useResolveAppLinkCode();
  const confirm = useConfirmAppLink();
  const unlink = useUnlinkAppAccount();
  const reconcile = useReconcileAppLink();

  const linked = link.data ?? null;

  const handleResolve = () => {
    const trimmed = code.trim();
    if (!trimmed) return;
    resolve.mutate(trimmed, {
      onSuccess: (res) => {
        if (res.__kind__ === "ok") {
          setPreview({
            appPrincipal: res.ok.appPrincipal.toText(),
            displayName: res.ok.displayName,
            expiresAt: res.ok.expiresAt,
          });
        } else {
          // The app returns null for unknown, expired and already-used codes.
          // Ask it whether we are in fact linked before reporting an error.
          reconcile.mutate(undefined, {
            onSuccess: (r) => {
              if (r.__kind__ === "ok" && r.ok) {
                setPreview(null);
                setCode("");
                toast.success("Accounts are already linked");
              } else {
                toast.error(res.err);
              }
            },
            onError: () => toast.error(res.err),
          });
        }
      },
      onError: () => toast.error("Could not reach hyvmind.app"),
    });
  };

  const handleConfirm = () => {
    confirm.mutate(code.trim(), {
      onSuccess: (res) => {
        if (res.__kind__ === "ok") {
          setPreview(null);
          setCode("");
          toast.success("Accounts linked");
        } else {
          toast.error(res.err);
        }
      },
      onError: () => toast.error("Could not reach hyvmind.app"),
    });
  };

  const handleUnlink = () => {
    unlink.mutate(undefined, {
      onSuccess: (res) => {
        if (res.__kind__ === "ok") {
          toast.success("Account unlinked");
        } else {
          toast.error(res.err);
        }
      },
      onError: () => toast.error("Unlink failed, try again"),
    });
  };

  const minutesLeft =
    preview != null
      ? Math.max(
          0,
          Math.round((Number(preview.expiresAt) / 1e6 - Date.now()) / 60_000),
        )
      : 0;

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 font-mono">
      <h1 className="text-[13px] uppercase tracking-[0.14em] text-muted-foreground">
        Settings
      </h1>

      <section className="mt-6">
        <h2 className="text-[12px] uppercase tracking-[0.12em] text-muted-foreground">
          Your xyz principal
        </h2>
        <p className="mt-1 text-[11px] text-muted-foreground">
          This is your identity on hyvmind.xyz. It is what the app links to.
        </p>
        <div className="mt-2 flex items-center gap-2">
          <code className="min-w-0 flex-1 truncate border px-2 py-1.5 text-[11px]">
            {principal || "—"}
          </code>
          {principal && <CopyButton value={principal} label="Copy principal" />}
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-[12px] uppercase tracking-[0.12em] text-muted-foreground">
          Linked accounts
        </h2>

        {link.isLoading ? (
          <div className="mt-3 flex items-center gap-2 text-[11px] text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading…
          </div>
        ) : linked ? (
          <div className="mt-3 border">
            <div className="flex items-center gap-2 border-b px-3 py-2">
              <Link2 className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-[11px] font-medium">
                Linked to hyvmind.app
              </span>
            </div>
            <div className="space-y-2 px-3 py-3">
              <div className="flex items-baseline gap-2">
                <span className="w-24 shrink-0 text-[10px] uppercase tracking-wider text-muted-foreground">
                  account
                </span>
                <span className="min-w-0 flex-1 truncate text-[12px]">
                  {linked.displayName ?? "unnamed"}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-24 shrink-0 text-[10px] uppercase tracking-wider text-muted-foreground">
                  principal
                </span>
                <code className="min-w-0 flex-1 truncate text-[11px]">
                  {linked.appPrincipal.toText()}
                </code>
                <CopyButton
                  value={linked.appPrincipal.toText()}
                  label="Copy app principal"
                />
              </div>
              <div className="flex items-baseline gap-2">
                <span className="w-24 shrink-0 text-[10px] uppercase tracking-wider text-muted-foreground">
                  since
                </span>
                <span className="text-[11px]">
                  {formatDistanceToNow(fromNanoseconds(linked.linkedAt), {
                    addSuffix: true,
                  })}
                </span>
              </div>
            </div>
            <div className="flex items-center justify-between border-t px-3 py-2">
              <p className="text-[10px] text-muted-foreground">
                Contributions are attributed to this account.
              </p>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 gap-1.5 rounded-none px-2 text-[10px]"
                    disabled={unlink.isPending}
                  >
                    {unlink.isPending ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Unlink className="h-3 w-3" />
                    )}
                    Unlink
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Unlink this account?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Content you already created stays in the graph. Future
                      contributions will no longer be attributed to this
                      account.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleUnlink}>
                      Unlink
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        ) : preview ? (
          <div className="mt-3 border">
            <p className="border-b px-3 py-2 text-[11px] text-muted-foreground">
              Link this hyvmind.app account?
            </p>
            <div className="space-y-1 px-3 py-3">
              <p className="text-[13px] font-medium">
                {preview.displayName ?? "unnamed account"}
              </p>
              <code className="block truncate text-[11px] text-muted-foreground">
                {preview.appPrincipal}
              </code>
              <p className="pt-1 text-[10px] text-muted-foreground">
                {minutesLeft > 0
                  ? `Code expires in about ${minutesLeft} minute${minutesLeft === 1 ? "" : "s"}.`
                  : "This code may have expired. The app decides, so trying is harmless."}
              </p>
            </div>
            <div className="flex justify-end gap-2 border-t px-3 py-2">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 rounded-none px-2 text-[10px]"
                onClick={() => setPreview(null)}
                disabled={confirm.isPending}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                className="h-7 gap-1.5 rounded-none px-2 text-[10px]"
                onClick={handleConfirm}
                disabled={confirm.isPending}
              >
                {confirm.isPending && (
                  <Loader2 className="h-3 w-3 animate-spin" />
                )}
                Link accounts
              </Button>
            </div>
          </div>
        ) : (
          <>
            <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
              Connect your hyvmind.app account so contributions are attributed
              to the same person in both places. Generate a code in the app
              under Settings → Linked accounts, then paste it here.
            </p>
            <div className="mt-2 flex gap-2">
              <Input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleResolve();
                  }
                }}
                placeholder="xxxx-xxxx-xxxx-xxxx"
                className={cn("font-mono text-[12px]")}
                disabled={resolve.isPending}
              />
              <Button
                size="sm"
                className="h-9 shrink-0 rounded-none px-3 text-[11px]"
                onClick={handleResolve}
                disabled={resolve.isPending || code.trim().length === 0}
              >
                {resolve.isPending && (
                  <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
                )}
                Continue
              </Button>
            </div>
            <p className="mt-2 text-[10px] text-muted-foreground">
              Codes are single use and expire after 10 minutes. They are never
              stored or logged.
            </p>
          </>
        )}
      </section>
    </div>
  );
}
