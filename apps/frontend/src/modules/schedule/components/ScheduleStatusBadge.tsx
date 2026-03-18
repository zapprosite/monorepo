import { Chip } from "@connected-repo/ui-mui/data-display/Chip";
import type { ScheduleStatus } from "@connected-repo/zod-schemas/crm_enums.zod";

const STATUS_COLOR: Record<
	ScheduleStatus,
	"default" | "primary" | "secondary" | "success" | "error" | "warning" | "info"
> = {
	Agendado: "default",
	Confirmado: "info",
	"Em Andamento": "warning",
	Concluído: "success",
	Cancelado: "error",
};

interface ScheduleStatusBadgeProps {
	status: ScheduleStatus;
}

export function ScheduleStatusBadge({ status }: ScheduleStatusBadgeProps) {
	return (
		<Chip
			label={status}
			color={STATUS_COLOR[status]}
			size="small"
			sx={{ fontWeight: 500 }}
		/>
	);
}
