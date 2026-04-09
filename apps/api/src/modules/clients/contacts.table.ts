import { BaseTable } from "@backend/db/base_table";

export class ContactsTable extends BaseTable {
	readonly table = "contacts";

	columns = this.setColumns((t) => ({
		contactId: t.uuid().primaryKey().default(t.sql`gen_random_uuid()`),
		clienteId: t.uuid().foreignKey("clients", "clientId", {
			onUpdate: "RESTRICT",
			onDelete: "CASCADE",
		}),
		nome: t.string(255),
		email: t.string().nullable(),
		telefone: t.string(30).nullable(),
		cargo: t.string(100).nullable(),
		isPrimary: t.boolean().default(false),
		...t.timestamps(),
	}));
}
