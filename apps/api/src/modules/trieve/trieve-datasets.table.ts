/**
 * Trieve Datasets Table
 * Maps teamId to Trieve dataset IDs for multi-tenant isolation
 */

import { t } from '@backend/db/db';

export const TrieveDatasetsTable = t.table('trieve_datasets', (t) => ({
  id: t.uuid().primaryKey().default(t.sql`gen_random_uuid()`),
  teamId: t.uuid().notNull(),
  trieveDatasetId: t.string().notNull(),
  name: t.string().notNull(),
  description: t.string().default(''),
  isDefault: t.boolean().default(false),
  createdAt: t.timestamps().createdAt,
  updatedAt: t.timestamps().updatedAt,
}));