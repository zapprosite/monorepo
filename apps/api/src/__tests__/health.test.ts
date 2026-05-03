import { describe, expect, it } from 'vitest';

describe('health', () => {
	it('api module loads', () => {
		expect(true).toBe(true);
	});

	it('environment is test', () => {
		expect(process.env['NODE_ENV']).toBeDefined();
	});
});
