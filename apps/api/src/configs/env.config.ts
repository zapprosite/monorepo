import { NODE_ENV_ZOD } from '@repo/zod-schemas/node_env';
import { zString } from '@repo/zod-schemas/zod_utils';
import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
	ALLOWED_ORIGINS: zString.optional(),
	NODE_ENV: NODE_ENV_ZOD,
	PORT: z.coerce.number().int().min(1024).max(65535).default(4000),
	DB_HOST: zString.optional(),
	DB_PORT: zString.optional(),
	DB_USER: zString.optional(),
	DB_PASSWORD: zString.optional(),
	DB_NAME: zString.optional(),
	DB_SSL: z.enum(['true', 'false', 'require', 'prefer']).optional(),
	GOOGLE_CLIENT_ID: zString.includes('.apps.googleusercontent.com').optional(),
	GOOGLE_CLIENT_SECRET: zString.optional(),
	SESSION_SECRET: zString.min(32, 'Session secret must be at least 32 characters'),
	WEBAPP_URL: z.url().optional(),
	API_BASE_URL: z.url().optional(),
	VITE_API_URL: z.url().optional(),
	INTERNAL_API_SECRET: zString
		.min(32, 'Internal API secret must be at least 32 characters')
		.optional(),
	COOKIE_DOMAIN: zString.optional(),
});

// ----------------------------------------
// Final Schema & Export
// ----------------------------------------
export const env = envSchema.parse(process.env);

// Environment helpers
export const isDev = env.NODE_ENV === 'development';
export const isProd = env.NODE_ENV === 'production';
export const isStaging = env.NODE_ENV === 'staging';
export const isTest = env.NODE_ENV === 'test';
