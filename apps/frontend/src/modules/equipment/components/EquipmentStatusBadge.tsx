import { Chip } from "@connected-repo/ui-mui/data-display/Chip";
import type { EquipmentStatus } from "@connected-repo/zod-schemas/crm_enums.zod";

const STATUS_COLOR: Record<
	EquipmentStatus,
	"default" | "primary" | "secondary" | "success" | "error" | "warning" | "info"
> = {
	Ativo: "success",
	"Em Manutenção": "warning",
	Inativo: "default",
	Desativado: "error",
};

interface EquipmentStatusBadgeProps {
	status: EquipmentStatus;
}

export function EquipmentStatusBadge({ status }: EquipmentStatusBadgeProps) {
	return (
		<Chip
			label={status}
			color={STATUS_COLOR[status]}
			size="small"
			sx={{ fontWeight: 500 }}
		/>
	);
}
