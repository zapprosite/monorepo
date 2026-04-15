import { config } from 'dotenv';
import { envSchema } from './schema';

// Load all env from .env (canonical source — Infisical pruned 2026-04-13)
// Application code reads via process.env only. Never use Infisical SDK. (SECRETS-MANDATE: ADR-001)
config({ path: '.env' });

export const env = envSchema.parse({
  NODE_ENV: process.env.NODE_ENV || 'development',
  API_PORT: process.env.API_PORT || '3000',
  DATABASE_URL: process.env.DATABASE_URL,
});
