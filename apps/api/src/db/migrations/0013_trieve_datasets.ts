// @ts-nocheck - migration file with complex orchid-orm types
/**
 * Migration 0013: Trieve Datasets Table
 * Creates table to map teamId -> Trieve dataset IDs for multi-tenant isolation
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