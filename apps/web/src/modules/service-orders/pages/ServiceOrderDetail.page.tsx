import { ErrorAlert } from "@repo/ui-mui/components/ErrorAlert";
import { LoadingSpinner } from "@repo/ui-mui/components/LoadingSpinner";
import { Typography } from "@repo/ui-mui/data-display/Typography";
import { Dialog } from "@repo/ui-mui/feedback/Dialog";
import { DialogActions } from "@repo/ui-mui/feedback/DialogActions";
import { DialogContent } from "@repo/ui-mui/feedback/DialogContent";
import { DialogTitle } from "@repo/ui-mui/feedback/DialogTitle";
import { Button } from "@repo/ui-mui/form/Button";
import { TextField } from "@repo/ui-mui/form/TextField";
import { Box } from "@repo/ui-mui/layout/Box";
import { Container } from "@repo/ui-mui/layout/Container";
import { Paper } from "@repo/ui-mui/layout/Paper";
import type { MaterialItemCreateInput } from "@repo/zod-schemas/material_item.zod";
import { materialItemCreateInputZod } from "@repo/zod-schemas/material_item.zod";
import type { TechnicalReportCreateInput } from "@repo/zod-schemas/technical_report.zod";
import { technicalReportCreateInputZod } from "@repo/zod-schemas/technical_report.zod";
import { trpc } from "@frontend/utils/trpc.client";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { useNavigate, useParams } from "react-router";
import { ServiceOrderStatusBadge } from "../components/ServiceOrderStatusBadge";

function formatDateTime(timestamp: number | string): string {
	const date = typeof timestamp === "number" ? new Date(timestamp) : new Date(timestamp);
	return date.toLocaleString("pt-BR", {
		day: "2-digit",
		month: "2-digit",
		year: "numeric",
		hour: "2-digit",
		minute: "2-digit",
	});
}

