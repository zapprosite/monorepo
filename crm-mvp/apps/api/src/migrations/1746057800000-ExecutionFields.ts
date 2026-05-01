import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class ExecutionFields1746057800000 implements MigrationInterface {
  name = 'ExecutionFields1746057800000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'service_orders',
      new TableColumn({
        name: 'checklist',
        type: 'jsonb',
        isNullable: true,
      }),
    );

    await queryRunner.addColumn(
      'service_orders',
      new TableColumn({
        name: 'photos',
        type: 'jsonb',
        isNullable: true,
      }),
    );

    await queryRunner.addColumn(
      'service_orders',
      new TableColumn({
        name: 'signature',
        type: 'text',
        isNullable: true,
      }),
    );

    await queryRunner.addColumn(
      'service_orders',
      new TableColumn({
        name: 'executionStartedAt',
        type: 'timestamptz',
        isNullable: true,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('service_orders', 'executionStartedAt');
    await queryRunner.dropColumn('service_orders', 'signature');
    await queryRunner.dropColumn('service_orders', 'photos');
    await queryRunner.dropColumn('service_orders', 'checklist');
  }
}
