import { InternetIdentityProvider } from "@caffeineai/core-infrastructure";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

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

ReactDOM.createRoot(document.getElementById("root")!).render(
  <InternetIdentityProvider>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </InternetIdentityProvider>,
);
