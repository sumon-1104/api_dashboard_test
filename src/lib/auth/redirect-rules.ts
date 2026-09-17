// Pure routing predicates used by proxy.ts. No "server-only"/Next imports —
// kept dependency-free so proxy.ts stays light and this is trivially unit-testable.

export function shouldRedirectToLogin(pathname: string, hasUser: boolean): boolean {
  return pathname.startsWith("/dashboard") && !hasUser;
}

export function shouldRedirectToDashboard(pathname: string, hasUser: boolean): boolean {
  return pathname === "/login" && hasUser;
}
