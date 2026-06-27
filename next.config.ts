import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // pdfkit reads its font-metric (.afm) files from disk at runtime. Keep it
  // unbundled and force its data files into the export function so PDF export
  // works on Vercel (otherwise: ENOENT .../data/Helvetica.afm).
  serverExternalPackages: ["pdfkit"],
  outputFileTracingIncludes: {
    "/api/export": ["./node_modules/pdfkit/js/data/**/*"],
  },
  experimental: {
    optimizePackageImports: ["framer-motion"],
  },
};

export default nextConfig;
