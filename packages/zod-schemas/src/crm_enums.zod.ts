import z from 'zod';

export const LEAD_STATUS_ENUM = [
	'Novo',
	'Contato',
	'Qualificado',
	'Proposta',
	'Negociação',
	'Ganho',
	'Perdido',
] as const;
export const leadStatusZod = z.enum(LEAD_STATUS_ENUM);
export type LeadStatus = z.infer<typeof leadStatusZod>;

export const LEAD_SOURCE_ENUM = [
	'Indicação',
	'Site',
	'Redes Sociais',
	'Telefone',
	'Email',
	'Evento',
	'Outro',
] as const;
export const leadSourceZod = z.enum(LEAD_SOURCE_ENUM);
export type LeadSource = z.infer<typeof leadSourceZod>;

export const CLIENT_TYPE_ENUM = ['Pessoa Física', 'Pessoa Jurídica'] as const;
export const clientTypeZod = z.enum(CLIENT_TYPE_ENUM);
export type ClientType = z.infer<typeof clientTypeZod>;

export const EQUIPMENT_STATUS_ENUM = ['Ativo', 'Em Manutenção', 'Inativo', 'Desativado'] as const;
export const equipmentStatusZod = z.enum(EQUIPMENT_STATUS_ENUM);
export type EquipmentStatus = z.infer<typeof equipmentStatusZod>;

export const SCHEDULE_STATUS_ENUM = [
	'Agendado',
	'Confirmado',
	'Em Andamento',
	'Concluído',
	'Cancelado',
] as const;
export const scheduleStatusZod = z.enum(SCHEDULE_STATUS_ENUM);
export type ScheduleStatus = z.infer<typeof scheduleStatusZod>;

export const SERVICE_TYPE_ENUM = [
	'Instalação',
	'Manutenção Preventiva',
	'Manutenção Corretiva',
	'Limpeza',
	'Recarga de Gás',
	'Visita Técnica',
] as const;
export const serviceTypeZod = z.enum(SERVICE_TYPE_ENUM);
export type ServiceType = z.infer<typeof serviceTypeZod>;

export const CONTRACT_STATUS_ENUM = [
	'Rascunho',
	'Ativo',
	'Suspenso',
	'Encerrado',
	'Cancelado',
] as const;
export const contractStatusZod = z.enum(CONTRACT_STATUS_ENUM);
export type ContractStatus = z.infer<typeof contractStatusZod>;

export const CONTRACT_TYPE_ENUM = ['Comercial', 'PMOC', 'Residencial'] as const;
export const contractTypeZod = z.enum(CONTRACT_TYPE_ENUM);
export type ContractType = z.infer<typeof contractTypeZod>;

export const CONTRACT_FREQUENCY_ENUM = [
	'Mensal',
	'Bimestral',
	'Trimestral',
	'Semestral',
	'Anual',
] as const;
export const contractFrequencyZod = z.enum(CONTRACT_FREQUENCY_ENUM);
export type ContractFrequency = z.infer<typeof contractFrequencyZod>;

export const EDITORIAL_STATUS_ENUM = [
	'Ideia',
	'Em Produção',
	'Revisão',
	'Aprovado',
	'Publicado',
	'Cancelado',
] as const;
export const editorialStatusZod = z.enum(EDITORIAL_STATUS_ENUM);
export type EditorialStatus = z.infer<typeof editorialStatusZod>;

export const EDITORIAL_CHANNEL_ENUM = [
	'Instagram',
	'Facebook',
	'LinkedIn',
	'TikTok',
	'YouTube',
	'Blog',
	'Email',
	'WhatsApp',
] as const;
export const editorialChannelZod = z.enum(EDITORIAL_CHANNEL_ENUM);
export type EditorialChannel = z.infer<typeof editorialChannelZod>;

export const EDITORIAL_FORMAT_ENUM = [
	'Post',
	'Carrossel',
	'Reels',
	'Story',
	'Blog Post',
	'Email',
	'Vídeo',
	'Newsletter',
] as const;
export const editorialFormatZod = z.enum(EDITORIAL_FORMAT_ENUM);
export type EditorialFormat = z.infer<typeof editorialFormatZod>;

export const REMINDER_TYPE_ENUM = [
	'Ligação',
	'Email',
	'Visita',
	'Manutenção',
	'Renovação',
] as const;
export const reminderTypeZod = z.enum(REMINDER_TYPE_ENUM);
export type ReminderType = z.infer<typeof reminderTypeZod>;

export const REMINDER_STATUS_ENUM = ['Pendente', 'Concluído', 'Cancelado'] as const;
export const reminderStatusZod = z.enum(REMINDER_STATUS_ENUM);
export type ReminderStatus = z.infer<typeof reminderStatusZod>;

export const USER_ROLE_ENUM = [
	'Admin',
	'Gestor',
	'Comercial',
	'Marketing',
	'Tecnico',
	'Atendimento',
	'Financeiro',
] as const;
export const userRoleZod = z.enum(USER_ROLE_ENUM);
export type UserRole = z.infer<typeof userRoleZod>;

export const ADDRESS_TYPE_ENUM = ['Cobrança', 'Entrega', 'Técnica'] as const;
export const addressTypeZod = z.enum(ADDRESS_TYPE_ENUM);
export type AddressType = z.infer<typeof addressTypeZod>;

export const SERVICE_ORDER_STATUS_ENUM = [
	'Aberta',
	'Em Andamento',
	'Aguardando Peças',
	'Concluída',
	'Cancelada',
] as const;
export const serviceOrderStatusZod = z.enum(SERVICE_ORDER_STATUS_ENUM);
export type ServiceOrderStatus = z.infer<typeof serviceOrderStatusZod>;

