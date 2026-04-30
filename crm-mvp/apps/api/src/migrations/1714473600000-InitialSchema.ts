import { MigrationInterface, QueryRunner, Table, TableIndex, TableForeignKey } from 'typeorm';

export class InitialSchema1714473600000 implements MigrationInterface {
  name = 'InitialSchema1714473600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // teams
    await queryRunner.createTable(
      new Table({
        name: 'teams',
        columns: [
          { name: 'id', type: 'uuid', isPrimary: true, generationStrategy: 'uuid', default: 'uuid_generate_v4()' },
          { name: 'name', type: 'varchar', length: '255' },
          { name: 'slug', type: 'varchar', length: '100', isUnique: true },
          { name: 'createdAt', type: 'timestamptz', default: 'now()' },
        ],
      }),
      true,
    );

    // users
    await queryRunner.createTable(
      new Table({
        name: 'users',
        columns: [
          { name: 'id', type: 'uuid', isPrimary: true, generationStrategy: 'uuid', default: 'uuid_generate_v4()' },
          { name: 'email', type: 'varchar', length: '255', isUnique: true },
          { name: 'name', type: 'varchar', length: '255' },
          { name: 'avatar', type: 'varchar', length: '500', isNullable: true },
          { name: 'teamId', type: 'uuid', isNullable: true },
          { name: 'createdAt', type: 'timestamptz', default: 'now()' },
        ],
      }),
      true,
    );
    await queryRunner.createIndex('users', new TableIndex({ name: 'IDX_USERS_EMAIL', columnNames: ['email'] }));
    await queryRunner.createForeignKey(
      'users',
      new TableForeignKey({
        name: 'FK_USERS_TEAM',
        columnNames: ['teamId'],
        referencedTableName: 'teams',
        referencedColumnNames: ['id'],
        onDelete: 'SET NULL',
      }),
    );

