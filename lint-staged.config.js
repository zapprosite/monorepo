const { concurrent } = require('tinyexec');

/** @type {import('lint-staged').Configuration} */
module.exports = {
  '*.{ts,tsx,js,jsx}': [
    'biome check --no-errors-on-unmatched',
    'biome format --write',
  ],
  '*.{json,md,mdx}': [
    'prettier --write',
  ],
};
