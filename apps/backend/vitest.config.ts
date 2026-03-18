import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
	plugins: [tsconfigPaths()],
	test: {
		globals: true,
		environment: "node",
		setupFiles: ["./src/test-utils/env-setup.ts"],
		include: ["src/**/*.test.ts", "src/**/*.spec.ts"],
		coverage: {
			provider: "v8",
			reporter: ["text", "lcov"],
			exclude: ["src/db/migrations/**", "dist/**"],
		},
	},
});
