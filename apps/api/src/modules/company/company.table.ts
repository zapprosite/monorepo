import { BaseTable } from '@backend/db/base_table';
import { EQUIPMENT_STATUS_ENUM } from '@repo/zod-schemas/crm_enums.zod';

export class CompanyTable extends BaseTable {
  readonly table = 'company';

  // @ts-ignore TS2742 — pqb internal type inference not portable
  columns = this.setColumns((t) => ({
    id: t.uuid().primaryKey().default(t.sql`gen_random_uuid()`),
    teamId: t.uuid().foreignKey('teams', 'teamId', {
      onUpdate: 'RESTRICT',
      onDelete: 'CASCADE',
    }),
    name: t.string(255).nullable(),
    cnpj: t.string(20).nullable(),
    phone: t.string(20).nullable(),
    address: t.text().nullable(),
    logoUrl: t.string(500).nullable(),
    primaryColor: t.string(7).default('#39FF14'),
    secondaryColor: t.string(7).default('#0A0A0F'),
    ownerSignature: t.text().nullable(),
    createdAt: t.timestamp('created_at').defaultNow(),
    updatedAt: t.timestamp('updated_at').defaultNow(),
  }));
}