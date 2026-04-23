import { Chip } from "@connected-repo/ui-mui/data-display/Chip";
import type { LeadStatus } from "@repo/zod-schemas/crm_enums.zod";

const STATUS_COLOR: Record<
	LeadStatus,
	"default" | "primary" | "secondary" | "success" | "error" | "warning" | "info"
> = {
	Novo: "default",
	Contato: "info",
	Qualificado: "primary",
	Proposta: "secondary",
	Negociação: "warning",
	Ganho: "success",
	Perdido: "error",
};

interface LeadStatusBadgeProps {
	status: LeadStatus;
}

export function LeadStatusBadge({ status }: LeadStatusBadgeProps) {
	return <Chip label={status} color={STATUS_COLOR[status]} size="small" sx={{ fontWeight: 500 }} />;
}
