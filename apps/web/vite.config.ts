import path from 'node:path';
import react from '@vitejs/plugin-react-swc';
import { defineConfig } from 'vite';
import { analyzer } from 'vite-bundle-analyzer';
import { envValidationVitePlugin } from './src/utils/env_validation_vite_plugin.utils';

const _statsPath = path.resolve(__dirname, '.dev', 'stats.json');

export default defineConfig({
	base: '/',
	plugins: [
		envValidationVitePlugin(),
		react(),
		analyzer({
			enabled: true,
			analyzerMode: 'static',
			fileName: '.dev/stats.html',
			openAnalyzer: true,
		}),
	],
	resolve: {
		alias: {
			'@frontend': path.resolve(__dirname, './src'),
			'@backend': path.resolve(__dirname, '../backend/src'),
			'@repo/ui-mui': path.resolve(__dirname, '../../packages/ui/src'),
			'@repo/zod-schemas': path.resolve(__dirname, '../../packages/zod-schemas/dist'),
		},
	},
	build: {
		chunkSizeWarningLimit: 700,
		rollupOptions: {
			output: {
				manualChunks(id) {
					if (
						id.includes('node_modules/react') ||
						id.includes('node_modules/react-dom') ||
						id.includes('node_modules/scheduler')
					) {
						return 'react-vendor';
					}
					if (id.includes('node_modules/@mui') || id.includes('node_modules/@emotion')) {
						return 'mui-vendor';
					}
					if (id.includes('node_modules/zod') || id.includes('node_modules/@hookform')) {
						return 'zod-vendor';
					}
					if (id.includes('node_modules/@tanstack') || id.includes('node_modules/@trpc')) {
						return 'query-vendor';
					}
				},
			},
		},
	},
});
