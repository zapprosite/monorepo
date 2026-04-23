import { ErrorAlert } from "@connected-repo/ui-mui/components/ErrorAlert";
import { LoadingSpinner } from "@connected-repo/ui-mui/components/LoadingSpinner";
import { Typography } from "@connected-repo/ui-mui/data-display/Typography";
import { Button } from "@connected-repo/ui-mui/form/Button";
import { Box } from "@connected-repo/ui-mui/layout/Box";
import { Container } from "@connected-repo/ui-mui/layout/Container";
import { Paper } from "@connected-repo/ui-mui/layout/Paper";
import type { ContractStatus } from "@repo/zod-schemas/crm_enums.zod";
import { trpc } from "@frontend/utils/trpc.client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useNavigate, useParams } from "react-router";
import { CancelContractModal } from "../components/CancelContractModal";
import { ContractStatusBadge } from "../components/ContractStatusBadge";

function formatDate(dateStr: string | null | undefined): string {
	if (!dateStr) return "—";
	const date = new Date(`${dateStr}T12:00:00`);
	return date.toLocaleDateString("pt-BR", {
		day: "2-digit",
		month: "long",
		year: "numeric",
	});
}

function formatCurrency(valor: number | null | undefined): string {
	if (valor == null) return "—";
	return valor.toLocaleString("pt-BR", {
		style: "currency",
		currency: "BRL",
	});
}

