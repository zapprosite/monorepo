import { BaseTable } from '@backend/db/base_table';
import {
	SERVICE_ORDER_STATUS_ENUM,
	SERVICE_TYPE_ENUM,
} from '@repo/zod-schemas/crm_enums.zod';

export class ServiceOrderTable extends BaseTable {
	readonly table = 'service_orders';

	// @ts-ignore TS2742 — pqb internal type inference not portable
	columns = this.setColumns((t) => ({
		serviceOrderId: t.uuid().primaryKey().default(t.sql`gen_random_uuid()`),
		numero: t
			.varchar(50)
			.default(
				t.sql`'OS-' || to_char(now(), 'YYYYMMDD') || '-' || substr(gen_random_uuid()::text, 1, 8)`,
			),
		clienteId: t.uuid().foreignKey('clients', 'clientId', {
			onUpdate: 'RESTRICT',
			onDelete: 'RESTRICT',
		}).index(),
		scheduleId: t
			.uuid()
			.foreignKey('schedules', 'scheduleId', {
				onUpdate: 'RESTRICT',
				onDelete: 'SET NULL',
			})
			.nullable()
			.index(),
		unitId: t
			.uuid()
			.foreignKey('units', 'unitId', {
				onUpdate: 'RESTRICT',
				onDelete: 'SET NULL',
			})
			.nullable()
			.index(),
		equipmentId: t
			.uuid()
			.foreignKey('equipment', 'equipmentId', {
				onUpdate: 'RESTRICT',
				onDelete: 'SET NULL',
			})
			.nullable()
			.index(),
		tecnicoId: t.uuid().nullable().index(),
		tipo: t.enum('crm_service_type_enum', SERVICE_TYPE_ENUM),
		status: t.enum('crm_service_order_status_enum', SERVICE_ORDER_STATUS_ENUM),
		dataAbertura: t.timestamp(),
		dataFechamento: t.timestamp().nullable(),
		pdfUrl: t.text().nullable(),
		descricao: t.text().nullable(),
		observacoes: t.text().nullable(),
		...t.timestamps(),
	}));
}
