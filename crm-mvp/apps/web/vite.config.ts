import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  server: { port: 3000, host: true },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@crm-mvp/ui': path.resolve(__dirname, '../../packages/ui/src/index.ts'),
      '@crm-mvp/trpc': path.resolve(__dirname, '../../packages/trpc/src/index.ts'),
    },
  },
});
