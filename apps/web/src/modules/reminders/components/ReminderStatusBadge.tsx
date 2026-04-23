import { Chip } from "@connected-repo/ui-mui/data-display/Chip";
import type { ReminderStatus } from "@repo/zod-schemas/crm_enums.zod";

const STATUS_COLOR: Record<
	ReminderStatus,
	"default" | "primary" | "secondary" | "success" | "error" | "warning" | "info"
> = {
	Pendente: "warning",
	Concluído: "success",
	Cancelado: "error",
};

interface ReminderStatusBadgeProps {
	status: ReminderStatus;
}

export function ReminderStatusBadge({ status }: ReminderStatusBadgeProps) {
	return <Chip label={status} color={STATUS_COLOR[status]} size="small" sx={{ fontWeight: 500 }} />;
}
