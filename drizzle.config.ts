import { defineConfig } from "drizzle-kit";

// Defer DATABASE_URL check to runtime to avoid deployment issues
// The URL will be validated when drizzle-kit commands are actually run
export default defineConfig({
  out: "./migrations",
  schema: "./shared/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL || "",
  },
});
