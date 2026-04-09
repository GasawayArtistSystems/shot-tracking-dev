import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
    plugins: [react()],
    build: {
        lib: {
            entry: path.resolve(__dirname, "src/components/BugFeatureForm.jsx"),
            name: "BugFeatureForm",
            fileName: () => "bugFeatureFormBundle.umd.js",
            formats: ["umd"],
        },
        outDir: "static/js/bugreport-frontend/dist",
        emptyOutDir: true,
    },
});
