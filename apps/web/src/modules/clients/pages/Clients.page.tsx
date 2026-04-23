import { ErrorAlert } from "@connected-repo/ui-mui/components/ErrorAlert";
import { LoadingSpinner } from "@connected-repo/ui-mui/components/LoadingSpinner";
import { Chip } from "@connected-repo/ui-mui/data-display/Chip";
import { Typography } from "@connected-repo/ui-mui/data-display/Typography";
import { Button } from "@connected-repo/ui-mui/form/Button";
import { Box } from "@connected-repo/ui-mui/layout/Box";
import { Container } from "@connected-repo/ui-mui/layout/Container";
import { Paper } from "@connected-repo/ui-mui/layout/Paper";
import { trpc } from "@frontend/utils/trpc.client";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router";

export default function ClientsPage() {
	const navigate = useNavigate();
	const { data: clients, isLoading, error } = useQuery(trpc.clients.listClients.queryOptions({}));

	if (isLoading) return <LoadingSpinner text="Carregando clientes..." />;

	if (error) {
		return (
			<Container maxWidth="lg" sx={{ py: 4 }}>
				<ErrorAlert message={`Erro ao carregar clientes: ${error.message}`} />
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
						Clientes
					</Typography>
					<Typography variant="body2" color="text.secondary">
						{clients?.length ?? 0} clientes cadastrados
					</Typography>
				</Box>
				<Button
					variant="contained"
					onClick={() => navigate("/clients/new")}
					sx={{
						alignSelf: { xs: "stretch", sm: "auto" },
						transition: "all 0.2s ease-in-out",
						"&:hover": { transform: "translateY(-2px)", boxShadow: 4 },
					}}
				>
					Novo Cliente
				</Button>
			</Box>

			{!clients || clients.length === 0 ? (
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
						Nenhum cliente cadastrado
					</Typography>
					<Typography variant="body2" color="text.disabled" mb={3}>
						Cadastre o primeiro cliente para começar
					</Typography>
					<Button variant="contained" onClick={() => navigate("/clients/new")}>
						Cadastrar Cliente
					</Button>
				</Paper>
			) : (
				<Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
					{clients.map((client) => (
						<Paper
							key={client.clientId}
							elevation={0}
							onClick={() => navigate(`/clients/${client.clientId}`)}
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
										{client.nome}
									</Typography>
									<Typography variant="body2" color="text.secondary">
										{client.email ? `${client.email}` : ""}
										{client.email && client.telefone ? " · " : ""}
										{client.telefone ? `${client.telefone}` : ""}
									</Typography>
								</Box>
								<Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
									<Chip label={client.tipo} size="small" variant="outlined" />
									{!client.ativo && <Chip label="Inativo" size="small" color="default" />}
								</Box>
							</Box>
						</Paper>
					))}
				</Box>
			)}
		</Container>
	);
}
