/**
 * Sets required env vars BEFORE any module imports in tests.
 * Must be listed first in vitest.config.ts setupFiles.
 */
process.env.NODE_ENV = "test";
process.env.GOOGLE_CLIENT_ID = "test-client-id.apps.googleusercontent.com";
process.env.GOOGLE_CLIENT_SECRET = "test-google-secret";
process.env.SESSION_SECRET = "test-session-secret-minimum-32-characters-long!!";
process.env.PORT = "4000";
process.env.WEBAPP_URL = "http://localhost:5173";
process.env.VITE_API_URL = "http://localhost:4000";
process.env.INTERNAL_API_SECRET = "test-internal-api-secret-minimum-32-chars!!";
process.env.DB_HOST = process.env.DB_HOST ?? "localhost";
process.env.DB_PORT = process.env.DB_PORT ?? "5432";
process.env.DB_USER = process.env.DB_USER ?? "postgres";
process.env.DB_PASSWORD = process.env.DB_PASSWORD ?? "postgres";
process.env.DB_NAME = process.env.DB_NAME ?? "connected_repo_test";
