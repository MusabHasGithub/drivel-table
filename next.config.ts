import type { NextConfig } from "next";

// Static-export config for GitHub Pages hosting.
//
// `output: "export"` is applied ONLY in production. In dev we want the
// normal Next server (so dynamic routes / route handlers can be added
// during development without breaking `npm run dev`). The CI build
// workflow runs with NODE_ENV=production, which flips this on.

const isProd = process.env.NODE_ENV === "production";

const nextConfig: NextConfig = {
  ...(isProd ? { output: "export" as const } : {}),
  basePath: isProd ? "/drivel-table" : "",
  assetPrefix: isProd ? "/drivel-table/" : "",
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
