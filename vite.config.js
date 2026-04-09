// vite.config.js (for root-based React + Flask project)
import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import path from "path"

export default defineConfig(({ mode }) => {
  const isDev = mode === "development"

  return {
    root: "src/app/markup", // where your index.html lives
    base: isDev ? "/" : "/markup/", // Flask serves this under /markup

    plugins: [react()],

    resolve: {
      alias: {
        "@components": path.resolve(__dirname, "src/components"),
      },
    },

    server: {
      open: "/dev-index.html",
      fs: {
        allow: [
          path.resolve(__dirname),
          path.resolve(__dirname, "src/app/markup"),
        ],
      },
    },

    define: {
      "process.env": {},
    },

    build: {
      outDir: path.resolve(__dirname, "src/static/react/assets"),
      emptyOutDir: true,
      rollupOptions: {
        input: {
          main: path.resolve(__dirname, "src/app/markup/index.html"),
          dev: path.resolve(__dirname, "src/app/markup/dev-index.html"),
          bugForm: path.resolve(__dirname, "src/app/markup/bugFeatureEntry.jsx"),
        },
        output: {
          entryFileNames: "[name].js",
          assetFileNames: "[name].[ext]",
        },
      },
    },
  }
})
