/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
  async redirects() {
    return [
      {
        source: '/:path*',
        has: [
          {
            type: 'host',
            value: 'travelzada.com',
          },
        ],
        destination: 'https://www.travelzada.com/:path*',
        permanent: true,
      },
    ]
  },
  webpack: (config, { isServer }) => {
    // Fix for undici and other Node.js modules
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        dns: false,
        child_process: false,
      }
    }

    // Ignore undici on server side
    if (isServer) {
      config.externals = config.externals || []
      config.externals.push({
        'undici': 'commonjs undici',
      })
    }

    return config
  },
}

module.exports = nextConfig


