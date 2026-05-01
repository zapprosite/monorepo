import { ErrorAlert } from "@repo/ui-mui/components/ErrorAlert";
import { LoadingSpinner } from "@repo/ui-mui/components/LoadingSpinner";
import { Chip } from "@repo/ui-mui/data-display/Chip";
import { Typography } from "@repo/ui-mui/data-display/Typography";
import { Box } from "@repo/ui-mui/layout/Box";
import { Container } from "@repo/ui-mui/layout/Container";
import { Paper } from "@repo/ui-mui/layout/Paper";
import { trpc } from "@frontend/utils/trpc.client";
import { useQuery } from "@tanstack/react-query";
import type React from "react";

export const LoyaltyDashboardPage = () => {
	const {
		data: scores,
		isLoading,
		error,
	} = useQuery(
		trpc.loyalty.listLoyalty.queryOptions({
			limit: 50,
			offset: 0,
		}),
	);

	if (isLoading) return <LoadingSpinner text="Carregando fidelização..." />;

	if (error) {
		return (
			<Container maxWidth="lg" sx={{ py: 4 }}>
				<ErrorAlert message={`Erro ao carregar dados: ${error.message}`} />
			</Container>
		);
	}

	const getLevelColor = (level: string) => {
		switch (level) {
			case "bronze":
				return "warning";
			case "prata":
				return "default";
			case "ouro":
				return "info";
			case "platinum":
				return "secondary";
			default:
				return "default";
		}
	};

	const getStatusColor = (status: string) => {
		switch (status) {
			case "ativo":
				return "success";
			case "risco-30d":
			case "risco-60d":
			case "risco-90d":
				return "warning";
			case "perdido":
				return "error";
			default:
				return "default";
		}
	};

	return (
		<Container maxWidth="xl" sx={{ py: { xs: 3, md: 5 } }}>
			<Typography variant="h3" component="h1" fontWeight={700} mb={4}>
				Dashboard de Fidelização
			</Typography>

			<Box
				sx={{
					display: "grid",
					gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr", md: "1fr 1fr 1fr 1fr" },
					gap: 3,
					mb: 4,
				}}
			>
				<Paper
					elevation={0}
					sx={{ p: 3, border: "1px solid", borderColor: "divider", borderRadius: 2 }}
				>
					<Typography variant="body2" color="text.secondary">
						Total de Clientes
					</Typography>
					<Typography variant="h4" fontWeight={700}>
						{scores?.data?.length || 0}
					</Typography>
				</Paper>
				<Paper
					elevation={0}
					sx={{ p: 3, border: "1px solid", borderColor: "divider", borderRadius: 2 }}
				>
					<Typography variant="body2" color="text.secondary">
						Nível Platinum
					</Typography>
					<Typography variant="h4" fontWeight={700}>
						{scores?.data?.filter((s) => s.nivel === "platinum").length || 0}
					</Typography>
				</Paper>
				<Paper
					elevation={0}
					sx={{ p: 3, border: "1px solid", borderColor: "divider", borderRadius: 2 }}
				>
					<Typography variant="body2" color="text.secondary">
						Em Risco
					</Typography>
					<Typography variant="h4" fontWeight={700}>
						{scores?.data?.filter((s) => s.statusReativacao.includes("risco")).length || 0}
					</Typography>
				</Paper>
				<Paper
					elevation={0}
					sx={{ p: 3, border: "1px solid", borderColor: "divider", borderRadius: 2 }}
				>
					<Typography variant="body2" color="text.secondary">
						Perdidos
					</Typography>
					<Typography variant="h4" fontWeight={700}>
						{scores?.data?.filter((s) => s.statusReativacao === "perdido").length || 0}
					</Typography>
				</Paper>
			</Box>

			{!scores?.data || scores.data.length === 0 ? (
				<Paper
					elevation={0}
					sx={{ p: 6, textAlign: "center", border: "1px solid", borderColor: "divider" }}
				>
					<Typography variant="h6" color="text.secondary" gutterBottom>
						Nenhum dado de fidelização
					</Typography>
					<Typography variant="body2" color="text.disabled">
						Os dados de fidelização aparecerão aqui
					</Typography>
				</Paper>
			) : (
				<Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
					{scores.data.map((score) => (
						<Paper
							key={score.clienteId}
							elevation={0}
							sx={{
								p: 3,
								border: "1px solid",
								borderColor: "divider",
								borderRadius: 2,
								transition: "all 0.2s",
								"&:hover": { borderColor: "primary.main", boxShadow: 2 },
							}}
						>
							<Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
								<Box>
									<Typography variant="subtitle1" fontWeight={600}>
										Cliente ID: {score.clienteId.slice(0, 8)}
									</Typography>
									<Typography variant="body2" color="text.secondary">
										Pontos: {score.pontos} | Nível: {score.nivel.toUpperCase()}
									</Typography>
								</Box>
								<Box sx={{ display: "flex", gap: 1 }}>
									<Chip label={score.nivel} size="small" color={getLevelColor(score.nivel)} />
									<Chip
										label={score.statusReativacao}
										size="small"
										color={getStatusColor(score.statusReativacao)}
									/>
								</Box>
							</Box>
						</Paper>
					))}
				</Box>
			)}
		</Container>
	);
};
