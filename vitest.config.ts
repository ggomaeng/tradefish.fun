import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      // Mirror tsconfig paths so route handlers (which import via "@/...") can
      // be loaded from inside vitest specs.
      "@": path.resolve(__dirname, "src"),
    },
  },
  test: {
    include: ["src/**/*.test.ts", "scripts/**/__tests__/**/*.test.ts"],
  },
});
