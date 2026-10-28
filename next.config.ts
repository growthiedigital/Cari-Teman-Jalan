import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Font kartu dibaca dengan fs saat runtime (src/lib/card/fonts.ts); pastikan
  // ikut terbawa ke fungsi serverless Vercel untuk route kartu.
  outputFileTracingIncludes: {
    "/api/card/**": ["./src/assets/fonts/**/*"],
  },
  // Halaman edit memuat token rahasia di URL: jangan di-cache, jangan diindeks,
  // dan jangan bocor lewat header Referer.
  async headers() {
    return [
      {
        source: "/edit/:path*",
        headers: [
          { key: "Cache-Control", value: "no-store" },
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
          { key: "Referrer-Policy", value: "no-referrer" },
        ],
      },
    ];
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
