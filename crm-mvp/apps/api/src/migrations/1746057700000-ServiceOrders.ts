import { MigrationInterface, QueryRunner, Table, TableIndex, TableForeignKey } from 'typeorm';

export class ServiceOrders1746057700000 implements MigrationInterface {
  name = 'ServiceOrders1746057700000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'service_orders',
        columns: [
          { name: 'id', type: 'uuid', isPrimary: true, generationStrategy: 'uuid', default: 'uuid_generate_v4()' },
          { name: 'title', type: 'varchar', length: '255' },
          { name: 'description', type: 'text', isNullable: true },
          { name: 'clientId', type: 'uuid', isNullable: true },
          { name: 'equipamentoId', type: 'uuid', isNullable: true },
          { name: 'technicianId', type: 'uuid', isNullable: true },
          {
            name: 'type',
            type: 'enum',
            enum: ['instalacao', 'manutencao', 'reparo', 'visita_tecnica', 'emergencia'],
            default: "'manutencao'",
          },
          {
            name: 'priority',
            type: 'enum',
            enum: ['baixa', 'media', 'alta', 'urgente'],
            default: "'media'",
          },
          {
            name: 'status',
            type: 'enum',
            enum: ['orcamento', 'aprovada', 'em_andamento', 'concluida', 'cancelada'],
            default: "'orcamento'",
          },
          { name: 'scheduledDate', type: 'timestamptz', isNullable: true },
          { name: 'completedDate', type: 'timestamptz', isNullable: true },
          { name: 'cost', type: 'decimal', precision: 12, scale: 2, isNullable: true },
          { name: 'notes', type: 'text', isNullable: true },
          { name: 'teamId', type: 'uuid', isNullable: true },
          { name: 'createdAt', type: 'timestamptz', default: 'now()' },
        ],
      }),
      true,
    );

    await queryRunner.createIndex(
      'service_orders',
      new TableIndex({ name: 'IDX_SO_STATUS', columnNames: ['status'] }),
    );
    await queryRunner.createIndex(
      'service_orders',
      new TableIndex({ name: 'IDX_SO_TYPE', columnNames: ['type'] }),
    );
    await queryRunner.createIndex(
      'service_orders',
      new TableIndex({ name: 'IDX_SO_PRIORITY', columnNames: ['priority'] }),
    );
    await queryRunner.createIndex(
      'service_orders',
      new TableIndex({ name: 'IDX_SO_CLIENT', columnNames: ['clientId'] }),
    );
    await queryRunner.createIndex(
      'service_orders',
      new TableIndex({ name: 'IDX_SO_EQUIPAMENTO', columnNames: ['equipamentoId'] }),
    );
    await queryRunner.createIndex(
      'service_orders',
      new TableIndex({ name: 'IDX_SO_TECHNICIAN', columnNames: ['technicianId'] }),
    );

    await queryRunner.createForeignKey(
      'service_orders',
      new TableForeignKey({
        name: 'FK_SO_CLIENT',
        columnNames: ['clientId'],
        referencedTableName: 'clients',
        referencedColumnNames: ['id'],
        onDelete: 'SET NULL',
      }),
    );
    await queryRunner.createForeignKey(
      'service_orders',
      new TableForeignKey({
        name: 'FK_SO_EQUIPAMENTO',
        columnNames: ['equipamentoId'],
        referencedTableName: 'equipamentos',
        referencedColumnNames: ['id'],
        onDelete: 'SET NULL',
      }),
    );
    await queryRunner.createForeignKey(
      'service_orders',
      new TableForeignKey({
        name: 'FK_SO_TECHNICIAN',
        columnNames: ['technicianId'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
        onDelete: 'SET NULL',
      }),
    );
    await queryRunner.createForeignKey(
      'service_orders',
      new TableForeignKey({
        name: 'FK_SO_TEAM',
        columnNames: ['teamId'],
        referencedTableName: 'teams',
        referencedColumnNames: ['id'],
        onDelete: 'SET NULL',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('service_orders', true, true, true);
  }
}
