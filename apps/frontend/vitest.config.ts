import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react-swc";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
	plugins: [react(), tsconfigPaths()],
	test: {
		globals: true,
		environment: "jsdom",
		setupFiles: ["./src/test-setup.ts"],
		include: ["src/**/*.test.tsx", "src/**/*.test.ts", "src/**/*.spec.tsx"],
		coverage: {
			provider: "v8",
			reporter: ["text", "lcov"],
			exclude: ["src/main.tsx", "dist/**"],
		},
	},
});
