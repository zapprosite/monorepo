/**
 * Infisical SDK Wrapper — Get Secret
 * Fetches secrets from Infisical vault for obsidian-web
 */

var INFISICAL_CONFIG = {
  clientId: null,
  clientSecret: null,
  baseUrl: 'https://vault.zappro.site/api'
};

/**
 * Get a secret from Infisical vault
 * @param {string} secretName - The secret key name
 * @returns {Promise<string>} The secret value
 */
async function getInfisicalSecret(secretName) {
  // Try to get from cache first
  var cacheKey = 'infisical_' + secretName;
  var cached = localStorage.getItem(cacheKey);
  if (cached) {
    try {
      var c = JSON.parse(cached);
      if (c.expires > Date.now()) return c.value;
    } catch (e) {}
  }

  // Ensure we have credentials
  if (!INFISICAL_CONFIG.clientId || !INFISICAL_CONFIG.clientSecret) {
    await initInfisical();
  }

  // Fetch from Infisical
  var response = await fetch(INFISICAL_CONFIG.baseUrl + '/v3/secrets/secret', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'CLIENT-ID': INFISICAL_CONFIG.clientId,
      'CLIENT-SECRET': INFISICAL_CONFIG.clientSecret
    },
    body: JSON.stringify({
      secretName: secretName,
      projectId: 'default',
      environment: 'production'
    })
  });

  if (!response.ok) {
    throw new Error('Infisical: Failed to fetch ' + secretName);
  }

  var data = await response.json();
  var value = data.secretValue;

  // Cache for 5 minutes
  localStorage.setItem(cacheKey, JSON.stringify({
    value: value,
    expires: Date.now() + (5 * 60 * 1000)
  }));

  return value;
}

/**
 * Initialize Infisical credentials
 */
async function initInfisical() {
  // These should be hardcoded env vars at build time
  INFISICAL_CONFIG.clientId = '_CLIENT_ID_';
  INFISICAL_CONFIG.clientSecret = '_CLIENT_SECRET_';
}
