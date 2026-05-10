import type { NextConfig } from "next";

// Static-export config for GitHub Pages hosting.
//
//   - output: "export"  → `next build` writes static HTML/CSS/JS to `out/`,
//                         which is what GitHub Pages serves.
//   - basePath          → the repo name, since the site lives under
//                         `musabhasgithub.github.io/drivel-table/`. Next
//                         auto-prefixes Link hrefs and assets in prod.
//   - trailingSlash     → makes `/rooms/` resolve to `out/rooms/index.html`
//                         (GitHub Pages doesn't auto-append `.html` for
//                         clean URLs without this).
//
// In `npm run dev` the basePath is empty so localhost:3002/ works as
// expected. Production-only basePath is the standard pattern for
// GH-Pages-hosted Next apps.
const isProd = process.env.NODE_ENV === "production";

const nextConfig: NextConfig = {
  output: "export",
  basePath: isProd ? "/drivel-table" : "",
  assetPrefix: isProd ? "/drivel-table/" : "",
  trailingSlash: true,
  images: {
    // GH Pages can't run Next's image optimizer (no Node runtime).
    unoptimized: true,
  },
};

export default nextConfig;
