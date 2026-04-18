/** @type {import('lint-staged').Configuration} */
module.exports = {
	'*.{ts,tsx}': ['eslint --fix --no-warn-ignored', 'biome format . --write'],
	'*.{js,jsx}': ['eslint --fix --no-warn-ignored', 'biome format . --write'],
};
