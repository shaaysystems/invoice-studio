import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, ".") } },
  // tsconfig sets jsx: "preserve" for Next, so tests need the automatic runtime.
  // Vitest 4 runs Vite 8, which transforms with oxc rather than esbuild.
  oxc: { jsx: { runtime: "automatic" } },
  test: { environment: "node", include: ["tests/**/*.test.ts"] },
});
