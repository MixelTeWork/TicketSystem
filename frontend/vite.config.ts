import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import autoprefixer from "autoprefixer";
import browserslistToEsbuild from "browserslist-to-esbuild";

export default defineConfig({
	plugins: [react()],
	css: { postcss: { plugins: [autoprefixer()] } },
	server: {
		proxy: { "/api": "http://127.0.0.1:5001" },
	},
	build: {
		outDir: "build",
		assetsDir: "static",
		target: browserslistToEsbuild(undefined, { env: "production" }),
	},
	test: {
		environment: "jsdom",
		maxWorkers: 2,
	},
});