export const KANBAN_CARD_PRIORITY_ENUM = ['Baixa', 'Media', 'Alta', 'Critica'] as const;
export const kanbanCardPriorityZod = z.enum(KANBAN_CARD_PRIORITY_ENUM);
export type KanbanCardPriority = z.infer<typeof kanbanCardPriorityZod>;

export const KANBAN_CARD_STATUS_ENUM = [
	'Aberto',
	'Em Andamento',
	'Bloqueado',
	'Concluido',
	'Cancelado',
] as const;
export const kanbanCardStatusZod = z.enum(KANBAN_CARD_STATUS_ENUM);
export type KanbanCardStatus = z.infer<typeof kanbanCardStatusZod>;

// Slice 10 - Maintenance Planning
export const TIPO_EQUIPAMENTO_ENUM = [
	'ar-condicionado',
	'refrigerador',
	'freezer',
	'climatizador',
] as const;
export const tipoEquipamentoZod = z.enum(TIPO_EQUIPAMENTO_ENUM);
export type TipoEquipamento = z.infer<typeof tipoEquipamentoZod>;

export const STATUS_MANUTENCAO_ENUM = [
	'agendada',
	'em-progresso',
	'concluida',
	'cancelada',
	'adiada',
] as const;
export const statusManutencaoZod = z.enum(STATUS_MANUTENCAO_ENUM);
export type StatusManutencao = z.infer<typeof statusManutencaoZod>;

// Slice 11 - Loyalty / Fidelization
export const NIVEL_FIDELIDADE_ENUM = ['bronze', 'prata', 'ouro', 'platinum'] as const;
export const nivelFidelidadeZod = z.enum(NIVEL_FIDELIDADE_ENUM);
export type NivelFidelidade = z.infer<typeof nivelFidelidadeZod>;

export const STATUS_REATIVACAO_ENUM = [
	'ativo',
	'risco-30d',
	'risco-60d',
	'risco-90d',
	'perdido',
] as const;
export const statusReativacaoZod = z.enum(STATUS_REATIVACAO_ENUM);
export type StatusReativacao = z.infer<typeof statusReativacaoZod>;

// Slice 12 - Email Marketing
export const TIPO_CAMPANHA_ENUM = [
	'marketing',
	'reativacao',
	'newsletter',
	'promocional',
	'transacional',
] as const;
export const tipoCampanhaZod = z.enum(TIPO_CAMPANHA_ENUM);
export type TipoCampanha = z.infer<typeof tipoCampanhaZod>;

export const STATUS_CAMPANHA_ENUM = [
	'rascunho',
	'agendada',
	'enviando',
	'enviada',
	'cancelada',
] as const;
export const statusCampanhaZod = z.enum(STATUS_CAMPANHA_ENUM);
export type StatusCampanha = z.infer<typeof statusCampanhaZod>;

export const CATEG_TEMPLATE_ENUM = [
	'bem-vindo',
	'reativacao',
	'promocional',
	'newsletter',
	'confirmacao',
] as const;
export const categTemplateZod = z.enum(CATEG_TEMPLATE_ENUM);
export type CategTemplate = z.infer<typeof categTemplateZod>;

// Slice 13 - Webhooks & Events
export const EVENTO_TIPO_ENUM = [
	'manutencao.agendada',
	'manutencao.concluida',
	'fidelidade.nivel-alterado',
	'fidelidade.risco-deteccao',
	'campanha.enviada',
	'campanha.aberta',
] as const;
export const eventoTipoZod = z.enum(EVENTO_TIPO_ENUM);
export type EventoTipo = z.infer<typeof eventoTipoZod>;

export const WEBHOOK_STATUS_ENUM = [
	'pendente',
	'enviado',
	'falha-retry',
	'falha-definitiva',
	'cancelado',
] as const;
export const webhookStatusZod = z.enum(WEBHOOK_STATUS_ENUM);
export type WebhookStatus = z.infer<typeof webhookStatusZod>;

export const WEBHOOK_EVENTO_TIPO_ENUM = [
	'maintenance.scheduled',
	'loyalty.tier_changed',
	'loyalty.reactivation_triggered',
	'campaign.sent',
	'campaign.opened',
	'campaign.clicked',
] as const;
export const webhookEventoTipoZod = z.enum(WEBHOOK_EVENTO_TIPO_ENUM);
export type WebhookEventoTipo = z.infer<typeof webhookEventoTipoZod>;

// Slice 14 - MCP Connectors
export const MCP_PROVIDER_ENUM = ['claude', 'anthropic', 'make', 'zapier'] as const;
export const mcpProviderZod = z.enum(MCP_PROVIDER_ENUM);
export type McpProvider = z.infer<typeof mcpProviderZod>;

export const MCP_CONECTAR_STATUS_ENUM = ['ativo', 'inativo', 'erro', 'pendente'] as const;
export const mcpConectarStatusZod = z.enum(MCP_CONECTAR_STATUS_ENUM);
export type McpConectarStatus = z.infer<typeof mcpConectarStatusZod>;

// Slice 15 - Content Engine
export const CONTEUDO_TIPO_ENUM = [
	'blog-post',
	'faq',
	'landing-page',
	'guia-usuario',
	'case-study',
] as const;
export const conteudoTipoZod = z.enum(CONTEUDO_TIPO_ENUM);
export type ConteudoTipo = z.infer<typeof conteudoTipoZod>;

export const CONTEUDO_STATUS_ENUM = [
	'rascunho',
	'revisao',
	'aprovado',
	'publicado',
	'arquivado',
] as const;
export const conteudoStatusZod = z.enum(CONTEUDO_STATUS_ENUM);
export type ConteudoStatus = z.infer<typeof conteudoStatusZod>;
