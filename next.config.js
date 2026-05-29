/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: true,
    output: "export",
    basePath: "/markup",
    assetPrefix: "/markup/",
    webpack(config) {
        config.module.rules.push({
            test: /pdf\.worker(\.min)?\.js$/i,
            type: "asset/resource",
        });
        return config;
    },
};

export default nextConfig;