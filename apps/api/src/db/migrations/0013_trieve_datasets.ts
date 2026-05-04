// @ts-nocheck - migration file with complex orchid-orm types
/**
 * Migration 0013: Trieve Datasets Table (DEPRECATED)
 * Creates table to map teamId -> Trieve dataset IDs for multi-tenant isolation
 * 
 * ⚠️ DEPRECATED: Trieve was removed from the monorepo on 2026-05-04.
 * The RAG functionality was replaced by Hermes Second Brain (Mem0 + Qdrant).
 * This migration is kept for historical record only.
 */

import { change } from '../db_script';

change(async (db) => {
	await db.createTable('trieve_datasets', (t) => ({
		id: t.uuid().primaryKey().default(t.sql`gen_random_uuid()`),
		teamId: t.uuid().notNull(),
		trieveDatasetId: t.string().notNull(),
		name: t.string().notNull(),
		description: t.string().default(''),
		isDefault: t.boolean().default(false),
		createdAt: t.timestamps().createdAt,
		updatedAt: t.timestamps().updatedAt,
	}));

	await db.createIndex('trieve_datasets', ['teamId']);
	await db.createIndex('trieve_datasets', ['trieveDatasetId']);
});
