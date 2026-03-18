import { change } from '../db_script';

change(async (db) => {
  await db.createEnum('public.crm_editorial_status_enum', [
    'Ideia', 'Em Produção', 'Revisão', 'Aprovado', 'Publicado', 'Cancelado',
  ]);

  await db.createEnum('public.crm_editorial_channel_enum', [
    'Instagram', 'Facebook', 'LinkedIn', 'TikTok', 'YouTube', 'Blog', 'Email', 'WhatsApp',
  ]);

  await db.createEnum('public.crm_editorial_format_enum', [
    'Post', 'Carrossel', 'Reels', 'Story', 'Blog Post', 'Email', 'Vídeo', 'Newsletter',
  ]);

  await db.createTable(
    'editorial_calendar_items',
    (t) => ({
      editorialId: t.uuid().primaryKey().default(t.sql`gen_random_uuid()`),
      titulo: t.varchar(255),
      canal: t.enum('crm_editorial_channel_enum'),
      formato: t.enum('crm_editorial_format_enum'),
      status: t.enum('crm_editorial_status_enum'),
      dataPublicacao: t.date(),
      pauta: t.text().nullable(),
      copy: t.text().nullable(),
      cta: t.varchar(255).nullable(),
      observacoes: t.text().nullable(),
      campanhaId: t.uuid().nullable(),
      createdAt: t.timestamps().createdAt,
      updatedAt: t.timestamps().updatedAt,
    }),
    (t) => [
      t.index(['status']),
      t.index(['canal']),
      t.index(['dataPublicacao']),
    ],
  );
});
