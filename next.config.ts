import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingIncludes: {
    "/": ["./public/landing.html"],
  },
  async redirects() {
    return [{ source: "/portal", destination: "/dashboard", permanent: false }];
  },
};

export default nextConfig;
