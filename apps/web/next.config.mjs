/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  transpilePackages: ['@trustledger/shared'],
  experimental: {
    typedRoutes: true,
  },
};

export default nextConfig;
