import { ThemeProvider } from "next-themes";
import { CurationPage } from "./CurationPage";

interface CurationRootProps {
  slug: string;
  pinnedGraphId?: string | null;
  focusNodeId?: string | null;
}

/**
 * Entry point for `/curations/<slug>`. It deliberately does not mount the app
 * shell or the router: the page is public and the app's routes sit behind the
 * identity gate. A shared link therefore works signed out.
 */
export function CurationRoot({
  slug,
  pinnedGraphId,
  focusNodeId,
}: CurationRootProps) {
  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
      <CurationPage
        slug={slug}
        pinnedGraphId={pinnedGraphId}
        focusNodeId={focusNodeId}
      />
    </ThemeProvider>
  );
}

export default CurationRoot;
