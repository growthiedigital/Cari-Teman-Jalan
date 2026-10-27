import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Font kartu dibaca dengan fs saat runtime (src/lib/card/fonts.ts); pastikan
  // ikut terbawa ke fungsi serverless Vercel untuk route kartu.
  outputFileTracingIncludes: {
    "/api/card/**": ["./src/assets/fonts/**/*"],
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
