import { defineConfig } from "vitest/config";

// Integration tests share one Postgres database and one Redis database, so files run one at a time.
export default defineConfig({
  test: {
    environment: "node",
    include: ["test/**/*.test.ts"],
    fileParallelism: false,
    pool: "forks",
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
