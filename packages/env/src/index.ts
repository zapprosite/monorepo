import { config } from 'dotenv';
import { InfisicalClient } from '@infisical/sdk';
import { envSchema } from './schema';


// Load only non-secret config via dotenv
config({ path: '.env.local', only: ['NODE_ENV', 'API_PORT'] });

// Infisical SDK for secrets (SECRETS-MANDATE: SPEC-029)
async function loadSecrets() {
  const infisical = new InfisicalClient({
    clientId: process.env.INFISICAL_CLIENT_ID,
    clientSecret: process.env.INFISICAL_CLIENT_SECRET,
  });

  const secrets = await infisical.secrets.list({
    projectId: process.env.INFISICAL_PROJECT_ID,
    environment: process.env.INFISICAL_ENVIRONMENT || 'development',
  });

  return Object.fromEntries(secrets.map(s => [s.secretKey, s.secretValue]));
}

let secrets: Record<string, string> = {};

// Check if Infisical credentials are available
if (process.env.INFISICAL_CLIENT_ID && process.env.INFISICAL_CLIENT_SECRET) {
  try {
    secrets = await loadSecrets();
  } catch (error) {
    console.warn('[env] Warning: Failed to load secrets from Infisical, using fallback');
  }
}

export const env = envSchema.parse({
  NODE_ENV: process.env.NODE_ENV || 'development',
  API_PORT: process.env.API_PORT || '3000',
  DATABASE_URL: secrets.DATABASE_URL || process.env.DATABASE_URL,
});
