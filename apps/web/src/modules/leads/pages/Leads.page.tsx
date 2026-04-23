import { ErrorAlert } from "@connected-repo/ui-mui/components/ErrorAlert";
import { LoadingSpinner } from "@connected-repo/ui-mui/components/LoadingSpinner";
import { Typography } from "@connected-repo/ui-mui/data-display/Typography";
import { Button } from "@connected-repo/ui-mui/form/Button";
import { Box } from "@connected-repo/ui-mui/layout/Box";
import { Container } from "@connected-repo/ui-mui/layout/Container";
import { Paper } from "@connected-repo/ui-mui/layout/Paper";
import { trpc } from "@frontend/utils/trpc.client";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router";
import { LeadStatusBadge } from "../components/LeadStatusBadge";

export default function LeadsPage() {
	const navigate = useNavigate();
	const { data: leads, isLoading, error } = useQuery(trpc.leads.listLeads.queryOptions({}));

	if (isLoading) return <LoadingSpinner text="Carregando leads..." />;

	if (error) {
		return (
			<Container maxWidth="lg" sx={{ py: 4 }}>
				<ErrorAlert message={`Erro ao carregar leads: ${error.message}`} />
			</Container>
		);
	}

	return (
		<Container maxWidth="xl" sx={{ py: { xs: 3, md: 5 } }}>
			<Box
				sx={{
					mb: 4,
					display: "flex",
					justifyContent: "space-between",
					alignItems: { xs: "flex-start", sm: "center" },
					flexDirection: { xs: "column", sm: "row" },
					gap: 2,
				}}
			>
				<Box>
					<Typography
						variant="h3"
						component="h1"
						sx={{
							fontSize: { xs: "2rem", md: "2.5rem" },
							fontWeight: 700,
							letterSpacing: "-0.01em",
						}}
					>
						Leads
					</Typography>
					<Typography variant="body2" color="text.secondary">
						{leads?.length ?? 0} {leads?.length === 1 ? "lead no total" : "leads no total"}
					</Typography>
				</Box>
				<Button
					variant="contained"
					onClick={() => navigate("/leads/new")}
					sx={{
						transition: "all 0.2s ease-in-out",
						"&:hover": { transform: "translateY(-2px)", boxShadow: 4 },
					}}
				>
					Novo Lead
				</Button>
			</Box>

			{!leads || leads.length === 0 ? (
				<Paper
					elevation={0}
					sx={{
						border: "1px solid",
						borderColor: "divider",
						borderRadius: 2,
						p: 8,
						textAlign: "center",
					}}
				>
					<Typography variant="h6" color="text.secondary" gutterBottom>
						Nenhum lead cadastrado
					</Typography>
					<Typography variant="body2" color="text.disabled" mb={3}>
						Cadastre o primeiro lead para começar o pipeline comercial
					</Typography>
					<Button variant="contained" onClick={() => navigate("/leads/new")}>
						Cadastrar Lead
					</Button>
				</Paper>
			) : (
				<Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
					{leads.map((lead) => (
						<Paper
							key={lead.leadId}
							elevation={0}
							onClick={() => navigate(`/leads/${lead.leadId}`)}
							sx={{
								border: "1px solid",
								borderColor: "divider",
								borderRadius: 2,
								p: 3,
								cursor: "pointer",
								transition: "all 0.2s ease-in-out",
								"&:hover": {
									borderColor: "primary.main",
									transform: "translateY(-2px)",
									boxShadow: 3,
								},
							}}
						>
							<Box
								sx={{
									display: "flex",
									alignItems: "center",
									justifyContent: "space-between",
									gap: 2,
								}}
							>
								<Box>
									<Typography variant="subtitle1" fontWeight={600}>
										{lead.nome}
									</Typography>
									<Typography variant="body2" color="text.secondary">
										{lead.origem} {lead.email ? `· ${lead.email}` : ""}{" "}
										{lead.telefone ? `· ${lead.telefone}` : ""}
									</Typography>
								</Box>
								<LeadStatusBadge status={lead.status} />
							</Box>
						</Paper>
					))}
				</Box>
			)}
		</Container>
	);
}