function formatCurrency(value: number): string {
	return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function ServiceOrderDetailPage() {
	const { serviceOrderId } = useParams<{ serviceOrderId: string }>();
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const [addMaterialOpen, setAddMaterialOpen] = useState(false);

	if (!serviceOrderId) {
		return (
			<Container maxWidth="lg" sx={{ py: 4 }}>
				<ErrorAlert message="ID da ordem de serviço não informado." />
			</Container>
		);
	}

	const {
		data: serviceOrder,
		isLoading,
		error,
	} = useQuery(
		trpc.serviceOrders.getServiceOrderDetail.queryOptions({ serviceOrderId }),
	);

	const { data: report, isLoading: reportLoading } = useQuery(
		trpc.serviceOrders.getReportByServiceOrder.queryOptions({ serviceOrderId: serviceOrderId }),
	);

	const { data: materials, isLoading: materialsLoading } = useQuery(
		trpc.serviceOrders.listMaterials.queryOptions({ serviceOrderId: serviceOrderId }),
	);

	const invalidateOrder = () => {
		queryClient.invalidateQueries({
			queryKey: trpc.serviceOrders.listServiceOrders.queryKey(),
		});
		queryClient.invalidateQueries({
			queryKey: trpc.serviceOrders.getServiceOrderDetail.queryKey({
				serviceOrderId,
			}),
		});
		queryClient.invalidateQueries({
			queryKey: trpc.serviceOrders.getReportByServiceOrder.queryKey({
				serviceOrderId,
			}),
		});
		queryClient.invalidateQueries({
			queryKey: trpc.serviceOrders.listMaterials.queryKey({ serviceOrderId }),
		});
	};

	const invalidateReport = () => {
		queryClient.invalidateQueries({
			queryKey: trpc.serviceOrders.getReportByServiceOrder.queryKey({
				serviceOrderId: serviceOrderId,
			}),
		});
	};

	const invalidateMaterials = () => {
		queryClient.invalidateQueries({
			queryKey: trpc.serviceOrders.listMaterials.queryKey({ serviceOrderId: serviceOrderId }),
		});
	};

	const iniciar = useMutation(
		trpc.serviceOrders.iniciarAtendimento.mutationOptions({ onSuccess: invalidateOrder }),
	);
	const concluir = useMutation(
		trpc.serviceOrders.concluirOrdem.mutationOptions({ onSuccess: invalidateOrder }),
	);
	const cancelar = useMutation(
		trpc.serviceOrders.cancelarOrdem.mutationOptions({ onSuccess: invalidateOrder }),
	);
	const assinarTecnico = useMutation(
		trpc.serviceOrders.assinarTecnico.mutationOptions({ onSuccess: invalidateReport }),
	);
	const assinarCliente = useMutation(
		trpc.serviceOrders.assinarCliente.mutationOptions({ onSuccess: invalidateReport }),
	);
	const createReport = useMutation(
		trpc.serviceOrders.createReport.mutationOptions({ onSuccess: invalidateReport }),
	);
	const addMaterial = useMutation(
		trpc.serviceOrders.addMaterial.mutationOptions({
			onSuccess: () => {
				invalidateMaterials();
				setAddMaterialOpen(false);
				materialForm.reset();
			},
		}),
	);

	// Report form
	const reportForm = useForm<TechnicalReportCreateInput>({
		resolver: zodResolver(technicalReportCreateInputZod),
		defaultValues: {
			serviceOrderId: serviceOrderId,
			diagnostico: "",
			servicosExecutados: "",
			observacoes: null,
		},
	});

	// Material form
	const materialForm = useForm<MaterialItemCreateInput>({
		resolver: zodResolver(materialItemCreateInputZod),
		defaultValues: {
			serviceOrderId: serviceOrderId,
			descricao: "",
			quantidade: 1,
			unidade: "un",
			valorUnitario: null,
		},
	});

	if (isLoading) return <LoadingSpinner text="Carregando ordem de serviço..." />;

	if (error || !serviceOrder) {
		return (
			<Container maxWidth="lg" sx={{ py: 4 }}>
				<ErrorAlert message={`Erro ao carregar OS: ${error?.message ?? "Não encontrada"}`} />
			</Container>
		);
	}

	const so = serviceOrder as {
		serviceOrderId: string;
		numero: string;
		clienteId: string;
		tipo: string;
		status: "Aberta" | "Em Andamento" | "Aguardando Peças" | "Concluída" | "Cancelada";
		dataAbertura: string;
		dataFechamento?: string | null;
		descricao?: string | null;
		observacoes?: string | null;
		equipmentId?: string | null;
	};

	const isBusy = iniciar.isPending || concluir.isPending || cancelar.isPending;

	const totalMateriais = (materials ?? []).reduce((acc, m) => {
		const item = m as { quantidade: string | number; valorUnitario?: string | number | null };
		const qty = typeof item.quantidade === "string" ? parseFloat(item.quantidade) : item.quantidade;
		const valor = item.valorUnitario
			? typeof item.valorUnitario === "string"
				? parseFloat(item.valorUnitario)
				: item.valorUnitario
			: null;
		if (valor != null && !Number.isNaN(qty) && !Number.isNaN(valor)) {
			return acc + qty * valor;
		}
		return acc;
	}, 0);

	return (
		<Container maxWidth="lg" sx={{ py: { xs: 3, md: 5 } }}>
			{/* Header */}
			<Box sx={{ mb: 4 }}>
				<Button
					variant="text"
					size="small"
					onClick={() => navigate("/service-orders")}
					sx={{ mb: 1, color: "text.secondary" }}
				>
					← Voltar para Ordens de Serviço
				</Button>
				<Box sx={{ display: "flex", alignItems: "center", gap: 2, flexWrap: "wrap" }}>
					<Typography variant="h4" fontWeight={700}>
						{so.numero}
					</Typography>
					<Typography variant="h5" color="text.secondary">
						— {so.tipo}
					</Typography>
					<ServiceOrderStatusBadge status={so.status} />
				</Box>
				<Typography variant="body2" color="text.secondary" mt={0.5}>
					Aberta em {formatDateTime(so.dataAbertura)}
					{so.dataFechamento ? ` · Fechada em ${formatDateTime(so.dataFechamento)}` : ""}
				</Typography>
			</Box>

			{/* Action buttons */}
			<Box sx={{ display: "flex", gap: 2, mb: 4, flexWrap: "wrap" }}>
				{so.status === "Aberta" && (
					<Button
						variant="contained"
						color="warning"
						disabled={isBusy}
						onClick={() => iniciar.mutate({ serviceOrderId: so.serviceOrderId })}
					>
						{iniciar.isPending ? "Iniciando..." : "Iniciar Atendimento"}
					</Button>
				)}
				{so.status === "Em Andamento" && (
					<Button
						variant="contained"
						color="success"
						disabled={isBusy}
						onClick={() => concluir.mutate({ serviceOrderId: so.serviceOrderId })}
					>
						{concluir.isPending ? "Concluindo..." : "Concluir OS"}
					</Button>
				)}
				{so.status !== "Cancelada" && so.status !== "Concluída" && (
					<Button
						variant="outlined"
						color="error"
						disabled={isBusy}
						onClick={() => cancelar.mutate({ serviceOrderId: so.serviceOrderId })}
					>
						{cancelar.isPending ? "Cancelando..." : "Cancelar OS"}
					</Button>
				)}
			</Box>

			{/* Info section */}
			<Paper
				elevation={0}
				sx={{ border: "1px solid", borderColor: "divider", borderRadius: 2, p: 3, mb: 3 }}
			>
				<Typography variant="h6" fontWeight={600} mb={2}>
					Informações
				</Typography>
				<Box
					sx={{
						display: "grid",
						gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
						gap: 2,
					}}
				>
					<Box>
						<Typography variant="caption" color="text.secondary">
							Cliente
						</Typography>
						<Typography variant="body2">{so.clienteId}</Typography>
					</Box>
					<Box>
						<Typography variant="caption" color="text.secondary">
							Tipo de Serviço
						</Typography>
						<Typography variant="body2">{so.tipo}</Typography>
					</Box>
					{so.equipmentId && (
						<Box>
							<Typography variant="caption" color="text.secondary">
								Equipamento
							</Typography>
							<Typography variant="body2">{so.equipmentId}</Typography>
						</Box>
					)}
					{so.descricao && (
						<Box sx={{ gridColumn: { sm: "span 2" } }}>
							<Typography variant="caption" color="text.secondary">
								Descrição
							</Typography>
							<Typography variant="body2">{so.descricao}</Typography>
						</Box>
					)}
					{so.observacoes && (
						<Box sx={{ gridColumn: { sm: "span 2" } }}>
							<Typography variant="caption" color="text.secondary">
								Observações
							</Typography>
							<Typography variant="body2">{so.observacoes}</Typography>
						</Box>
					)}
				</Box>
			</Paper>

			{/* Technical Report section */}
			<Paper
				elevation={0}
				sx={{ border: "1px solid", borderColor: "divider", borderRadius: 2, p: 3, mb: 3 }}
			>
				<Typography variant="h6" fontWeight={600} mb={2}>
					Relatório Técnico
				</Typography>

				{reportLoading ? (
					<LoadingSpinner text="Carregando relatório..." />
				) : report ? (
					// Display existing report
					(() => {
						const r = report as {
							reportId: string;
							diagnostico: string;
							servicosExecutados: string;
							observacoes?: string | null;
							assinadoTecnico: boolean;
							assinadoCliente: boolean;
						};
						return (
							<Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
								<Box>
									<Typography variant="caption" color="text.secondary">
										Diagnóstico
									</Typography>
									<Typography variant="body2">{r.diagnostico}</Typography>
								</Box>
								<Box>
									<Typography variant="caption" color="text.secondary">
										Serviços Executados
									</Typography>
									<Typography variant="body2">{r.servicosExecutados}</Typography>
								</Box>
								{r.observacoes && (
									<Box>
										<Typography variant="caption" color="text.secondary">
											Observações
										</Typography>
										<Typography variant="body2">{r.observacoes}</Typography>
									</Box>
								)}
								<Box sx={{ display: "flex", gap: 2, mt: 1, flexWrap: "wrap" }}>
									<Button
										variant={r.assinadoTecnico ? "outlined" : "contained"}
										color={r.assinadoTecnico ? "success" : "primary"}
										disabled={r.assinadoTecnico || assinarTecnico.isPending}
										onClick={() => assinarTecnico.mutate({ serviceOrderId: so.serviceOrderId })}
										size="small"
									>
										{r.assinadoTecnico ? "Técnico Assinou" : "Assinar (Técnico)"}
									</Button>
									<Button
										variant={r.assinadoCliente ? "outlined" : "contained"}
										color={r.assinadoCliente ? "success" : "secondary"}
										disabled={r.assinadoCliente || assinarCliente.isPending}
										onClick={() => assinarCliente.mutate({ serviceOrderId: so.serviceOrderId })}
										size="small"
									>
										{r.assinadoCliente ? "Cliente Assinou" : "Assinar (Cliente)"}
									</Button>
								</Box>
							</Box>
						);
					})()
				) : (
					// Create report form
					<Box
						component="form"
						onSubmit={reportForm.handleSubmit((data) => createReport.mutate(data))}
						sx={{ display: "flex", flexDirection: "column", gap: 3 }}
					>
						<Typography variant="body2" color="text.secondary">
							Nenhum relatório registrado. Preencha abaixo para criar.
						</Typography>
						<Controller
							name="diagnostico"
							control={reportForm.control}
							render={({ field }) => (
								<TextField
									{...field}
									label="Diagnóstico *"
									multiline
									rows={3}
									fullWidth
									error={!!reportForm.formState.errors.diagnostico}
									helperText={reportForm.formState.errors.diagnostico?.message}
								/>
							)}
						/>
						<Controller
							name="servicosExecutados"
							control={reportForm.control}
							render={({ field }) => (
								<TextField
									{...field}
									label="Serviços Executados *"
									multiline
									rows={3}
									fullWidth
									error={!!reportForm.formState.errors.servicosExecutados}
									helperText={reportForm.formState.errors.servicosExecutados?.message}
								/>
							)}
						/>
						<Controller
							name="observacoes"
							control={reportForm.control}
							render={({ field }) => (
								<TextField
									{...field}
									value={field.value ?? ""}
									label="Observações"
									multiline
									rows={2}
									fullWidth
									error={!!reportForm.formState.errors.observacoes}
									helperText={reportForm.formState.errors.observacoes?.message}
								/>
							)}
						/>
						<Box sx={{ display: "flex", justifyContent: "flex-end" }}>
							<Button
								type="submit"
								variant="contained"
								disabled={createReport.isPending}
								sx={{ minWidth: 160 }}
							>
								{createReport.isPending ? "Salvando..." : "Criar Relatório"}
							</Button>
						</Box>
					</Box>
				)}
			</Paper>

			{/* Materials section */}
			<Paper
				elevation={0}
				sx={{ border: "1px solid", borderColor: "divider", borderRadius: 2, p: 3 }}
			>
				<Box
					sx={{
						display: "flex",
						justifyContent: "space-between",
						alignItems: "center",
						mb: 2,
					}}
				>
					<Typography variant="h6" fontWeight={600}>
						Materiais
					</Typography>
					<Button variant="outlined" size="small" onClick={() => setAddMaterialOpen(true)}>
						+ Material
					</Button>
				</Box>

				{materialsLoading ? (
					<LoadingSpinner text="Carregando materiais..." />
				) : !materials || materials.length === 0 ? (
					<Typography variant="body2" color="text.disabled">
						Nenhum material registrado.
					</Typography>
				) : (
					<Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
						{materials.map((m) => {
							const item = m as {
								materialItemId: string;
								descricao: string;
								quantidade: string | number;
								unidade: string;
								valorUnitario?: string | number | null;
							};
							const qty =
								typeof item.quantidade === "string" ? parseFloat(item.quantidade) : item.quantidade;
							const valor = item.valorUnitario
								? typeof item.valorUnitario === "string"
									? parseFloat(item.valorUnitario)
									: item.valorUnitario
								: null;
							return (
								<Box
									key={item.materialItemId}
									sx={{
										display: "flex",
										justifyContent: "space-between",
										alignItems: "center",
										p: 1.5,
										borderRadius: 1,
										bgcolor: "action.hover",
										gap: 2,
										flexWrap: "wrap",
									}}
								>
									<Typography variant="body2" fontWeight={500} sx={{ flex: 1 }}>
										{item.descricao}
									</Typography>
									<Typography variant="body2" color="text.secondary">
										{qty} {item.unidade}
									</Typography>
									{valor != null && !Number.isNaN(qty) && !Number.isNaN(valor) && (
										<Typography variant="body2">{formatCurrency(qty * valor)}</Typography>
									)}
								</Box>
							);
						})}
						{totalMateriais > 0 && (
							<Box
								sx={{
									display: "flex",
									justifyContent: "flex-end",
									pt: 1,
									borderTop: "1px solid",
									borderColor: "divider",
									mt: 1,
								}}
							>
								<Typography variant="subtitle2" fontWeight={700}>
									Total: {formatCurrency(totalMateriais)}
								</Typography>
							</Box>
						)}
					</Box>
				)}
			</Paper>

			{/* Add Material Dialog */}
			<Dialog
				open={addMaterialOpen}
				onClose={() => {
					setAddMaterialOpen(false);
					materialForm.reset();
				}}
				maxWidth="sm"
				fullWidth
			>
				<DialogTitle>Adicionar Material</DialogTitle>
				<DialogContent>
					<Box
						component="form"
						id="material-form"
						onSubmit={materialForm.handleSubmit((data) => addMaterial.mutate(data))}
						sx={{ display: "flex", flexDirection: "column", gap: 2.5, pt: 1 }}
					>
						<Controller
							name="descricao"
							control={materialForm.control}
							render={({ field }) => (
								<TextField
									{...field}
									label="Descrição *"
									fullWidth
									error={!!materialForm.formState.errors.descricao}
									helperText={materialForm.formState.errors.descricao?.message}
								/>
							)}
						/>
						<Box
							sx={{
								display: "grid",
								gridTemplateColumns: "1fr 1fr 1fr",
								gap: 2,
							}}
						>
							<Controller
								name="quantidade"
								control={materialForm.control}
								render={({ field }) => (
									<TextField
										{...field}
										onChange={(e) => field.onChange(Number(e.target.value))}
										label="Quantidade *"
										type="number"
										fullWidth
										inputProps={{ min: 0.001, step: 0.001 }}
										error={!!materialForm.formState.errors.quantidade}
										helperText={materialForm.formState.errors.quantidade?.message}
									/>
								)}
							/>
							<Controller
								name="unidade"
								control={materialForm.control}
								render={({ field }) => (
									<TextField
										{...field}
										label="Unidade *"
										fullWidth
										placeholder="un, m, kg..."
										error={!!materialForm.formState.errors.unidade}
										helperText={materialForm.formState.errors.unidade?.message}
									/>
								)}
							/>
							<Controller
								name="valorUnitario"
								control={materialForm.control}
								render={({ field }) => (
									<TextField
										{...field}
										value={field.value ?? ""}
										onChange={(e) =>
											field.onChange(e.target.value === "" ? null : Number(e.target.value))
										}
										label="Valor Unit."
										type="number"
										fullWidth
										inputProps={{ min: 0, step: 0.01 }}
										error={!!materialForm.formState.errors.valorUnitario}
										helperText={materialForm.formState.errors.valorUnitario?.message}
									/>
								)}
							/>
						</Box>
					</Box>
				</DialogContent>
				<DialogActions>
					<Button
						variant="outlined"
						onClick={() => {
							setAddMaterialOpen(false);
							materialForm.reset();
						}}
						disabled={addMaterial.isPending}
					>
						Cancelar
					</Button>
					<Button
						type="submit"
						form="material-form"
						variant="contained"
						disabled={addMaterial.isPending}
					>
						{addMaterial.isPending ? "Adicionando..." : "Adicionar"}
					</Button>
				</DialogActions>
			</Dialog>
		</Container>
	);
}
