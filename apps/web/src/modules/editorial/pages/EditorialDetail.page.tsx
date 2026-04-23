import { ErrorAlert } from "@connected-repo/ui-mui/components/ErrorAlert";
import { LoadingSpinner } from "@connected-repo/ui-mui/components/LoadingSpinner";
import { Typography } from "@connected-repo/ui-mui/data-display/Typography";
import { Button } from "@connected-repo/ui-mui/form/Button";
import { Box } from "@connected-repo/ui-mui/layout/Box";
import { Container } from "@connected-repo/ui-mui/layout/Container";
import { Paper } from "@connected-repo/ui-mui/layout/Paper";
import type { EditorialStatus } from "@repo/zod-schemas/crm_enums.zod";
import { trpc } from "@frontend/utils/trpc.client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router";
import { EditorialStatusBadge } from "../components/EditorialStatusBadge";

function formatDate(dateStr: string | null | undefined): string {
	if (!dateStr) return "—";
	const date = new Date(`${dateStr}T12:00:00`);
	return date.toLocaleDateString("pt-BR", {
		day: "2-digit",
		month: "long",
		year: "numeric",
	});
}

export default function EditorialDetailPage() {
	const { editorialId } = useParams<{ editorialId: string }>();
	const navigate = useNavigate();
	const queryClient = useQueryClient();

	const {
		data: item,
		isLoading,
		error,
	} = useQuery(trpc.editorial.getEditorialDetail.queryOptions({ editorialId: editorialId! }));

	const invalidate = () => {
		queryClient.invalidateQueries({ queryKey: trpc.editorial.listEditorialItems.queryKey() });
		queryClient.invalidateQueries({
			queryKey: trpc.editorial.getEditorialDetail.queryKey({ editorialId: editorialId! }),
		});
	};

	const moveToProducao = useMutation(
		trpc.editorial.moveToProducao.mutationOptions({ onSuccess: invalidate }),
	);
	const moveToRevisao = useMutation(
		trpc.editorial.moveToRevisao.mutationOptions({ onSuccess: invalidate }),
	);
	const approveItem = useMutation(
		trpc.editorial.approveItem.mutationOptions({ onSuccess: invalidate }),
	);
	const publishItem = useMutation(
		trpc.editorial.publishItem.mutationOptions({ onSuccess: invalidate }),
	);
	const cancelItem = useMutation(
		trpc.editorial.cancelItem.mutationOptions({ onSuccess: invalidate }),
	);

	if (isLoading) return <LoadingSpinner text="Carregando item editorial..." />;

	if (error || !item) {
		return (
			<Container maxWidth="lg" sx={{ py: 4 }}>
				<ErrorAlert
					message={`Erro ao carregar item editorial: ${error?.message ?? "Não encontrado"}`}
				/>
			</Container>
		);
	}

	const status = item.status as EditorialStatus;
	const isBusy =
		moveToProducao.isPending ||
		moveToRevisao.isPending ||
		approveItem.isPending ||
		publishItem.isPending ||
		cancelItem.isPending;

	return (
		<Container maxWidth="lg" sx={{ py: { xs: 3, md: 5 } }}>
			{/* Header */}
			<Box sx={{ mb: 4 }}>
				<Button
					variant="text"
					size="small"
					onClick={() => navigate("/editorial")}
					sx={{ mb: 1, color: "text.secondary" }}
				>
					← Voltar para Calendário Editorial
				</Button>
				<Box sx={{ display: "flex", alignItems: "center", gap: 2, flexWrap: "wrap" }}>
					<Typography variant="h4" fontWeight={700}>
						{item.titulo}
					</Typography>
					<EditorialStatusBadge status={status} />
				</Box>
			</Box>

			{/* Action buttons */}
			<Box sx={{ display: "flex", gap: 2, mb: 4, flexWrap: "wrap" }}>
				{status === "Ideia" && (
					<Button
						variant="contained"
						color="warning"
						disabled={isBusy}
						onClick={() => moveToProducao.mutate({ editorialId: item.editorialId })}
					>
						Iniciar Produção
					</Button>
				)}
				{status === "Em Produção" && (
					<Button
						variant="contained"
						color="info"
						disabled={isBusy}
						onClick={() => moveToRevisao.mutate({ editorialId: item.editorialId })}
					>
						Enviar para Revisão
					</Button>
				)}
				{status === "Revisão" && (
					<Button
						variant="contained"
						color="primary"
						disabled={isBusy}
						onClick={() => approveItem.mutate({ editorialId: item.editorialId })}
					>
						Aprovar
					</Button>
				)}
				{status === "Aprovado" && (
					<Button
						variant="contained"
						color="success"
						disabled={isBusy}
						onClick={() => publishItem.mutate({ editorialId: item.editorialId })}
					>
						Marcar Publicado
					</Button>
				)}
				{status !== "Publicado" && status !== "Cancelado" && (
					<Button
						variant="outlined"
						color="error"
						disabled={isBusy}
						onClick={() => cancelItem.mutate({ editorialId: item.editorialId })}
					>
						Cancelar
					</Button>
				)}
			</Box>

			{/* Details Grid */}
			<Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: 3 }}>
				{/* Info panel */}
				<Paper
					elevation={0}
					sx={{ border: "1px solid", borderColor: "divider", borderRadius: 2, p: 3 }}
				>
					<Typography variant="h6" fontWeight={600} mb={2}>
						Informações
					</Typography>
					<Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
						<Box>
							<Typography variant="caption" color="text.secondary">
								Canal
							</Typography>
							<Typography variant="body2">{item.canal}</Typography>
						</Box>
						<Box>
							<Typography variant="caption" color="text.secondary">
								Formato
							</Typography>
							<Typography variant="body2">{item.formato}</Typography>
						</Box>
						<Box>
							<Typography variant="caption" color="text.secondary">
								Data de Publicação
							</Typography>
							<Typography variant="body2">{formatDate(item.dataPublicacao)}</Typography>
						</Box>
						{item.cta && (
							<Box>
								<Typography variant="caption" color="text.secondary">
									CTA
								</Typography>
								<Typography variant="body2">{item.cta}</Typography>
							</Box>
						)}
					</Box>
				</Paper>

				{/* Content panel */}
				<Paper
					elevation={0}
					sx={{ border: "1px solid", borderColor: "divider", borderRadius: 2, p: 3 }}
				>
					<Typography variant="h6" fontWeight={600} mb={2}>
						Conteúdo
					</Typography>
					<Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
						{item.pauta && (
							<Box>
								<Typography variant="caption" color="text.secondary">
									Pauta
								</Typography>
								<Typography variant="body2" sx={{ whiteSpace: "pre-wrap" }}>
									{item.pauta}
								</Typography>
							</Box>
						)}
						{item.copy && (
							<Box>
								<Typography variant="caption" color="text.secondary">
									Copy
								</Typography>
								<Typography variant="body2" sx={{ whiteSpace: "pre-wrap" }}>
									{item.copy}
								</Typography>
							</Box>
						)}
						{item.observacoes && (
							<Box>
								<Typography variant="caption" color="text.secondary">
									Observações
								</Typography>
								<Typography variant="body2">{item.observacoes}</Typography>
							</Box>
						)}
						{!item.pauta && !item.copy && !item.observacoes && (
							<Typography variant="body2" color="text.disabled">
								Sem conteúdo adicional
							</Typography>
						)}
					</Box>
				</Paper>
			</Box>
		</Container>
	);
}
