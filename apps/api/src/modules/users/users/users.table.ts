import { BaseTable } from '@backend/db/base_table';

export class UserTable extends BaseTable {
	readonly table = 'users';

	// @ts-ignore TS2742 — pqb internal type inference not portable
	columns = this.setColumns((t) => ({
		userId: t.uuid().primaryKey().default(t.sql`gen_random_uuid()`),
		email: t.string().unique(),
		name: t.string().nullable(),
		displayPicture: t.string().nullable(),
		teamId: t.uuid().nullable(),
		...t.timestamps(),
	}));
}
