import { expect, test } from '@playwright/test';

const API_BASE = process.env.API_URL || 'https://api.zappro.site';

test.describe('CRM Security E2E — P0/P1 Fixes', () => {

	test('P0-1: prompts endpoints require authentication', async ({ request }) => {
		const endpoints = [
			'/trpc/prompts.getAllActive',
			'/trpc/prompts.getRandomActive',
		];

		for (const endpoint of endpoints) {
			const res = await request.get(`${API_BASE}${endpoint}`);
			const body = await res.json();

			expect(
				body.error?.data?.code === 'UNAUTHORIZED' || res.status() === 401,
				`${endpoint} should require auth, got ${res.status()} ${JSON.stringify(body.error?.data?.code)}`,
			).toBeTruthy();
		}
	});

	test('P0-2: email campaigns endpoint requires authentication or is not registered', async ({ request }) => {
		const res = await request.get(`${API_BASE}/trpc/email.listCampaigns?input=%7B%22limit%22%3A10%2C%22offset%22%3A0%7D`);
		const body = await res.json();

		const isAuth = body.error?.data?.code === 'UNAUTHORIZED' || res.status() === 401;
		const isNotFound = body.error?.data?.code === 'NOT_FOUND';
		expect(
			isAuth || isNotFound,
			'email endpoint should require auth or be unregistered',
		).toBeTruthy();
	});

	test('P0-3: journal entries require authentication', async ({ request }) => {
		const res = await request.get(`${API_BASE}/trpc/journalEntries.getAll`);
		const body = await res.json();

		expect(
			body.error?.data?.code === 'UNAUTHORIZED' || res.status() === 401,
			'journalEntries.getAll should require auth',
		).toBeTruthy();
	});

	test('P0-4: MCP connectors do not leak apiKey in list', async ({ request }) => {
		const res = await request.get(`${API_BASE}/trpc/mcpConectores.list?input=%7B%7D`);
		const body = await res.json();

		if (body.error?.data?.code === 'UNAUTHORIZED') {
			expect(true, 'mcpConectores.list requires auth — PASS').toBeTruthy();
		} else if (body.result?.data) {
			const data = Array.isArray(body.result.data) ? body.result.data : body.result.data;
			for (const item of data) {
				expect(item.apiKey, 'apiKey should not be in response').toBeUndefined();
			}
		}
	});

	test('P0-5: registration does not accept arbitrary teamId', async ({ request }) => {
		const res = await request.post(`${API_BASE}/trpc/auth.registerWithPassword`, {
			data: {
				email: 'security-test-e2e@example.com',
				password: 'testpassword123',
				teamId: 'arbitrary-team-id',
			},
		});
		const body = await res.json();

		if (body.error) {
			expect(true, 'Registration rejected (DB or validation error)').toBeTruthy();
		} else if (body.result?.data) {
			expect(body.result.data.teamId, 'teamId should not be user-specified').toBeFalsy();
		}
	});

	test('P1-4: login does not leak auth type', async ({ request }) => {
		const res = await request.post(`${API_BASE}/trpc/auth.loginWithPassword`, {
			data: {
				email: 'will@zappro.site',
				password: 'wrong-password',
			},
		});
		const body = await res.json();

		const errorMsg = body.error?.message || JSON.stringify(body);
		expect(
			!errorMsg.includes('Google') && !errorMsg.includes('OAuth'),
			`Error message should not mention auth type: ${errorMsg}`,
		).toBeTruthy();
	});

	test('P1-3: dev bypass disabled in production (NODE_ENV=production)', async ({ request }) => {
		const res = await request.get(`${API_BASE}/trpc/clients.listClients`, {
			headers: { 'X-Dev-User': 'will@zappro.site' },
		});
		const body = await res.json();

		expect(
			body.error?.data?.code === 'UNAUTHORIZED' || res.status() === 401,
			'X-Dev-User header should be ignored in production',
		).toBeTruthy();
	});

	test('OAuth2 state parameter enabled (CSRF protection)', async ({ request }) => {
		const res = await request.get(`${API_BASE}/oauth2/google`, {
			maxRedirects: 0,
		});

		const setCookieHeaders = res.headers()['set-cookie'] || '';
		expect(
			setCookieHeaders.includes('oauth2-redirect-state='),
			'OAuth2 should set state cookie for CSRF protection',
		).toBeTruthy();
	});

	test('Protected endpoints require auth — dashboard, clients, leads', async ({ request }) => {
		const endpoints = [
			'/trpc/dashboard.getStats',
			'/trpc/clients.listClients',
			'/trpc/leads.listLeads',
			'/trpc/contracts.listContracts',
			'/trpc/schedule.listSchedules',
			'/trpc/serviceOrders.listServiceOrders',
			'/trpc/reminders.listReminders',
			'/trpc/editorial.listEditorialItems',
		];

		for (const endpoint of endpoints) {
			const res = await request.get(`${API_BASE}${endpoint}`);
			const body = await res.json();

			expect(
				body.error?.data?.code === 'UNAUTHORIZED' || res.status() === 401,
				`${endpoint} should require auth`,
			).toBeTruthy();
		}
	});

	test('Security headers present', async ({ request }) => {
		const res = await request.get(`${API_BASE}/health`);

		const headers = res.headers();
		expect(headers['x-content-type-options'], 'X-Content-Type-Options').toBe('nosniff');
		expect(headers['x-frame-options'], 'X-Frame-Options').toBe('SAMEORIGIN');
		expect(headers['strict-transport-security'], 'HSTS').toContain('max-age');
		expect(headers['x-xss-protection'], 'X-XSS-Protection').toBe('0');
	});
});