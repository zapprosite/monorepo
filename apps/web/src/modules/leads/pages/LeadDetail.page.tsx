import { ErrorAlert } from "@connected-repo/ui-mui/components/ErrorAlert";
import { LoadingSpinner } from "@connected-repo/ui-mui/components/LoadingSpinner";
import { Typography } from "@connected-repo/ui-mui/data-display/Typography";
import { Button } from "@connected-repo/ui-mui/form/Button";
import { Box } from "@connected-repo/ui-mui/layout/Box";
import { Container } from "@connected-repo/ui-mui/layout/Container";
import { Paper } from "@connected-repo/ui-mui/layout/Paper";
import { trpc } from "@frontend/utils/trpc.client";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router";
import { LeadStatusBadge } from "../components/LeadStatusBadge";
import { LeadTimeline } from "../components/LeadTimeline";

export default function LeadDetailPage() {
	const { leadId } = useParams<{ leadId: string }>();
	const navigate = useNavigate();

	const {
		data: lead,
		isLoading,
		error,
	} = useQuery(trpc.leads.getLeadDetail.queryOptions({ leadId: leadId! }));

	if (isLoading) return <LoadingSpinner text="Carregando lead..." />;

	if (error || !lead) {
		return (
			<Container maxWidth="lg" sx={{ py: 4 }}>
				<ErrorAlert message={`Erro ao carregar lead: ${error?.message ?? "Lead não encontrado"}`} />
			</Container>
		);
	}

	return (
		<Container maxWidth="lg" sx={{ py: { xs: 3, md: 5 } }}>
			<Box
				sx={{
					mb: 4,
					display: "flex",
					alignItems: "center",
					justifyContent: "space-between",
					gap: 2,
				}}
			>
				<Box>
					<Button
						variant="text"
						size="small"
						onClick={() => navigate("/leads")}
						sx={{ mb: 1, color: "text.secondary" }}
					>
						← Voltar para Leads
					</Button>
					<Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
						<Typography variant="h4" fontWeight={700}>
							{lead.nome}
						</Typography>
						<LeadStatusBadge status={lead.status} />
					</Box>
					<Typography variant="body2" color="text.secondary" mt={0.5}>
						{lead.origem} {lead.canal ? `· ${lead.canal}` : ""}
					</Typography>
				</Box>
			</Box>

			<Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: 3 }}>
				<Paper
					elevation={0}
					sx={{ border: "1px solid", borderColor: "divider", borderRadius: 2, p: 3 }}
				>
					<Typography variant="h6" fontWeight={600} mb={2}>
						Informações de Contato
					</Typography>
					<Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
						{lead.email && (
							<Box>
								<Typography variant="caption" color="text.secondary">
									Email
								</Typography>
								<Typography variant="body2">{lead.email}</Typography>
							</Box>
						)}
						{lead.telefone && (
							<Box>
								<Typography variant="caption" color="text.secondary">
									Telefone
								</Typography>
								<Typography variant="body2">{lead.telefone}</Typography>
							</Box>
						)}
						{lead.observacoes && (
							<Box>
								<Typography variant="caption" color="text.secondary">
									Observações
								</Typography>
								<Typography variant="body2">{lead.observacoes}</Typography>
							</Box>
						)}
					</Box>
				</Paper>

				<LeadTimeline lead={lead} />
			</Box>
		</Container>
	);
}
