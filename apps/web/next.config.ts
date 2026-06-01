import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@resume-ci/core", "@resume-ci/ui"],
};

export default nextConfig;