export default function ContractDetailPage() {
	const { contractId } = useParams<{ contractId: string }>();
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const [cancelOpen, setCancelOpen] = useState(false);

	const contractDetailOptions = contractId
		? trpc.contracts.getContractDetail.queryOptions({ contractId })
		: trpc.contracts.getContractDetail.queryOptions({ contractId: "" });

	const {
		data: contract,
		isLoading,
		error,
	} = useQuery({
		...contractDetailOptions,
		enabled: !!contractId,
	});

	if (!contractId) {
		return (
			<Container maxWidth="lg" sx={{ py: 4 }}>
				<ErrorAlert message="Contrato inválido ou não encontrado." />
			</Container>
		);
	}

	const invalidate = () => {
		queryClient.invalidateQueries({ queryKey: trpc.contracts.listContracts.queryKey() });
		queryClient.invalidateQueries({
			queryKey: trpc.contracts.getContractDetail.queryKey({ contractId: contractId }),
		});
	};

	const activate = useMutation(
		trpc.contracts.activateContract.mutationOptions({ onSuccess: invalidate }),
	);
	const suspend = useMutation(
		trpc.contracts.suspendContract.mutationOptions({ onSuccess: invalidate }),
	);
	const reactivate = useMutation(
		trpc.contracts.reactivateContract.mutationOptions({ onSuccess: invalidate }),
	);
	const end = useMutation(trpc.contracts.endContract.mutationOptions({ onSuccess: invalidate }));

	if (isLoading) return <LoadingSpinner text="Carregando contrato..." />;

	if (error || !contract) {
		return (
			<Container maxWidth="lg" sx={{ py: 4 }}>
				<ErrorAlert message={`Erro ao carregar contrato: ${error?.message ?? "Não encontrado"}`} />
			</Container>
		);
	}

	const c = contract as {
		contractId: string;
		clienteId: string;
		clienteNome?: string;
		tipo: string;
		status: ContractStatus;
		dataInicio: string;
		dataFim?: string | null;
		valor?: number | null;
		frequencia?: string | null;
		descricao?: string | null;
		observacoes?: string | null;
		motivoCancelamento?: string | null;
	};

	const isBusy = activate.isPending || suspend.isPending || reactivate.isPending || end.isPending;

	return (
		<Container maxWidth="lg" sx={{ py: { xs: 3, md: 5 } }}>
			{/* Header */}
			<Box sx={{ mb: 4 }}>
				<Button
					variant="text"
					size="small"
					onClick={() => navigate("/contracts")}
					sx={{ mb: 1, color: "text.secondary" }}
				>
					← Voltar para Contratos
				</Button>
				<Box sx={{ display: "flex", alignItems: "center", gap: 2, flexWrap: "wrap" }}>
					<Typography variant="h4" fontWeight={700}>
						{c.tipo}
					</Typography>
					<ContractStatusBadge status={c.status} />
				</Box>
				{c.clienteNome && (
					<Typography
						variant="body1"
						color="primary.main"
						mt={0.5}
						sx={{
							cursor: "pointer",
							"&:hover": { textDecoration: "underline" },
						}}
						onClick={() => navigate(`/clients/${c.clienteId}`)}
					>
						{c.clienteNome}
					</Typography>
				)}
			</Box>

			{/* Action buttons */}
			<Box sx={{ display: "flex", gap: 2, mb: 4, flexWrap: "wrap" }}>
				{c.status === "Rascunho" && (
					<Button
						variant="contained"
						color="success"
						disabled={isBusy}
						onClick={() => activate.mutate({ contractId: c.contractId })}
					>
						Ativar Contrato
					</Button>
				)}
				{c.status === "Ativo" && (
					<>
						<Button
							variant="contained"
							color="warning"
							disabled={isBusy}
							onClick={() => suspend.mutate({ contractId: c.contractId })}
						>
							Suspender
						</Button>
						<Button
							variant="outlined"
							color="info"
							disabled={isBusy}
							onClick={() => end.mutate({ contractId: c.contractId })}
						>
							Encerrar
						</Button>
					</>
				)}
				{c.status === "Suspenso" && (
					<>
						<Button
							variant="contained"
							color="success"
							disabled={isBusy}
							onClick={() => reactivate.mutate({ contractId: c.contractId })}
						>
							Reativar
						</Button>
						<Button
							variant="outlined"
							color="info"
							disabled={isBusy}
							onClick={() => end.mutate({ contractId: c.contractId })}
						>
							Encerrar
						</Button>
					</>
				)}
				{c.status !== "Cancelado" && c.status !== "Encerrado" && (
					<Button
						variant="outlined"
						color="error"
						disabled={isBusy}
						onClick={() => setCancelOpen(true)}
					>
						Cancelar
					</Button>
				)}
			</Box>

			{/* Details Grid */}
			<Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: 3 }}>
				{/* Informações do Contrato */}
				<Paper
					elevation={0}
					sx={{ border: "1px solid", borderColor: "divider", borderRadius: 2, p: 3 }}
				>
					<Typography variant="h6" fontWeight={600} mb={2}>
						Informações do Contrato
					</Typography>
					<Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
						<Box>
							<Typography variant="caption" color="text.secondary">
								Tipo
							</Typography>
							<Typography variant="body2">{c.tipo}</Typography>
						</Box>
						<Box>
							<Typography variant="caption" color="text.secondary">
								Data Início
							</Typography>
							<Typography variant="body2">{formatDate(c.dataInicio)}</Typography>
						</Box>
						{c.dataFim && (
							<Box>
								<Typography variant="caption" color="text.secondary">
									Data Fim
								</Typography>
								<Typography variant="body2">{formatDate(c.dataFim)}</Typography>
							</Box>
						)}
						<Box>
							<Typography variant="caption" color="text.secondary">
								Valor Mensal
							</Typography>
							<Typography variant="body2">{formatCurrency(c.valor)}</Typography>
						</Box>
						{c.frequencia && (
							<Box>
								<Typography variant="caption" color="text.secondary">
									Frequência
								</Typography>
								<Typography variant="body2">{c.frequencia}</Typography>
							</Box>
						)}
					</Box>
				</Paper>

				{/* Detalhes */}
				<Paper
					elevation={0}
					sx={{ border: "1px solid", borderColor: "divider", borderRadius: 2, p: 3 }}
				>
					<Typography variant="h6" fontWeight={600} mb={2}>
						Detalhes
					</Typography>
					<Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
						{c.descricao && (
							<Box>
								<Typography variant="caption" color="text.secondary">
									Descrição
								</Typography>
								<Typography variant="body2">{c.descricao}</Typography>
							</Box>
						)}
						{c.observacoes && (
							<Box>
								<Typography variant="caption" color="text.secondary">
									Observações
								</Typography>
								<Typography variant="body2">{c.observacoes}</Typography>
							</Box>
						)}
						{c.motivoCancelamento && (
							<Box>
								<Typography variant="caption" color="error.main">
									Motivo do Cancelamento
								</Typography>
								<Typography variant="body2">{c.motivoCancelamento}</Typography>
							</Box>
						)}
						{!c.descricao && !c.observacoes && !c.motivoCancelamento && (
							<Typography variant="body2" color="text.disabled">
								Sem detalhes adicionais
							</Typography>
						)}
					</Box>
				</Paper>

				{/* Unidades Vinculadas — placeholder */}
				<Paper
					elevation={0}
					sx={{
						border: "1px solid",
						borderColor: "divider",
						borderRadius: 2,
						p: 3,
						gridColumn: { md: "1 / -1" },
					}}
				>
					<Typography variant="h6" fontWeight={600} mb={2}>
						Unidades Vinculadas
					</Typography>
					<Typography variant="body2" color="text.disabled">
						Nenhuma unidade vinculada — funcionalidade disponível em breve.
					</Typography>
				</Paper>

				{/* Histórico de Renovações — placeholder */}
				<Paper
					elevation={0}
					sx={{
						border: "1px solid",
						borderColor: "divider",
						borderRadius: 2,
						p: 3,
						gridColumn: { md: "1 / -1" },
					}}
				>
					<Typography variant="h6" fontWeight={600} mb={2}>
						Histórico de Renovações
					</Typography>
					<Typography variant="body2" color="text.disabled">
						Funcionalidade de renovações disponível em breve.
					</Typography>
				</Paper>
			</Box>

			{/* Cancel Modal */}
			<CancelContractModal
				open={cancelOpen}
				onClose={() => setCancelOpen(false)}
				contractId={contractId}
				onSuccess={() => setCancelOpen(false)}
			/>
		</Container>
	);
}
