/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config, { dev }) => {
    // Docker Desktop on Windows can expose host paths that Chrome/webpack
    // cannot register as a valid Linux filesystem. Keep cache in memory.
    config.cache = { type: 'memory' };

    if (dev) {
      config.watchOptions = {
        ...(config.watchOptions ?? {}),
        poll: 1000,
        aggregateTimeout: 300,
        ignored: ['**/node_modules/**', '**/.next/**'],
      };
    }

    return config;
  },
};

module.exports = nextConfig;
