import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  // Self-contained server bundle for the Docker image (node .next/standalone/server.js)
  output: "standalone",
  env: {
    NEXT_PUBLIC_BACKEND_URL: process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8080",
    NEXT_PUBLIC_WS_URL: process.env.NEXT_PUBLIC_WS_URL || "http://localhost:8080",
  },
};

export default withNextIntl(nextConfig);
