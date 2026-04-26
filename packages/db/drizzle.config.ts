import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/index.ts',
  out: './src/migrations',
  dialect: 'postgresql',
});
