const { concurrent } = require('tinyexec');

/** @type {import('lint-staged').Configuration} */
module.exports = {
  '*.{ts,tsx}': ['eslint --fix', 'prettier --write'],
  '*.{js,jsx}': ['eslint --fix', 'prettier --write'],
  '*.{json,md,mdx}': ['prettier --write'],
};
