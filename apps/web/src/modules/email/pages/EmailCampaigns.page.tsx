import { ErrorAlert } from "@repo/ui-mui/components/ErrorAlert";
import { LoadingSpinner } from "@repo/ui-mui/components/LoadingSpinner";
import { Typography } from "@repo/ui-mui/data-display/Typography";
import { Button } from "@repo/ui-mui/form/Button";
import { Select } from "@repo/ui-mui/form/Select";
import { TextField } from "@repo/ui-mui/form/TextField";
import { Box } from "@repo/ui-mui/layout/Box";
import { Container } from "@repo/ui-mui/layout/Container";
import { Paper } from "@repo/ui-mui/layout/Paper";
import { MenuItem } from "@repo/ui-mui/navigation/MenuItem";
import { trpc } from "@frontend/utils/trpc.client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type React from "react";
import { useState } from "react";

export const EmailCampaignsPage = () => {
	const [showForm, setShowForm] = useState(false);
	const [formData, setFormData] = useState({
		nome: "",
		tipoCampanha: "marketing" as const,
		destinatariosJSON: [] as string[],
	});
	const queryClient = useQueryClient();

	const {
		data: campaigns,
		isLoading,
		error,
	} = useQuery(
		trpc.email.listCampaigns.queryOptions({
			limit: 50,
			offset: 0,
		}),
	);

	const createMutation = useMutation(
		trpc.email.createCampaign.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries({ queryKey: trpc.email.listCampaigns.queryKey() });
				setShowForm(false);
				setFormData({
					nome: "",
					tipoCampanha: "marketing",
					destinatariosJSON: [],
				});
			},
		}),
	);

	const onSubmit = () => {
		createMutation.mutate(formData);
	};

	if (isLoading) return <LoadingSpinner text="Carregando campanhas..." />;

	if (error) {
		return (
			<Container maxWidth="lg" sx={{ py: 4 }}>
				<ErrorAlert message={`Erro ao carregar campanhas: ${error.message}`} />
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
					Campanhas de Email
				</Typography>
				<Button variant="contained" onClick={() => setShowForm(!showForm)}>
					+ Nova Campanha
				</Button>
			</Box>

			{showForm && (
				<Paper elevation={0} sx={{ p: 3, mb: 4, border: "1px solid", borderColor: "divider" }}>
					<Typography variant="h6" mb={2}>
						Criar Nova Campanha
					</Typography>
					<Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
						<TextField
							label="Nome da Campanha"
							value={formData.nome}
							onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
							fullWidth
						/>
						<Select
							label="Tipo de Campanha"
							value={formData.tipoCampanha}
							onChange={(e) =>
								setFormData({
									...formData,
									tipoCampanha: e.target.value as typeof formData.tipoCampanha,
								})
							}
							fullWidth
						>
							<MenuItem value="marketing">Marketing</MenuItem>
							<MenuItem value="reativacao">Reativação</MenuItem>
							<MenuItem value="newsletter">Newsletter</MenuItem>
							<MenuItem value="promocional">Promocional</MenuItem>
							<MenuItem value="transacional">Transacional</MenuItem>
						</Select>
						<Button variant="contained" onClick={onSubmit} disabled={createMutation.isPending}>
							{createMutation.isPending ? "Salvando..." : "Salvar"}
						</Button>
					</Box>
				</Paper>
			)}

			{!campaigns?.data || campaigns.data.length === 0 ? (
				<Paper
					elevation={0}
					sx={{ p: 6, textAlign: "center", border: "1px solid", borderColor: "divider" }}
				>
					<Typography variant="h6" color="text.secondary" gutterBottom>
						Nenhuma campanha cadastrada
					</Typography>
					<Typography variant="body2" color="text.disabled" mb={3}>
						Crie a primeira campanha para começar
					</Typography>
					<Button variant="contained" onClick={() => setShowForm(true)}>
						Criar Campanha
					</Button>
				</Paper>
			) : (
				<Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
					{campaigns.data.map((campaign) => (
						<Paper
							key={campaign.id}
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
							<Box
								sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}
							>
								<Box>
									<Typography variant="subtitle1" fontWeight={600}>
										{campaign.nome}
									</Typography>
									<Typography variant="body2" color="text.secondary">
										{campaign.tipoCampanha}
									</Typography>
								</Box>
								<Box
									sx={{
										px: 2,
										py: 0.5,
										borderRadius: 1,
										bgcolor: "background.default",
										border: "1px solid",
										borderColor: "divider",
									}}
								>
									<Typography variant="caption">{campaign.statusCampanha}</Typography>
								</Box>
							</Box>
						</Paper>
					))}
				</Box>
			)}
		</Container>
	);
};
