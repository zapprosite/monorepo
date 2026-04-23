import { Chip } from "@connected-repo/ui-mui/data-display/Chip";
import type { ServiceOrderStatus } from "@repo/zod-schemas/crm_enums.zod";

const STATUS_COLOR: Record<
	ServiceOrderStatus,
	"default" | "primary" | "secondary" | "success" | "error" | "warning" | "info"
> = {
	Aberta: "info",
	"Em Andamento": "warning",
	"Aguardando Peças": "default",
	Concluída: "success",
	Cancelada: "error",
};

interface ServiceOrderStatusBadgeProps {
	status: ServiceOrderStatus;
}

export function ServiceOrderStatusBadge({ status }: ServiceOrderStatusBadgeProps) {
	return <Chip label={status} color={STATUS_COLOR[status]} size="small" sx={{ fontWeight: 500 }} />;
}
