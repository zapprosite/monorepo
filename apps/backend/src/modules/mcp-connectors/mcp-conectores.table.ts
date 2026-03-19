import { BaseTable } from "@backend/db/base_table";
import {
	MCP_PROVIDER_ENUM,
	MCP_CONECTAR_STATUS_ENUM,
} from "@connected-repo/zod-schemas/crm_enums.zod";

export class McpConectoresTable extends BaseTable {
	readonly table = "mcp_conectores";

	columns = this.setColumns((t) => ({
		id: t.uuid().primaryKey().default(t.sql`gen_random_uuid()`),
		provider: t.enum("mcp_provider", MCP_PROVIDER_ENUM),
		status: t.enum("mcp_conectar_status", MCP_CONECTAR_STATUS_ENUM).default("pendente"),
		apiKey: t.text(),
		configuracao: t.json().nullable(),
		clienteId: t.uuid().foreignKey("clients", "clientId", {
			onUpdate: "RESTRICT",
			onDelete: "CASCADE",
		}),
		usuarioCriacaoId: t.uuid().foreignKey("users", "userId", {
			onUpdate: "RESTRICT",
			onDelete: "RESTRICT",
		}),
		ultimaTentativaSync: t.timestamp().nullable(),
		erroUltimaTentativa: t.text().nullable(),
		...t.timestamps(),
	}));
}
