/** @type {import('next').NextConfig} */
const nextConfig = {
  // Add OpenAI to the transpiled modules list
  transpilePackages: ["openai"],

  // Enable webpack polyfills for required Node.js modules
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // Client-side browser polyfills
      config.resolve.fallback = {
        ...config.resolve.fallback,
        buffer: require.resolve("buffer/"),
        stream: require.resolve("stream-browserify"),
        util: require.resolve("util/"),
        crypto: require.resolve("crypto-browserify"),
        http: require.resolve("stream-http"),
        https: require.resolve("https-browserify"),
        zlib: require.resolve("browserify-zlib"),
        fs: false,
        path: false,
      };
    }

    return config;
  },
};

module.exports = nextConfig;
