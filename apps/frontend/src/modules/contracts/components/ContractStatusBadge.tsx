import { Chip } from "@connected-repo/ui-mui/data-display/Chip";
import type { ContractStatus } from "@connected-repo/zod-schemas/crm_enums.zod";

const STATUS_COLOR: Record<
	ContractStatus,
	"default" | "primary" | "secondary" | "success" | "error" | "warning" | "info"
> = {
	Rascunho: "default",
	Ativo: "success",
	Suspenso: "warning",
	Encerrado: "info",
	Cancelado: "error",
};

interface ContractStatusBadgeProps {
	status: ContractStatus;
}

export function ContractStatusBadge({ status }: ContractStatusBadgeProps) {
	return (
		<Chip
			label={status}
			color={STATUS_COLOR[status]}
			size="small"
			sx={{ fontWeight: 500 }}
		/>
	);
}
