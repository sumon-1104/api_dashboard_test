import { describe, expect, it } from "vitest";
import { shouldRedirectToDashboard, shouldRedirectToLogin } from "./redirect-rules";

describe("shouldRedirectToLogin", () => {
  it("redirects an unauthenticated visitor away from /dashboard/*", () => {
    expect(shouldRedirectToLogin("/dashboard", false)).toBe(true);
    expect(shouldRedirectToLogin("/dashboard/projects", false)).toBe(true);
  });

  it("does not redirect an authenticated user", () => {
    expect(shouldRedirectToLogin("/dashboard", true)).toBe(false);
  });

  it("does not touch routes outside /dashboard", () => {
    expect(shouldRedirectToLogin("/login", false)).toBe(false);
    expect(shouldRedirectToLogin("/api/cron/poll-usage", false)).toBe(false);
  });
});

describe("shouldRedirectToDashboard", () => {
  it("sends an already-authenticated user away from /login", () => {
    expect(shouldRedirectToDashboard("/login", true)).toBe(true);
  });

  it("leaves an unauthenticated visitor on /login", () => {
    expect(shouldRedirectToDashboard("/login", false)).toBe(false);
  });
});
