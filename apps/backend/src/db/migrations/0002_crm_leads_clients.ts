import { change } from '../db_script';

change(async (db) => {
  await db.createEnum('public.crm_lead_status_enum', [
    'Novo', 'Contato', 'Qualificado', 'Proposta', 'Negociação', 'Ganho', 'Perdido',
  ]);

  await db.createEnum('public.crm_lead_source_enum', [
    'Indicação', 'Site', 'Redes Sociais', 'Telefone', 'Email', 'Evento', 'Outro',
  ]);

  await db.createEnum('public.crm_client_type_enum', [
    'Pessoa Física', 'Pessoa Jurídica',
  ]);

  await db.createEnum('public.crm_address_type_enum', [
    'Cobrança', 'Entrega', 'Técnica',
  ]);

  await db.createTable(
    'leads',
    (t) => ({
      leadId: t.uuid().primaryKey().default(t.sql`gen_random_uuid()`),
      nome: t.string(255),
      email: t.string().nullable(),
      telefone: t.string(30).nullable(),
      origem: t.enum('crm_lead_source_enum'),
      canal: t.string(100).nullable(),
      status: t.enum('crm_lead_status_enum'),
      responsavelId: t.uuid().nullable(),
      observacoes: t.text().nullable(),
      convertidoClienteId: t.uuid().nullable(),
      createdAt: t.timestamps().createdAt,
      updatedAt: t.timestamps().updatedAt,
    }),
    (t) => [
      t.index(['status']),
      t.index(['responsavelId']),
    ],
  );

  await db.createTable(
    'clients',
    (t) => ({
      clientId: t.uuid().primaryKey().default(t.sql`gen_random_uuid()`),
      nome: t.string(255),
      tipo: t.enum('crm_client_type_enum'),
      email: t.string().nullable(),
      telefone: t.string(30).nullable(),
      cpfCnpj: t.string(18).nullable(),
      responsavelId: t.uuid().nullable(),
      tags: t.array(t.string()).nullable(),
      ativo: t.boolean().default(true),
      createdAt: t.timestamps().createdAt,
      updatedAt: t.timestamps().updatedAt,
    }),
    (t) => [
      t.index(['tipo']),
      t.index(['responsavelId']),
    ],
  );

  await db.createTable(
    'contacts',
    (t) => ({
      contactId: t.uuid().primaryKey().default(t.sql`gen_random_uuid()`),
      clienteId: t.uuid().foreignKey('clients', 'clientId', {
        onUpdate: 'RESTRICT',
        onDelete: 'CASCADE',
      }),
      nome: t.string(255),
      email: t.string().nullable(),
      telefone: t.string(30).nullable(),
      cargo: t.string(100).nullable(),
      isPrimary: t.boolean().default(false),
      createdAt: t.timestamps().createdAt,
      updatedAt: t.timestamps().updatedAt,
    }),
    (t) => [t.index(['clienteId'])],
  );

  await db.createTable(
    'addresses',
    (t) => ({
      addressId: t.uuid().primaryKey().default(t.sql`gen_random_uuid()`),
      clienteId: t.uuid().foreignKey('clients', 'clientId', {
        onUpdate: 'RESTRICT',
        onDelete: 'CASCADE',
      }),
      tipo: t.enum('crm_address_type_enum').nullable(),
      rua: t.string(255),
      numero: t.string(20),
      complemento: t.string(100).nullable(),
      bairro: t.string(100),
      cep: t.string(9),
      cidade: t.string(100),
      estado: t.string(2),
      createdAt: t.timestamps().createdAt,
      updatedAt: t.timestamps().updatedAt,
    }),
    (t) => [t.index(['clienteId'])],
  );
});
