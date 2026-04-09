import { BaseTable } from "@backend/db/base_table";
import { ADDRESS_TYPE_ENUM } from "@connected-repo/zod-schemas/crm_enums.zod";

export class AddressesTable extends BaseTable {
	readonly table = "addresses";

	columns = this.setColumns((t) => ({
		addressId: t.uuid().primaryKey().default(t.sql`gen_random_uuid()`),
		clienteId: t.uuid().foreignKey("clients", "clientId", {
			onUpdate: "RESTRICT",
			onDelete: "CASCADE",
		}),
		tipo: t.enum("crm_address_type_enum", ADDRESS_TYPE_ENUM).nullable(),
		rua: t.string(255),
		numero: t.string(20),
		complemento: t.string(100).nullable(),
		bairro: t.string(100),
		cep: t.string(9),
		cidade: t.string(100),
		estado: t.string(2),
		...t.timestamps(),
	}));
}
