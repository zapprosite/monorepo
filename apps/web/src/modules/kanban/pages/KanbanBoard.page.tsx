import { ErrorAlert } from "@connected-repo/ui-mui/components/ErrorAlert";
import { LoadingSpinner } from "@connected-repo/ui-mui/components/LoadingSpinner";
import { Chip } from "@connected-repo/ui-mui/data-display/Chip";
import { Typography } from "@connected-repo/ui-mui/data-display/Typography";
import { Button } from "@connected-repo/ui-mui/form/Button";
import { TextField } from "@connected-repo/ui-mui/form/TextField";
import { Alert } from "@connected-repo/ui-mui/feedback/Alert";
import { Dialog } from "@connected-repo/ui-mui/feedback/Dialog";
import { Box } from "@connected-repo/ui-mui/layout/Box";
import { Container } from "@connected-repo/ui-mui/layout/Container";
import { Paper } from "@connected-repo/ui-mui/layout/Paper";
import { MenuItem } from "@connected-repo/ui-mui/navigation/MenuItem";
import type { KanbanCardPriority, KanbanCardStatus } from "@repo/zod-schemas/crm_enums.zod";
import type { CardCreateInput } from "@repo/zod-schemas/kanban.zod";
import { cardCreateInputZod } from "@repo/zod-schemas/kanban.zod";
import { trpc } from "@frontend/utils/trpc.client";
import { zodResolver } from "@hookform/resolvers/zod";
import { DialogActions, DialogContent, DialogTitle } from "@mui/material";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useNavigate, useParams } from "react-router";

const PRIORITY_COLORS: Record<KanbanCardPriority, "success" | "info" | "warning" | "error"> = {
	Baixa: "success",
	Media: "info",
	Alta: "warning",
	Critica: "error",
};

const STATUS_COLORS: Record<
	KanbanCardStatus,
	"default" | "primary" | "error" | "success"
> = {
	Aberto: "default",
	"Em Andamento": "primary",
	Bloqueado: "error",
	Concluido: "success",
	Cancelado: "default",
};

type CardWithDetails = {
	cardId: string;
	columnId: string;
	titulo: string;
	descricao?: string | null;
	prioridade?: KanbanCardPriority | null;
	status?: KanbanCardStatus | null;
	responsavelId?: string | null;
	dataVencimento?: string | null;
	ordem?: number | null;
	createdAt: number;
	updatedAt: number;
};

type ColumnWithCards = {
	columnId: string;
	boardId: string;
	nome: string;
	ordem: number;
	limite?: number | null;
	cards: CardWithDetails[];
};

