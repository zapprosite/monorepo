import { ErrorAlert } from "@repo/ui-mui/components/ErrorAlert";
import { LoadingSpinner } from "@repo/ui-mui/components/LoadingSpinner";
import { Typography } from "@repo/ui-mui/data-display/Typography";
import { Button } from "@repo/ui-mui/form/Button";
import { TextField } from "@repo/ui-mui/form/TextField";
import { Box } from "@repo/ui-mui/layout/Box";
import { Container } from "@repo/ui-mui/layout/Container";
import { Paper } from "@repo/ui-mui/layout/Paper";
import { MenuItem } from "@repo/ui-mui/navigation/MenuItem";
import { EQUIPMENT_STATUS_ENUM } from "@repo/zod-schemas/crm_enums.zod";
import { trpc } from "@frontend/utils/trpc.client";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useNavigate } from "react-router";
import { EquipmentStatusBadge } from "../components/EquipmentStatusBadge";

export default function EquipmentPage() {
	const navigate = useNavigate();
	const [statusFilter, setStatusFilter] = useState<string>("");

	const {
		data: equipment,
		isLoading,
		error,
	} = useQuery(
		trpc.equipment.listEquipment.queryOptions(
			statusFilter ? { status: statusFilter as (typeof EQUIPMENT_STATUS_ENUM)[number] } : {},
		),
	);

	if (isLoading) return <LoadingSpinner text="Carregando equipamentos..." />;

	if (error) {
		return (
			<Container maxWidth="lg" sx={{ py: 4 }}>
				<ErrorAlert message={`Erro ao carregar equipamentos: ${error.message}`} />
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
					alignItems: "center",
					flexWrap: "wrap",
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
						Equipamentos
					</Typography>
					<Typography variant="body2" color="text.secondary">
						{equipment?.length ?? 0} equipamentos no total
					</Typography>
				</Box>
				<Box sx={{ display: "flex", gap: 2, alignItems: "center" }}>
					<TextField
						select
						label="Status"
						size="small"
						value={statusFilter}
						onChange={(e) => setStatusFilter(e.target.value)}
						sx={{ minWidth: 160 }}
					>
						<MenuItem value="">Todos</MenuItem>
						{EQUIPMENT_STATUS_ENUM.map((s) => (
							<MenuItem key={s} value={s}>
								{s}
							</MenuItem>
						))}
					</TextField>
					<Button
						variant="contained"
						onClick={() => navigate("/equipment/new")}
						sx={{
							transition: "all 0.2s ease-in-out",
							"&:hover": { transform: "translateY(-2px)", boxShadow: 4 },
						}}
					>
						Novo Equipamento
					</Button>
				</Box>
			</Box>

			{!equipment || equipment.length === 0 ? (
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
						Nenhum equipamento cadastrado
					</Typography>
					<Typography variant="body2" color="text.disabled" mb={3}>
						Cadastre o primeiro equipamento para começar a gestão técnica
					</Typography>
					<Button variant="contained" onClick={() => navigate("/equipment/new")}>
						Cadastrar Equipamento
					</Button>
				</Paper>
			) : (
				<Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
					{equipment.map((eq) => (
						<Paper
							key={eq.equipmentId}
							elevation={0}
							onClick={() => navigate(`/equipment/${eq.equipmentId}`)}
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
										{eq.nome}
									</Typography>
									<Typography variant="body2" color="text.secondary">
										{eq.tipo}
										{eq.marca ? ` · ${eq.marca}` : ""}
										{eq.modelo ? ` ${eq.modelo}` : ""}
									</Typography>
								</Box>
								<EquipmentStatusBadge status={eq.status} />
							</Box>
						</Paper>
					))}
				</Box>
			)}
		</Container>
	);
}
