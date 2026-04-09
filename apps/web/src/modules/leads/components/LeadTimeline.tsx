import { Typography } from "@connected-repo/ui-mui/data-display/Typography";
import { Box } from "@connected-repo/ui-mui/layout/Box";
import { Paper } from "@connected-repo/ui-mui/layout/Paper";
import type { LeadSelectAll } from "@connected-repo/zod-schemas/lead.zod";

interface LeadTimelineProps {
	lead: LeadSelectAll;
}

export function LeadTimeline({ lead }: LeadTimelineProps) {
	return (
		<Paper
			elevation={0}
			sx={{
				border: "1px solid",
				borderColor: "divider",
				borderRadius: 2,
				p: 3,
			}}
		>
			<Typography variant="h6" fontWeight={600} mb={2}>
				Histórico
			</Typography>
			<Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
				<Box sx={{ display: "flex", gap: 2, alignItems: "flex-start" }}>
					<Box
						sx={{
							width: 8,
							height: 8,
							borderRadius: "50%",
							bgcolor: "primary.main",
							mt: 0.75,
							flexShrink: 0,
						}}
					/>
					<Box>
						<Typography variant="body2" fontWeight={500}>
							Lead criado
						</Typography>
						<Typography variant="caption" color="text.secondary">
							{new Date(lead.createdAt).toLocaleString("pt-BR")}
						</Typography>
					</Box>
				</Box>
			</Box>
		</Paper>
	);
}
