import { MigrationInterface, QueryRunner, Table, TableIndex, TableForeignKey } from 'typeorm';

export class EquipamentosSubdomain1746057600000 implements MigrationInterface {
  name = 'EquipamentosSubdomain1746057600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'equipamentos',
        columns: [
          { name: 'id', type: 'uuid', isPrimary: true, generationStrategy: 'uuid', default: 'uuid_generate_v4()' },
          { name: 'name', type: 'varchar', length: '255' },
          { name: 'serialNumber', type: 'varchar', length: '100', isNullable: true },
          {
            name: 'type',
            type: 'enum',
            enum: ['ar_condicionado', 'refrigerador', 'freezer', 'split', 'janela', 'de_chao', 'portatil', 'outro'],
            default: "'ar_condicionado'",
          },
          { name: 'brand', type: 'varchar', length: '100', isNullable: true },
          { name: 'model', type: 'varchar', length: '100', isNullable: true },
          { name: 'subdomain', type: 'varchar', length: '63', isUnique: true },
          {
            name: 'status',
            type: 'enum',
            enum: ['ativo', 'em_manutencao', 'inativo'],
            default: "'ativo'",
          },
          { name: 'installationDate', type: 'date', isNullable: true },
          { name: 'notes', type: 'text', isNullable: true },
          { name: 'teamId', type: 'uuid', isNullable: true },
          { name: 'createdAt', type: 'timestamptz', default: 'now()' },
        ],
      }),
      true,
    );
    await queryRunner.createIndex('equipamentos', new TableIndex({ name: 'IDX_EQUIPAMENTOS_SUBDOMAIN', columnNames: ['subdomain'] }));
    await queryRunner.createIndex('equipamentos', new TableIndex({ name: 'IDX_EQUIPAMENTOS_STATUS', columnNames: ['status'] }));
    await queryRunner.createIndex('equipamentos', new TableIndex({ name: 'IDX_EQUIPAMENTOS_NAME', columnNames: ['name'] }));
    await queryRunner.createForeignKey(
      'equipamentos',
      new TableForeignKey({
        name: 'FK_EQUIPAMENTOS_TEAM',
        columnNames: ['teamId'],
        referencedTableName: 'teams',
        referencedColumnNames: ['id'],
        onDelete: 'SET NULL',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('equipamentos', true, true, true);
  }
}
