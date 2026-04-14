import { config } from 'dotenv';
import { envSchema } from './schema';

// Load all env — secrets are synced from Infisical to .env (canonical source)
// Application code NEVER uses Infisical SDK directly (SECRETS-MANDATE: ADR-001)
config({ path: '.env' });

export const env = envSchema.parse({
  NODE_ENV: process.env.NODE_ENV || 'development',
  API_PORT: process.env.API_PORT || '3000',
  DATABASE_URL: process.env.DATABASE_URL,
});
