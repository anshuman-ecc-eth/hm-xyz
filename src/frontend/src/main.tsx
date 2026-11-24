import { InternetIdentityProvider } from "@caffeineai/core-infrastructure";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { Suspense, lazy } from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { parseCurationSlug } from "./lib/curations";
import { parsePostSegment } from "./lib/posts";
import "./index.css";

// force-graph is only needed on a curation page, so it stays out of the feed's
// bundle and loads on demand.
const CurationRoot = lazy(() => import("./components/curation/CurationRoot"));
const PublicPostRoot = lazy(() => import("./components/post/PublicPostRoot"));

BigInt.prototype.toJSON = function () {
  return this.toString();
};

declare global {
  interface BigInt {
    toJSON(): string;
  }
}

const queryClient = new QueryClient();

// Warm the mono face while Internet Identity initialises. The landing hero
// measures its highlight only after this face is loaded (see LandingPage), and
// starting the download here hides the font-swap nudge on a cold cache. A
// failed load is fine: the UI simply keeps the system mono.
if (document.fonts) {
  void document.fonts
    .load('400 16px "Geist Mono"', "own your interpretations")
    .catch(() => {});
}

const slug = parseCurationSlug(window.location.pathname);
const curationParams = new URLSearchParams(window.location.search);
const curation = slug
  ? {
      slug,
      pinnedGraphId: curationParams.get("graph"),
      focusNodeId: curationParams.get("node"),
    }
  : null;
const postId = parsePostSegment(window.location.pathname);

const publicFallback = (
  <div className="flex h-[100dvh] items-center justify-center bg-background">
    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
  </div>
);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <InternetIdentityProvider>
    <QueryClientProvider client={queryClient}>
      {curation ? (
        <Suspense fallback={publicFallback}>
          <CurationRoot {...curation} />
        </Suspense>
      ) : postId ? (
        <Suspense fallback={publicFallback}>
          <PublicPostRoot postId={postId} />
        </Suspense>
      ) : (
        <App />
      )}
    </QueryClientProvider>
  </InternetIdentityProvider>,
);