function formatDate(dateStr: string | null | undefined): string {
	if (!dateStr) return "";
	const date = new Date(`${dateStr}T12:00:00`);
	return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

function CreateCardDialog({
	open,
	onClose,
	columnId,
	columns,
	onSuccess,
}: {
	open: boolean;
	onClose: () => void;
	columnId: string;
	columns: ColumnWithCards[];
	onSuccess: () => void;
}) {
	const {
		register,
		handleSubmit,
		reset,
		formState: { errors },
	} = useForm<CardCreateInput>({
		resolver: zodResolver(cardCreateInputZod),
		defaultValues: { columnId, titulo: "", prioridade: "Media" },
	});

	const createCard = useMutation(
		trpc.kanban.createCard.mutationOptions({
			onSuccess: () => {
				reset();
				onSuccess();
				onClose();
			},
		}),
	);

	const onSubmit = (data: CardCreateInput) => {
		createCard.mutate(data);
	};

	return (
		<Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
			<DialogTitle>Novo Card</DialogTitle>
			<Box component="form" onSubmit={handleSubmit(onSubmit)}>
				<DialogContent>
					{createCard.error && (
						<Alert severity="error" sx={{ mb: 2 }}>
							{createCard.error.message}
						</Alert>
					)}
					<Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
						<TextField
							label="Coluna"
							select
							fullWidth
							defaultValue={columnId}
							{...register("columnId")}
						>
							{columns.map((col) => (
								<MenuItem key={col.columnId} value={col.columnId}>
									{col.nome}
								</MenuItem>
							))}
						</TextField>
						<TextField
							label="Título *"
							fullWidth
							error={!!errors.titulo}
							helperText={errors.titulo?.message}
							{...register("titulo")}
							autoFocus
						/>
						<TextField
							label="Prioridade"
							select
							fullWidth
							defaultValue="Media"
							{...register("prioridade")}
						>
							<MenuItem value="Baixa">Baixa</MenuItem>
							<MenuItem value="Media">Média</MenuItem>
							<MenuItem value="Alta">Alta</MenuItem>
							<MenuItem value="Critica">Crítica</MenuItem>
						</TextField>
						<TextField
							label="Data de Vencimento"
							type="date"
							fullWidth
							InputLabelProps={{ shrink: true }}
							{...register("dataVencimento")}
						/>
					</Box>
				</DialogContent>
				<DialogActions sx={{ px: 3, pb: 3 }}>
					<Button variant="outlined" onClick={onClose} disabled={createCard.isPending}>
						Cancelar
					</Button>
					<Button type="submit" variant="contained" disabled={createCard.isPending}>
						{createCard.isPending ? "Criando..." : "Criar Card"}
					</Button>
				</DialogActions>
			</Box>
		</Dialog>
	);
}

export default function KanbanBoardPage() {
	const { boardId } = useParams<{ boardId: string }>();
	const navigate = useNavigate();
	const queryClient = useQueryClient();

	const [createCardColumnId, setCreateCardColumnId] = useState<string | null>(null);

	const {
		data: board,
		isLoading,
		error,
	} = useQuery(trpc.kanban.getBoardDetail.queryOptions({ boardId: boardId! }));

	const invalidateBoard = () => {
		queryClient.invalidateQueries({
			queryKey: trpc.kanban.getBoardDetail.queryKey({ boardId: boardId! }),
		});
	};

	const moveCard = useMutation(
		trpc.kanban.moveCard.mutationOptions({ onSuccess: invalidateBoard }),
	);

	if (isLoading) return <LoadingSpinner text="Carregando board..." />;

	if (error || !board) {
		return (
			<Container maxWidth="lg" sx={{ py: 4 }}>
				<ErrorAlert message={`Erro ao carregar board: ${error?.message ?? "Não encontrado"}`} />
			</Container>
		);
	}

	const columns = board.columns as ColumnWithCards[];

	return (
		<Box sx={{ display: "flex", flexDirection: "column", height: "100%" }}>
			{/* Header */}
			<Box
				sx={{
					px: { xs: 2, md: 4 },
					py: 2,
					borderBottom: "1px solid",
					borderColor: "divider",
					bgcolor: "background.paper",
				}}
			>
				<Button
					variant="text"
					size="small"
					onClick={() => navigate("/kanban")}
					sx={{ mb: 0.5, color: "text.secondary" }}
				>
					← Voltar para Kanban
				</Button>
				<Box sx={{ display: "flex", alignItems: "center", gap: 2, flexWrap: "wrap" }}>
					{board.cor && (
						<Box
							sx={{
								width: 14,
								height: 14,
								borderRadius: "50%",
								bgcolor: board.cor,
								flexShrink: 0,
							}}
						/>
					)}
					<Typography variant="h5" fontWeight={700}>
						{board.nome}
					</Typography>
					<Chip label={board.setor} size="small" variant="outlined" />
				</Box>
			</Box>

			{/* Kanban columns */}
			<Box
				sx={{
					display: "flex",
					gap: 2,
					overflowX: "auto",
					p: { xs: 2, md: 3 },
					flexGrow: 1,
					alignItems: "flex-start",
					minHeight: 0,
				}}
			>
				{columns.length === 0 ? (
					<Box sx={{ textAlign: "center", py: 8, px: 3, width: "100%" }}>
						<Typography variant="h6" color="text.secondary" gutterBottom>
							Nenhuma coluna criada
						</Typography>
						<Typography variant="body2" color="text.disabled">
							Adicione colunas para organizar os cards do board
						</Typography>
					</Box>
				) : (
					columns.map((col) => (
						<Paper
							key={col.columnId}
							elevation={0}
							sx={{
								minWidth: 280,
								maxWidth: 320,
								flexShrink: 0,
								border: "1px solid",
								borderColor: "divider",
								borderRadius: 2,
								display: "flex",
								flexDirection: "column",
								bgcolor: "background.default",
							}}
						>
							{/* Column header */}
							<Box
								sx={{
									p: 2,
									pb: 1.5,
									borderBottom: "1px solid",
									borderColor: "divider",
									display: "flex",
									alignItems: "center",
									justifyContent: "space-between",
								}}
							>
								<Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
									<Typography variant="subtitle2" fontWeight={600}>
										{col.nome}
									</Typography>
									<Chip
										label={col.cards.length}
										size="small"
										sx={{ height: 20, fontSize: "0.7rem" }}
									/>
								</Box>
								<Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
									{col.limite != null && (
										<Chip
											label={`WIP: ${col.limite}`}
											size="small"
											color={col.cards.length >= col.limite ? "error" : "default"}
											variant="outlined"
											sx={{ height: 20, fontSize: "0.7rem" }}
										/>
									)}
									<Button
										size="small"
										variant="text"
										sx={{ minWidth: 32, p: 0.5, fontSize: "1.2rem" }}
										onClick={() => setCreateCardColumnId(col.columnId)}
									>
										+
									</Button>
								</Box>
							</Box>

							{/* Cards */}
							<Box sx={{ p: 1.5, display: "flex", flexDirection: "column", gap: 1 }}>
								{col.cards.map((card) => (
									<Paper
										key={card.cardId}
										elevation={0}
										sx={{
											border: "1px solid",
											borderColor: "divider",
											borderRadius: 1.5,
											p: 1.5,
											bgcolor: "background.paper",
											transition: "all 0.15s ease-in-out",
											"&:hover": {
												boxShadow: 2,
												borderColor: "primary.light",
											},
										}}
									>
										<Typography variant="body2" fontWeight={500} mb={1}>
											{card.titulo}
										</Typography>
										<Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap", mb: card.dataVencimento ? 1 : 0 }}>
											{card.prioridade && (
												<Chip
													label={card.prioridade}
													size="small"
													color={PRIORITY_COLORS[card.prioridade]}
													sx={{ height: 18, fontSize: "0.65rem" }}
												/>
											)}
											{card.status && (
												<Chip
													label={card.status}
													size="small"
													color={STATUS_COLORS[card.status]}
													variant="outlined"
													sx={{ height: 18, fontSize: "0.65rem" }}
												/>
											)}
										</Box>
										{card.dataVencimento && (
											<Typography variant="caption" color="text.secondary">
												Vence: {formatDate(card.dataVencimento)}
											</Typography>
										)}
										{/* Move card */}
										{columns.length > 1 && (
											<Box sx={{ mt: 1 }}>
												<TextField
													select
													size="small"
													fullWidth
													value={card.columnId}
													label="Mover para"
													onChange={(e) =>
														moveCard.mutate({
															cardId: card.cardId,
															columnId: e.target.value,
															ordem: 0,
														})
													}
													sx={{ "& .MuiInputBase-root": { fontSize: "0.75rem" } }}
												>
													{columns.map((c) => (
														<MenuItem key={c.columnId} value={c.columnId}>
															{c.nome}
														</MenuItem>
													))}
												</TextField>
											</Box>
										)}
									</Paper>
								))}
								{col.cards.length === 0 && (
									<Typography
										variant="caption"
										color="text.disabled"
										sx={{ textAlign: "center", py: 2, display: "block" }}
									>
										Nenhum card
									</Typography>
								)}
							</Box>
						</Paper>
					))
				)}
			</Box>

			{/* Create card dialog */}
			{createCardColumnId && (
				<CreateCardDialog
					open={true}
					onClose={() => setCreateCardColumnId(null)}
					columnId={createCardColumnId}
					columns={columns}
					onSuccess={invalidateBoard}
				/>
			)}
		</Box>
	);
}
