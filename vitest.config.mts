import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

const src = (path: string) => fileURLToPath(new URL(path, import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@": src("./src"),
      // "server-only" melempar galat di luar bundler Next; di uji diganti modul kosong.
      "server-only": src("./test/server-only-stub.ts"),
    },
  },
  test: {
    include: ["src/**/*.test.ts"],
  },
});
