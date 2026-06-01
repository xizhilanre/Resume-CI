// apps/web/src/middleware.ts
// Auth middleware — activate when AUTH_GITHUB_ID is configured.
// export { auth as middleware } from "@/auth";
// See: https://authjs.dev/getting-started/session-management/protecting

export function middleware() {
  // noop — GitHub OAuth is configured but not enforced yet
}

export const config = {
  matcher: [],
};
