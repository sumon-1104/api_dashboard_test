import { defineConfig } from "vitest/config";
import path from "node:path";

const dirname = import.meta.dirname;

export default defineConfig({
  resolve: {
    alias: {
      "server-only": path.resolve(dirname, "./src/test/server-only-mock.ts"),
      "@": path.resolve(dirname, "./src"),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
