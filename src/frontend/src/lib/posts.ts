/** `/post/<id>` is the public, shareable form; `#/post/<id>` stays the app route. */
export const POSTS_PREFIX = "/post";

/**
 * The segment after `/post/`. Digits are validated by the page, so a malformed
 * id still renders the post 404 instead of falling through to the app.
 */
export function parsePostSegment(pathname: string): string | null {
  const match = /^\/post\/([^/]+)\/?$/.exec(pathname);
  if (!match) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
}

export function postPath(id: bigint | string | number): string {
  return `${POSTS_PREFIX}/${id.toString()}`;
}

/**
 * The link a share button copies. Uses the current origin so dev, the caffeine
 * preview, and www.hyvmind.xyz all produce a URL that resolves where it was
 * clicked.
 */
export function postShareUrl(id: bigint | string | number): string {
  return new URL(postPath(id), window.location.origin).toString();
}
