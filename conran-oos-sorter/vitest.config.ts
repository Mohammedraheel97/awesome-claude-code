import { defineConfig } from "vitest/config";

// Kept separate from vite.config.ts so tests don't load the React Router plugin.
export default defineConfig({
  test: {
    include: ["app/**/*.test.ts"],
    environment: "node",
    globalSetup: ["app/sorter/testing/global-setup.ts"],
    env: { DATABASE_URL: "file:./test.sqlite" },
    // Database tests share one SQLite file.
    fileParallelism: false,
  },
});
