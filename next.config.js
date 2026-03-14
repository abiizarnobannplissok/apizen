/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  async rewrites() {
    return [
      {
        source: '/v1/:path*',
        destination: '/api/v1/:path*',
      },
    ];
  },
};

module.exports = nextConfig;
