/**
 * Infisical SDK Wrapper — Get Secret
 * Fetches secrets from Infisical vault
 */

const INFISICAL_CONFIG = {
  clientId: null, // Populated from Infisical
  clientSecret: null, // Populated from Infisical
};

/**
 * Get a secret from Infisical vault
 * @param {string} secretName - The secret key name
 * @returns {Promise<string>} The secret value
 */
async function getInfisicalSecret(secretName) {
  // Try to get from cache first
  const cacheKey = `infisical_${secretName}`;
  const cached = localStorage.getItem(cacheKey);
  if (cached) {
    const { value, expires } = JSON.parse(cached);
    if (expires > Date.now()) return value;
  }

  // Ensure we have credentials
  if (!INFISICAL_CONFIG.clientId || !INFISICAL_CONFIG.clientSecret) {
    await initInfisical();
  }

  // Fetch from Infisical
  const response = await fetch(`${INFISICAL_CONFIG.baseUrl}/v3/secrets/secret`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'CLIENT-ID': INFISICAL_CONFIG.clientId,
      'CLIENT-SECRET': INFISICAL_CONFIG.clientSecret
    },
    body: JSON.stringify({
      secretName,
      projectId: 'default',
      environment: 'production'
    })
  });

  if (!response.ok) {
    throw new Error(`Infisical: Failed to fetch ${secretName}`);
  }

  const data = await response.json();
  const value = data.secretValue;

  // Cache for 5 minutes
  localStorage.setItem(cacheKey, JSON.stringify({
    value,
    expires: Date.now() + (5 * 60 * 1000)
  }));

  return value;
}

/**
 * Initialize Infisical credentials
 */
async function initInfisical() {
  // These should be hardcoded env vars at build time
  // or fetched from a public config endpoint
  INFISICAL_CONFIG.clientId = '_CLIENT_ID_';
  INFISICAL_CONFIG.clientSecret = '_CLIENT_SECRET_';
}
