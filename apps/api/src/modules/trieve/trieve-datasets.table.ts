/**
 * Trieve Datasets Table
 * Maps teamId to Trieve dataset IDs for multi-tenant isolation
 */

import { BaseTable } from "@backend/db/base_table";

export class TrieveDatasetsTable extends BaseTable {
	readonly table = "trieve_datasets";

	columns = this.setColumns((t) => ({
		id: t.uuid().primaryKey().default(t.sql`gen_random_uuid()`),
		teamId: t.uuid(),
		trieveDatasetId: t.string(),
		name: t.string(),
		description: t.string().default(''),
		isDefault: t.boolean().default(false),
		...t.timestamps(),
	}));
}