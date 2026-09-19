/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  // Linting during the build is very memory-hungry and repeatedly OOM-crashed
  // (exit 134) on 512 MB builders. Type safety is still enforced: `tsc --noEmit`
  // runs separately/locally, and ESLint runs in CI/dev via `next lint`.
  eslint: {
    ignoreDuringBuilds: true,
  },
  experimental: {
    optimizePackageImports: ["lucide-react"],
    webpackMemoryOptimizations: true,
  },
};

export default nextConfig;
