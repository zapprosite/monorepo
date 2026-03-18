import { BaseTable } from "@backend/db/base_table";
import {
	CONTRACT_STATUS_ENUM,
	CONTRACT_TYPE_ENUM,
	CONTRACT_FREQUENCY_ENUM,
} from "@connected-repo/zod-schemas/crm_enums.zod";

export class ContractsTable extends BaseTable {
	readonly table = "contracts";

	columns = this.setColumns((t) => ({
		contractId: t.uuid().primaryKey().default(t.sql`gen_random_uuid()`),
		clienteId: t.uuid().foreignKey("clients", "clientId", {
			onUpdate: "RESTRICT",
			onDelete: "RESTRICT",
		}),
		tipo: t.enum("crm_contract_type_enum", CONTRACT_TYPE_ENUM),
		status: t.enum("crm_contract_status_enum", CONTRACT_STATUS_ENUM),
		dataInicio: t.date(),
		dataFim: t.date().nullable(),
		valor: t.decimal(12, 2).nullable(),
		frequencia: t.enum("crm_contract_frequency_enum", CONTRACT_FREQUENCY_ENUM).nullable(),
		descricao: t.text().nullable(),
		observacoes: t.text().nullable(),
		motivoCancelamento: t.text().nullable(),
		...t.timestamps(),
	}));
}
