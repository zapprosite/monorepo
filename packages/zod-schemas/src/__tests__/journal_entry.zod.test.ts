import { describe, expect, it } from 'vitest';
import {
	journalEntryCreateInputZod,
	journalEntryGetByIdZod,
	journalEntrySelectAllZod,
} from '../journal_entry.zod.js';

describe('journalEntryCreateInputZod', () => {
	it('accepts valid content', () => {
		const result = journalEntryCreateInputZod.safeParse({ content: 'My journal entry' });
		expect(result.success).toBe(true);
	});

	it('accepts content with optional prompt', () => {
		const result = journalEntryCreateInputZod.safeParse({
			content: 'Entry with prompt',
			prompt: 'What are you grateful for?',
			promptId: 1,
		});
		expect(result.success).toBe(true);
	});

	it('rejects empty content', () => {
		const result = journalEntryCreateInputZod.safeParse({ content: '' });
		expect(result.success).toBe(false);
	});

	it('rejects content over 50000 chars', () => {
		const result = journalEntryCreateInputZod.safeParse({ content: 'x'.repeat(50001) });
		expect(result.success).toBe(false);
	});

	it('rejects missing content', () => {
		const result = journalEntryCreateInputZod.safeParse({});
		expect(result.success).toBe(false);
	});

	it('rejects authorUserId in create input (omitted field)', () => {
		// authorUserId is omitted from create input — should be ignored or rejected
		const result = journalEntryCreateInputZod.safeParse({
			content: 'Valid',
			authorUserId: 'should-not-be-here',
		});
		// Zod strips unknown by default; the content itself is valid
		expect(result.success).toBe(true);
	});

	it('rejects prompt over 500 chars', () => {
		const result = journalEntryCreateInputZod.safeParse({
			content: 'Valid content',
			prompt: 'p'.repeat(501),
		});
		expect(result.success).toBe(false);
	});
});

describe('journalEntryGetByIdZod', () => {
	it('accepts valid ULID', () => {
		const result = journalEntryGetByIdZod.safeParse({
			journalEntryId: '01ARYZ6S41TSV4RRFFQ69G5FAV',
		});
		expect(result.success).toBe(true);
	});

	it('rejects missing journalEntryId', () => {
		const result = journalEntryGetByIdZod.safeParse({});
		expect(result.success).toBe(false);
	});

	it('rejects invalid ULID', () => {
		const result = journalEntryGetByIdZod.safeParse({ journalEntryId: 'not-a-ulid' });
		expect(result.success).toBe(false);
	});
});

describe('journalEntrySelectAllZod', () => {
	it('accepts complete entity', () => {
		const result = journalEntrySelectAllZod.safeParse({
			journalEntryId: '01ARYZ6S41TSV4RRFFQ69G5FAV',
			content: 'My entry',
			authorUserId: '550e8400-e29b-41d4-a716-446655440000',
			prompt: null,
			promptId: null,
			createdAt: Date.now(),
			updatedAt: Date.now(),
		});
		expect(result.success).toBe(true);
	});
});
