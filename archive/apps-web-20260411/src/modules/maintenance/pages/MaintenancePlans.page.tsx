import { ErrorAlert } from "@connected-repo/ui-mui/components/ErrorAlert";
import { LoadingSpinner } from "@connected-repo/ui-mui/components/LoadingSpinner";
import { Typography } from "@connected-repo/ui-mui/data-display/Typography";
import { Button } from "@connected-repo/ui-mui/form/Button";
import { Select } from "@connected-repo/ui-mui/form/Select";
import { TextField } from "@connected-repo/ui-mui/form/TextField";
import { Box } from "@connected-repo/ui-mui/layout/Box";
import { Container } from "@connected-repo/ui-mui/layout/Container";
import { Paper } from "@connected-repo/ui-mui/layout/Paper";
import { MenuItem } from "@connected-repo/ui-mui/navigation/MenuItem";
import { trpc } from "@frontend/utils/trpc.client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type React from "react";
import { useState } from "react";

export const MaintenancePlansPage: React.FC = () => {
	const [showForm, setShowForm] = useState(false);
	const [formData, setFormData] = useState({
		nomeEmpresa: "",
		tipoEquipamento: "ar-condicionado" as const,
		periodicidadeDias: 90,
	});
	const queryClient = useQueryClient();

	const { data: plans, isLoading, error } = useQuery(trpc.maintenance.listPlans.queryOptions());

	const createMutation = useMutation(
		trpc.maintenance.createPlan.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries({ queryKey: trpc.maintenance.listPlans.queryKey() });
				setShowForm(false);
				setFormData({
					nomeEmpresa: "",
					tipoEquipamento: "ar-condicionado",
					periodicidadeDias: 90,
				});
			},
		}),
	);

	const onSubmit = () => {
		createMutation.mutate(formData);
	};

	if (isLoading) return <LoadingSpinner text="Carregando planos..." />;

	if (error) {
		return (
			<Container maxWidth="lg" sx={{ py: 4 }}>
				<ErrorAlert message={`Erro ao carregar planos: ${error.message}`} />
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
				}}
			>
				<Typography variant="h3" component="h1" fontWeight={700}>
					Planos de Manutenção
				</Typography>
				<Button variant="contained" onClick={() => setShowForm(!showForm)}>
					+ Novo Plano
				</Button>
			</Box>

			{showForm && (
				<Paper elevation={0} sx={{ p: 3, mb: 4, border: "1px solid", borderColor: "divider" }}>
					<Typography variant="h6" mb={2}>
						Criar Novo Plano
					</Typography>
					<Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
						<TextField
							label="Nome da Empresa"
							value={formData.nomeEmpresa}
							onChange={(e) => setFormData({ ...formData, nomeEmpresa: e.target.value })}
							fullWidth
						/>
						<Select
							label="Tipo de Equipamento"
							value={formData.tipoEquipamento}
							onChange={(e) =>
								setFormData({
									...formData,
									tipoEquipamento: e.target.value as typeof formData.tipoEquipamento,
								})
							}
							fullWidth
						>
							<MenuItem value="ar-condicionado">Ar Condicionado</MenuItem>
							<MenuItem value="refrigerador">Refrigerador</MenuItem>
						</Select>
						<TextField
							label="Periodicidade (dias)"
							type="number"
							value={formData.periodicidadeDias}
							onChange={(e) =>
								setFormData({ ...formData, periodicidadeDias: parseInt(e.target.value) || 0 })
							}
							fullWidth
						/>
						<Button variant="contained" onClick={onSubmit} disabled={createMutation.isPending}>
							{createMutation.isPending ? "Salvando..." : "Salvar"}
						</Button>
					</Box>
				</Paper>
			)}

			{!plans?.data || plans.data.length === 0 ? (
				<Paper
					elevation={0}
					sx={{ p: 6, textAlign: "center", border: "1px solid", borderColor: "divider" }}
				>
					<Typography variant="h6" color="text.secondary" gutterBottom>
						Nenhum plano cadastrado
					</Typography>
					<Typography variant="body2" color="text.disabled" mb={3}>
						Crie o primeiro plano de manutenção
					</Typography>
					<Button variant="contained" onClick={() => setShowForm(true)}>
						Criar Plano
					</Button>
				</Paper>
			) : (
				<Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: 2 }}>
					{plans.data.map((plan) => (
						<Paper
							key={plan.id}
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
							<Typography variant="subtitle1" fontWeight={600}>
								{plan.nomeEmpresa}
							</Typography>
							<Typography variant="body2" color="text.secondary">
								{plan.tipoEquipamento} - {plan.periodicidadeDias} dias
							</Typography>
						</Paper>
					))}
				</Box>
			)}
		</Container>
	);
};
