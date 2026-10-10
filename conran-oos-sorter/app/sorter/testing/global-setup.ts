import { execSync } from "node:child_process";

// Test database for the tests that touch Prisma (see vitest.config.ts). Applying the real
// migrations also checks that they match the schema. Tests empty the tables they use.
export default function setup() {
  execSync("npx prisma migrate deploy", {
    env: { ...process.env, DATABASE_URL: "file:./test.sqlite" },
    stdio: "ignore",
  });
}
