import { BaseTable } from '@backend/db/base_table';

export class MaintenanceChecklistTable extends BaseTable {
	readonly table = 'maintenance_checklist';

	// @ts-ignore TS2742 — pqb internal type inference not portable
	columns = this.setColumns((t) => ({
		id: t.uuid().primaryKey().default(t.sql`gen_random_uuid()`),
		scheduleId: t.uuid().foreignKey('maintenance_schedules', 'scheduleId', {
			onUpdate: 'RESTRICT',
			onDelete: 'CASCADE',
		}),
		temperaturaAmbiente: t.decimal('temperatura_ambiente').nullable(),
		temperaturaInsuflada: t.decimal('temperatura_insuflada').nullable(),
		pressaoSuccao: t.decimal('pressao_succao').nullable(),
		pressaoDescarga: t.decimal('pressao_descarga').nullable(),
		amperagemCompressor: t.decimal('amperagem_compressor').nullable(),
		nivelGasRefrigerante: t.enum('nivel_gas_enum', ['normal', 'baixo', 'vazio']).nullable(),
		estadoFiltros: t.enum('estado_filtros_enum', ['limpo', 'sujo', 'trocado']).nullable(),
		limpezaSerpentina: t.boolean('limpeza_serpentina').default(false),
		funcionamentoDreno: t.boolean('funcionamento_dreno').default(false),
		vazamentos: t.enum('vazamentos_enum', ['nenhum', 'pequeno', 'grave']).nullable(),
		observacoes: t.text().nullable(),
		photos: t.json('photos').default([]),
		technicianSignature: t.text('technician_signature').nullable(),
		clientSignature: t.text('client_signature').nullable(),
		completedAt: t.timestamp('completed_at').nullable(),
		...t.timestamps(),
	}));
}
