import { BaseTable } from '@backend/db/base_table';
import {
	NIVEL_FIDELIDADE_ENUM,
	STATUS_REATIVACAO_ENUM,
} from '@connected-repo/zod-schemas/crm_enums.zod';

export class LoyaltyScoresTable extends BaseTable {
	readonly table = 'loyalty_scores';

	// @ts-expect-error TS2742 — pqb internal type inference not portable
	columns = this.setColumns((t) => ({
		id: t.uuid().primaryKey().default(t.sql`gen_random_uuid()`),
		clienteId: t.uuid().foreignKey('clients', 'clientId', {
			onUpdate: 'RESTRICT',
			onDelete: 'CASCADE',
		}),
		pontos: t.integer().default(0),
		nivel: t.enum('nivel_fidelidade', NIVEL_FIDELIDADE_ENUM).default('bronze'),
		ultimaCompra: t.timestamp().nullable(),
		diasSemContato: t.integer().default(0),
		statusReativacao: t.enum('status_reativacao', STATUS_REATIVACAO_ENUM).default('ativo'),
		dataProximaReativacao: t.timestamp().nullable(),
		usuarioCriacaoId: t.uuid().foreignKey('users', 'userId', {
			onUpdate: 'RESTRICT',
			onDelete: 'RESTRICT',
		}),
		...t.timestamps(),
	}));
}
