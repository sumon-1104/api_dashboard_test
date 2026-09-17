// vitest runs in plain Node, not Next's RSC bundler, so the real
// "server-only" package (which always throws outside that bundler) is
// aliased to this no-op for tests. See vitest.config.ts.
export {};
