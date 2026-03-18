import z from "zod";

export const LEAD_STATUS_ENUM = ["Novo", "Contato", "Qualificado", "Proposta", "Negociação", "Ganho", "Perdido"] as const;
export const leadStatusZod = z.enum(LEAD_STATUS_ENUM);
export type LeadStatus = z.infer<typeof leadStatusZod>;

export const LEAD_SOURCE_ENUM = ["Indicação", "Site", "Redes Sociais", "Telefone", "Email", "Evento", "Outro"] as const;
export const leadSourceZod = z.enum(LEAD_SOURCE_ENUM);
export type LeadSource = z.infer<typeof leadSourceZod>;

export const CLIENT_TYPE_ENUM = ["Pessoa Física", "Pessoa Jurídica"] as const;
export const clientTypeZod = z.enum(CLIENT_TYPE_ENUM);
export type ClientType = z.infer<typeof clientTypeZod>;

export const EQUIPMENT_STATUS_ENUM = ["Ativo", "Em Manutenção", "Inativo", "Desativado"] as const;
export const equipmentStatusZod = z.enum(EQUIPMENT_STATUS_ENUM);
export type EquipmentStatus = z.infer<typeof equipmentStatusZod>;

export const SCHEDULE_STATUS_ENUM = ["Agendado", "Confirmado", "Em Andamento", "Concluído", "Cancelado"] as const;
export const scheduleStatusZod = z.enum(SCHEDULE_STATUS_ENUM);
export type ScheduleStatus = z.infer<typeof scheduleStatusZod>;

export const SERVICE_TYPE_ENUM = ["Instalação", "Manutenção Preventiva", "Manutenção Corretiva", "Limpeza", "Recarga de Gás", "Visita Técnica"] as const;
export const serviceTypeZod = z.enum(SERVICE_TYPE_ENUM);
export type ServiceType = z.infer<typeof serviceTypeZod>;

export const CONTRACT_STATUS_ENUM = ["Rascunho", "Ativo", "Suspenso", "Encerrado", "Cancelado"] as const;
export const contractStatusZod = z.enum(CONTRACT_STATUS_ENUM);
export type ContractStatus = z.infer<typeof contractStatusZod>;

export const CONTRACT_TYPE_ENUM = ["Comercial", "PMOC", "Residencial"] as const;
export const contractTypeZod = z.enum(CONTRACT_TYPE_ENUM);
export type ContractType = z.infer<typeof contractTypeZod>;

export const CONTRACT_FREQUENCY_ENUM = ["Mensal", "Bimestral", "Trimestral", "Semestral", "Anual"] as const;
export const contractFrequencyZod = z.enum(CONTRACT_FREQUENCY_ENUM);
export type ContractFrequency = z.infer<typeof contractFrequencyZod>;

export const EDITORIAL_STATUS_ENUM = ["Ideia", "Em Produção", "Revisão", "Aprovado", "Publicado", "Cancelado"] as const;
export const editorialStatusZod = z.enum(EDITORIAL_STATUS_ENUM);
export type EditorialStatus = z.infer<typeof editorialStatusZod>;

export const EDITORIAL_CHANNEL_ENUM = ["Instagram", "Facebook", "LinkedIn", "TikTok", "YouTube", "Blog", "Email", "WhatsApp"] as const;
export const editorialChannelZod = z.enum(EDITORIAL_CHANNEL_ENUM);
export type EditorialChannel = z.infer<typeof editorialChannelZod>;

export const EDITORIAL_FORMAT_ENUM = ["Post", "Carrossel", "Reels", "Story", "Blog Post", "Email", "Vídeo", "Newsletter"] as const;
export const editorialFormatZod = z.enum(EDITORIAL_FORMAT_ENUM);
export type EditorialFormat = z.infer<typeof editorialFormatZod>;

export const REMINDER_TYPE_ENUM = ["Ligação", "Email", "Visita", "Manutenção", "Renovação"] as const;
export const reminderTypeZod = z.enum(REMINDER_TYPE_ENUM);
export type ReminderType = z.infer<typeof reminderTypeZod>;

export const REMINDER_STATUS_ENUM = ["Pendente", "Concluído", "Cancelado"] as const;
export const reminderStatusZod = z.enum(REMINDER_STATUS_ENUM);
export type ReminderStatus = z.infer<typeof reminderStatusZod>;

export const ADDRESS_TYPE_ENUM = ["Cobrança", "Entrega", "Técnica"] as const;
export const addressTypeZod = z.enum(ADDRESS_TYPE_ENUM);
export type AddressType = z.infer<typeof addressTypeZod>;

export const SERVICE_ORDER_STATUS_ENUM = ["Aberta", "Em Andamento", "Aguardando Peças", "Concluída", "Cancelada"] as const;
export const serviceOrderStatusZod = z.enum(SERVICE_ORDER_STATUS_ENUM);
export type ServiceOrderStatus = z.infer<typeof serviceOrderStatusZod>;