    // sessions
    await queryRunner.createTable(
      new Table({
        name: 'sessions',
        columns: [
          { name: 'id', type: 'uuid', isPrimary: true, generationStrategy: 'uuid', default: 'uuid_generate_v4()' },
          { name: 'userId', type: 'uuid' },
          { name: 'token', type: 'varchar', length: '512' },
          { name: 'expiresAt', type: 'timestamptz' },
          { name: 'createdAt', type: 'timestamptz', default: 'now()' },
        ],
      }),
      true,
    );
    await queryRunner.createForeignKey(
      'sessions',
      new TableForeignKey({
        name: 'FK_SESSIONS_USER',
        columnNames: ['userId'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );

    // clients
    await queryRunner.createTable(
      new Table({
        name: 'clients',
        columns: [
          { name: 'id', type: 'uuid', isPrimary: true, generationStrategy: 'uuid', default: 'uuid_generate_v4()' },
          { name: 'name', type: 'varchar', length: '255' },
          { name: 'type', type: 'enum', enum: ['pf', 'pj'], default: "'pf'" },
          { name: 'document', type: 'varchar', length: '20', isNullable: true },
          { name: 'email', type: 'varchar', length: '255', isNullable: true },
          { name: 'phone', type: 'varchar', length: '50', isNullable: true },
          { name: 'address', type: 'text', isNullable: true },
          { name: 'tags', type: 'text', isNullable: true },
          { name: 'status', type: 'enum', enum: ['ativo', 'inativo'], default: "'ativo'" },
          { name: 'teamId', type: 'uuid', isNullable: true },
          { name: 'createdAt', type: 'timestamptz', default: 'now()' },
        ],
      }),
      true,
    );
    await queryRunner.createIndex('clients', new TableIndex({ name: 'IDX_CLIENTS_NAME', columnNames: ['name'] }));
    await queryRunner.createIndex('clients', new TableIndex({ name: 'IDX_CLIENTS_STATUS', columnNames: ['status'] }));
    await queryRunner.createForeignKey(
      'clients',
      new TableForeignKey({
        name: 'FK_CLIENTS_TEAM',
        columnNames: ['teamId'],
        referencedTableName: 'teams',
        referencedColumnNames: ['id'],
        onDelete: 'SET NULL',
      }),
    );

    // leads
    await queryRunner.createTable(
      new Table({
        name: 'leads',
        columns: [
          { name: 'id', type: 'uuid', isPrimary: true, generationStrategy: 'uuid', default: 'uuid_generate_v4()' },
          { name: 'name', type: 'varchar', length: '255' },
          { name: 'email', type: 'varchar', length: '255', isNullable: true },
          { name: 'phone', type: 'varchar', length: '50', isNullable: true },
          { name: 'source', type: 'varchar', length: '100', isNullable: true },
          { name: 'status', type: 'enum', enum: ['novo', 'contato', 'qualificado', 'proposta', 'negociacao', 'ganho', 'perdido'], default: "'novo'" },
          { name: 'responsibleId', type: 'uuid', isNullable: true },
          { name: 'estimatedValue', type: 'decimal', precision: 14, scale: 2, isNullable: true, default: '0' },
          { name: 'notes', type: 'text', isNullable: true },
          { name: 'convertedToClientId', type: 'uuid', isNullable: true },
          { name: 'teamId', type: 'uuid', isNullable: true },
          { name: 'createdAt', type: 'timestamptz', default: 'now()' },
        ],
      }),
      true,
    );
    await queryRunner.createIndex('leads', new TableIndex({ name: 'IDX_LEADS_STATUS', columnNames: ['status'] }));
    await queryRunner.createIndex('leads', new TableIndex({ name: 'IDX_LEADS_SOURCE', columnNames: ['source'] }));
    await queryRunner.createForeignKey(
      'leads',
      new TableForeignKey({
        name: 'FK_LEADS_RESPONSIBLE',
        columnNames: ['responsibleId'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
        onDelete: 'SET NULL',
      }),
    );
    await queryRunner.createForeignKey(
      'leads',
      new TableForeignKey({
        name: 'FK_LEADS_CLIENT',
        columnNames: ['convertedToClientId'],
        referencedTableName: 'clients',
        referencedColumnNames: ['id'],
        onDelete: 'SET NULL',
      }),
    );
    await queryRunner.createForeignKey(
      'leads',
      new TableForeignKey({
        name: 'FK_LEADS_TEAM',
        columnNames: ['teamId'],
        referencedTableName: 'teams',
        referencedColumnNames: ['id'],
        onDelete: 'SET NULL',
      }),
    );

    // schedules
    await queryRunner.createTable(
      new Table({
        name: 'schedules',
        columns: [
          { name: 'id', type: 'uuid', isPrimary: true, generationStrategy: 'uuid', default: 'uuid_generate_v4()' },
          { name: 'clientId', type: 'uuid' },
          { name: 'dateTime', type: 'timestamptz' },
          { name: 'type', type: 'enum', enum: ['instalacao', 'manutencao', 'visita_tecnica', 'emergencia'] },
          { name: 'technicianId', type: 'uuid', isNullable: true },
          { name: 'status', type: 'enum', enum: ['agendado', 'confirmado', 'em_andamento', 'concluido', 'cancelado'], default: "'agendado'" },
          { name: 'notes', type: 'text', isNullable: true },
          { name: 'teamId', type: 'uuid', isNullable: true },
          { name: 'createdAt', type: 'timestamptz', default: 'now()' },
        ],
      }),
      true,
    );
    await queryRunner.createIndex('schedules', new TableIndex({ name: 'IDX_SCHEDULES_DATETIME', columnNames: ['dateTime'] }));
    await queryRunner.createIndex('schedules', new TableIndex({ name: 'IDX_SCHEDULES_STATUS', columnNames: ['status'] }));
    await queryRunner.createForeignKey(
      'schedules',
      new TableForeignKey({
        name: 'FK_SCHEDULES_CLIENT',
        columnNames: ['clientId'],
        referencedTableName: 'clients',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );
    await queryRunner.createForeignKey(
      'schedules',
      new TableForeignKey({
        name: 'FK_SCHEDULES_TECHNICIAN',
        columnNames: ['technicianId'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
        onDelete: 'SET NULL',
      }),
    );
    await queryRunner.createForeignKey(
      'schedules',
      new TableForeignKey({
        name: 'FK_SCHEDULES_TEAM',
        columnNames: ['teamId'],
        referencedTableName: 'teams',
        referencedColumnNames: ['id'],
        onDelete: 'SET NULL',
      }),
    );

    // contracts
    await queryRunner.createTable(
      new Table({
        name: 'contracts',
        columns: [
          { name: 'id', type: 'uuid', isPrimary: true, generationStrategy: 'uuid', default: 'uuid_generate_v4()' },
          { name: 'clientId', type: 'uuid' },
          { name: 'type', type: 'enum', enum: ['comercial', 'manutencao', 'residencial'] },
          { name: 'value', type: 'decimal', precision: 14, scale: 2 },
          { name: 'frequency', type: 'enum', enum: ['mensal', 'trimestral', 'semestral', 'anual'] },
          { name: 'startDate', type: 'date' },
          { name: 'endDate', type: 'date' },
          { name: 'status', type: 'enum', enum: ['rascunho', 'ativo', 'suspenso', 'encerrado', 'cancelado'], default: "'rascunho'" },
          { name: 'teamId', type: 'uuid', isNullable: true },
          { name: 'createdAt', type: 'timestamptz', default: 'now()' },
        ],
      }),
      true,
    );
    await queryRunner.createIndex('contracts', new TableIndex({ name: 'IDX_CONTRACTS_STATUS', columnNames: ['status'] }));
    await queryRunner.createIndex('contracts', new TableIndex({ name: 'IDX_CONTRACTS_ENDDATE', columnNames: ['endDate'] }));
    await queryRunner.createForeignKey(
      'contracts',
      new TableForeignKey({
        name: 'FK_CONTRACTS_CLIENT',
        columnNames: ['clientId'],
        referencedTableName: 'clients',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );
    await queryRunner.createForeignKey(
      'contracts',
      new TableForeignKey({
        name: 'FK_CONTRACTS_TEAM',
        columnNames: ['teamId'],
        referencedTableName: 'teams',
        referencedColumnNames: ['id'],
        onDelete: 'SET NULL',
      }),
    );

    // reminders
    await queryRunner.createTable(
      new Table({
        name: 'reminders',
        columns: [
          { name: 'id', type: 'uuid', isPrimary: true, generationStrategy: 'uuid', default: 'uuid_generate_v4()' },
          { name: 'clientId', type: 'uuid' },
          { name: 'title', type: 'varchar', length: '255' },
          { name: 'type', type: 'enum', enum: ['ligacao', 'email', 'visita', 'renovacao'] },
          { name: 'dueDate', type: 'timestamptz' },
          { name: 'status', type: 'enum', enum: ['pendente', 'concluido', 'cancelado'], default: "'pendente'" },
          { name: 'teamId', type: 'uuid', isNullable: true },
          { name: 'createdAt', type: 'timestamptz', default: 'now()' },
        ],
      }),
      true,
    );
    await queryRunner.createIndex('reminders', new TableIndex({ name: 'IDX_REMINDERS_DUEDATE', columnNames: ['dueDate'] }));
    await queryRunner.createIndex('reminders', new TableIndex({ name: 'IDX_REMINDERS_STATUS', columnNames: ['status'] }));
    await queryRunner.createForeignKey(
      'reminders',
      new TableForeignKey({
        name: 'FK_REMINDERS_CLIENT',
        columnNames: ['clientId'],
        referencedTableName: 'clients',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );
    await queryRunner.createForeignKey(
      'reminders',
      new TableForeignKey({
        name: 'FK_REMINDERS_TEAM',
        columnNames: ['teamId'],
        referencedTableName: 'teams',
        referencedColumnNames: ['id'],
        onDelete: 'SET NULL',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('reminders', true, true, true);
    await queryRunner.dropTable('contracts', true, true, true);
    await queryRunner.dropTable('schedules', true, true, true);
    await queryRunner.dropTable('leads', true, true, true);
    await queryRunner.dropTable('clients', true, true, true);
    await queryRunner.dropTable('sessions', true, true, true);
    await queryRunner.dropTable('users', true, true, true);
    await queryRunner.dropTable('teams', true, true, true);
  }
}
