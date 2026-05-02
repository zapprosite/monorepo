import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";

export default defineConfig({
	plugins: [tsconfigPaths({ ignoreConfigErrors: true })],
	test: {
		globals: true,
		environment: "node",
		setupFiles: ["./src/test-utils/env-setup.ts"],
		include: [
			"src/__tests__/health.test.ts",
			"src/__tests__/http.test.ts",
			"src/middlewares/__tests__/sessionSecurity.middleware.test.ts",
		],
		coverage: {
			provider: "v8",
			reporter: ["text", "lcov"],
			exclude: ["src/db/migrations/**", "dist/**"],
		},
	},
});
