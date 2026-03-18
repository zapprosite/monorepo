import { Chip } from "@connected-repo/ui-mui/data-display/Chip";
import type { EditorialStatus } from "@connected-repo/zod-schemas/crm_enums.zod";

const STATUS_COLOR: Record<
	EditorialStatus,
	"default" | "primary" | "secondary" | "success" | "error" | "warning" | "info"
> = {
	Ideia: "default",
	"Em Produção": "warning",
	Revisão: "info",
	Aprovado: "primary",
	Publicado: "success",
	Cancelado: "error",
};

interface EditorialStatusBadgeProps {
	status: EditorialStatus;
}

export function EditorialStatusBadge({ status }: EditorialStatusBadgeProps) {
	return (
		<Chip
			label={status}
			color={STATUS_COLOR[status]}
			size="small"
			sx={{ fontWeight: 500 }}
		/>
	);
}
