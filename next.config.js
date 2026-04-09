/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: true,
    webpack(config) {
        config.module.rules.push({
            test: /pdf\.worker(\.min)?\.js$/i,
            type: "asset/resource",
        });
        return config;
    },
};

export default nextConfig;
  