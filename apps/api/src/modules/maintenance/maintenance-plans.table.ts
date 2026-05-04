import { BaseTable } from '@backend/db/base_table';
import {
	// @ts-ignore TS2305 export exists in source but TS resolution issue
	MAINTENANCE_PLAN_TYPE_ENUM,
	TIPO_EQUIPAMENTO_ENUM,
} from '@repo/zod-schemas/crm_enums.zod';

export class MaintenancePlansTable extends BaseTable {
	readonly table = 'maintenance_plans';

	// @ts-ignore TS2742 — pqb internal type inference not portable
	columns = this.setColumns((t) => ({
		id: t.uuid().primaryKey().default(t.sql`gen_random_uuid()`),
		planType: t.enum('maintenance_plan_type', MAINTENANCE_PLAN_TYPE_ENUM).default('simples'),
		nomeEmpresa: t.text(),
		descricao: t.text().nullable(),
		tipoEquipamento: t.enum('tipo_equipamento', TIPO_EQUIPAMENTO_ENUM),
		periodicidadeDias: t.integer(),
		carga: t.text().nullable(),
		refrigerante: t.text().nullable(),
		ultimaManutencao: t.timestamp().nullable(),
		proxima: t.timestamp().nullable(),
		horasEstimadas: t.integer().default(2),
		custoEstimado: t.decimal(10, 2).default(0),
		clienteId: t.uuid().foreignKey('clients', 'clientId', {
			onUpdate: 'RESTRICT',
			onDelete: 'RESTRICT',
		}),
		equipamentoId: t.uuid().foreignKey('equipment', 'equipmentId', {
			onUpdate: 'RESTRICT',
			onDelete: 'RESTRICT',
		}),
		contratoId: t.uuid().nullable().foreignKey('contracts', 'contractId', {
			onUpdate: 'RESTRICT',
			onDelete: 'SET NULL',
		}),
		usuarioCriacaoId: t.uuid().foreignKey('users', 'userId', {
			onUpdate: 'RESTRICT',
			onDelete: 'RESTRICT',
		}),
		// PMOC-specific fields (only for commercial plans with CREA)
		creaResponsavel: t.text().nullable(), // Engineer responsible for PMOC
		laudoTecnico: t.text().nullable(), // Technical report PDF URL
		numeroEquipamentos: t.integer().nullable(), // Count of registered equipment
		potenciaTotal: t.decimal(12, 2).nullable(), // Total BTU/kW capacity
		cargaTermica: t.decimal(12, 2).nullable(), // Thermal load
		vazioSanitario: t.integer().nullable(), // Sanitary void period (days)
		...t.timestamps(),
	}));
}
