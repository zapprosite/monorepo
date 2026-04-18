import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const MONOREPO_ROOT = path.resolve(__dirname, '..');
const ENV_FILE = path.resolve(MONOREPO_ROOT, '.env');
const ENV_EXAMPLE = path.resolve(MONOREPO_ROOT, '.env.example');

const REQUIRED_VARS = ['NODE_ENV', 'PORT'];

function checkEnv() {
	if (!fs.existsSync(ENV_FILE)) {
		console.error('FATAL: .env not found at ' + ENV_FILE);
		process.exit(1);
	}
	if (!fs.existsSync(ENV_EXAMPLE)) {
		console.warn('WARNING: .env.example not found');
	}
	const envContent = fs.readFileSync(ENV_FILE, 'utf8');
	const missing = REQUIRED_VARS.filter((v) => !envContent.includes(v + '='));
	if (missing.length > 0) {
		console.error('FATAL: Missing required env vars: ' + missing.join(', '));
		process.exit(1);
	}
	console.log('[OK] .env validated');
	const apps = ['hermes-agency', 'list-web', 'obsidian-web', 'ai-gateway', 'api', 'web'];
	for (const app of apps) {
		const appEnv = path.resolve(MONOREPO_ROOT, 'apps', app, '.env');
		if (fs.existsSync(appEnv)) {
			const link = fs.readFileSync(appEnv, 'utf8').trim();
			if (link.startsWith('/srv/monorepo/.env') || link === '.env') {
				console.log('[OK] apps/' + app + '/.env -> symlink');
			} else {
				console.log('[WARN] apps/' + app + '/.env -> manual config');
			}
		}
	}
	console.log('[OK] env:sync complete');
}

checkEnv();
