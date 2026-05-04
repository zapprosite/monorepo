import { BaseTable } from '@backend/db/base_table';

export class MaintenanceChecklistTable extends BaseTable {
	readonly table = 'maintenance_checklist';

	// @ts-ignore TS2742 — pqb internal type inference not portable
	columns = this.setColumns((t) => ({
		id: t.uuid().primaryKey().default(t.sql`gen_random_uuid()`),
		scheduleId: t.uuid().foreignKey('maintenance_schedules', 'id', {
			onUpdate: 'RESTRICT',
			onDelete: 'CASCADE',
		}),
		temperaturaAmbiente: t.decimal(5, 2).nullable(),
		temperaturaInsuflada: t.decimal(5, 2).nullable(),
		pressaoSuccao: t.decimal(5, 2).nullable(),
		pressaoDescarga: t.decimal(5, 2).nullable(),
		amperagemCompressor: t.decimal(5, 2).nullable(),
		nivelGasRefrigerante: t.enum('nivel_gas_enum', ['normal', 'baixo', 'vazio']).nullable(),
		estadoFiltros: t.enum('estado_filtros_enum', ['limpo', 'sujo', 'trocado']).nullable(),
		limpezaSerpentina: t.boolean().default(false),
		funcionamentoDreno: t.boolean().default(false),
		vazamentos: t.enum('vazamentos_enum', ['nenhum', 'pequeno', 'grave']).nullable(),
		observacoes: t.text().nullable(),
		photos: t.json().default([]),
		technicianSignature: t.text().nullable(),
		clientSignature: t.text().nullable(),
		completedAt: t.timestamp().nullable(),
		...t.timestamps(),
	}));
}
