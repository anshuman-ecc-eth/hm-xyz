import { ThemeProvider } from "next-themes";
import { PublicPostPage } from "./PublicPostPage";

interface PublicPostRootProps {
  postId: string;
}

/**
 * Entry point for `/post/<id>`. The app's router is hash-based and gated behind
 * sign-in; this page is deliberately outside it.
 */
export function PublicPostRoot({ postId }: PublicPostRootProps) {
  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
      <PublicPostPage postId={postId} />
    </ThemeProvider>
  );
}

export default PublicPostRoot;
