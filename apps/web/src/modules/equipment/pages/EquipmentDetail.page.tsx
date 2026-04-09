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
import { EquipmentStatusBadge } from "../components/EquipmentStatusBadge";

function InfoRow({ label, value }: { label: string; value: string | number | null | undefined }) {
	if (value === null || value === undefined || value === "") return null;
	return (
		<Box>
			<Typography variant="caption" color="text.secondary">
				{label}
			</Typography>
			<Typography variant="body2">{String(value)}</Typography>
		</Box>
	);
}

export default function EquipmentDetailPage() {
	const { equipmentId } = useParams<{ equipmentId: string }>();
	const navigate = useNavigate();

	const {
		data: equipment,
		isLoading,
		error,
	} = useQuery(trpc.equipment.getEquipmentDetail.queryOptions({ equipmentId: equipmentId! }));

	if (isLoading) return <LoadingSpinner text="Carregando equipamento..." />;

	if (error || !equipment) {
		return (
			<Container maxWidth="lg" sx={{ py: 4 }}>
				<ErrorAlert
					message={`Erro ao carregar equipamento: ${error?.message ?? "Equipamento não encontrado"}`}
				/>
			</Container>
		);
	}

	return (
		<Container maxWidth="lg" sx={{ py: { xs: 3, md: 5 } }}>
			<Box sx={{ mb: 4 }}>
				<Button
					variant="text"
					size="small"
					onClick={() => navigate("/equipment")}
					sx={{ mb: 1, color: "text.secondary" }}
				>
					← Voltar para Equipamentos
				</Button>
				<Box sx={{ display: "flex", alignItems: "center", gap: 2, flexWrap: "wrap" }}>
					<Typography variant="h4" fontWeight={700}>
						{equipment.nome}
					</Typography>
					<EquipmentStatusBadge status={equipment.status} />
					{!equipment.ativo && (
						<Typography
							variant="caption"
							sx={{
								px: 1,
								py: 0.5,
								bgcolor: "action.disabledBackground",
								borderRadius: 1,
							}}
						>
							Inativo
						</Typography>
					)}
				</Box>
				<Typography variant="body2" color="text.secondary" mt={0.5}>
					{equipment.tipo}
				</Typography>
			</Box>

			<Box
				sx={{
					display: "grid",
					gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
					gap: 3,
				}}
			>
				{/* Identificação */}
				<Paper
					elevation={0}
					sx={{ border: "1px solid", borderColor: "divider", borderRadius: 2, p: 3 }}
				>
					<Typography variant="h6" fontWeight={600} mb={2}>
						Identificação
					</Typography>
					<Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
						<InfoRow label="Marca" value={equipment.marca} />
						<InfoRow label="Modelo" value={equipment.modelo} />
						<InfoRow label="Número de Série" value={equipment.numeroDeSerie} />
						<InfoRow label="Capacidade BTU" value={equipment.capacidadeBtu} />
						<InfoRow label="Ano de Fabricação" value={equipment.anoFabricacao} />
					</Box>
				</Paper>

				{/* Manutenção */}
				<Paper
					elevation={0}
					sx={{ border: "1px solid", borderColor: "divider", borderRadius: 2, p: 3 }}
				>
					<Typography variant="h6" fontWeight={600} mb={2}>
						Manutenção
					</Typography>
					<Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
						<InfoRow label="Data de Instalação" value={equipment.dataInstalacao} />
						<InfoRow label="Última Manutenção" value={equipment.ultimaManutencao} />
						{equipment.observacoes && (
							<Box>
								<Typography variant="caption" color="text.secondary">
									Observações
								</Typography>
								<Typography variant="body2" sx={{ whiteSpace: "pre-wrap" }}>
									{equipment.observacoes}
								</Typography>
							</Box>
						)}
					</Box>
				</Paper>
			</Box>

			<Box sx={{ mt: 3, display: "flex", justifyContent: "flex-end" }}>
				<Button variant="outlined" onClick={() => navigate("/equipment")}>
					Voltar
				</Button>
			</Box>
		</Container>
	);
}
