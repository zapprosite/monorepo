import react from "@vitejs/plugin-react-swc";
import path from "path";
import { defineConfig } from "vite";
import { analyzer } from 'vite-bundle-analyzer';
import { envValidationVitePlugin } from "./src/utils/env_validation_vite_plugin.utils";

const statsPath = path.resolve(__dirname, ".dev", "stats.json");

// https://vite.dev/config/
export default defineConfig({
	base: "/",
	plugins: [
		envValidationVitePlugin(),
		react(),
		analyzer({
			// analyzerMode: "json",
			// fileName: statsPath,
			// Use the below when output needed is html
			enabled: true,
			analyzerMode: "static",
			fileName: ".dev/stats.html",
			openAnalyzer: true,
		})
	],
	resolve: {
		alias: {
			'@frontend': path.resolve(__dirname, './src'),
			'@backend': path.resolve(__dirname, '../backend/src'),
		},
	},
	build: {
		chunkSizeWarningLimit: 700,
		rollupOptions: {
			output: {
				manualChunks(id) {
					if (id.includes("node_modules/react") || id.includes("node_modules/react-dom") || id.includes("node_modules/scheduler")) {
						return "react-vendor";
					}
					if (id.includes("node_modules/@mui") || id.includes("node_modules/@emotion")) {
						return "mui-vendor";
					}
					if (id.includes("node_modules/zod") || id.includes("node_modules/@hookform")) {
						return "zod-vendor";
					}
					if (id.includes("node_modules/@tanstack") || id.includes("node_modules/@trpc")) {
						return "query-vendor";
					}
				},
			},
		},
	},
});
