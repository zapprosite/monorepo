import { ErrorAlert } from "@repo/ui-mui/components/ErrorAlert";
import { Typography } from "@repo/ui-mui/data-display/Typography";
import { Button } from "@repo/ui-mui/form/Button";
import { TextField } from "@repo/ui-mui/form/TextField";
import { Box } from "@repo/ui-mui/layout/Box";
import { Container } from "@repo/ui-mui/layout/Container";
import { Paper } from "@repo/ui-mui/layout/Paper";
import type { BoardCreateInput } from "@repo/zod-schemas/kanban.zod";
import { boardCreateInputZod } from "@repo/zod-schemas/kanban.zod";
import { trpc } from "@frontend/utils/trpc.client";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router";

export default function CreateBoardPage() {
	const navigate = useNavigate();

	const {
		register,
		handleSubmit,
		watch,
		formState: { errors, isSubmitting },
	} = useForm<BoardCreateInput>({
		resolver: zodResolver(boardCreateInputZod),
		defaultValues: {
			nome: "",
			setor: "",
			descricao: null,
			cor: null,
		},
	});

	const corValue = watch("cor");

	const createBoard = useMutation(
		trpc.kanban.createBoard.mutationOptions({
			onSuccess: (board) => {
				navigate(`/kanban/${board.boardId}`);
			},
		}),
	);

	const onSubmit = (data: BoardCreateInput) => {
		createBoard.mutate(data);
	};

	return (
		<Container maxWidth="sm" sx={{ py: { xs: 3, md: 5 } }}>
			<Box sx={{ mb: 4 }}>
				<Button
					variant="text"
					size="small"
					onClick={() => navigate("/kanban")}
					sx={{ mb: 1, color: "text.secondary" }}
				>
					← Voltar para Kanban
				</Button>
				<Typography
					variant="h4"
					fontWeight={700}
					letterSpacing={-0.5}
				>
					Novo Board
				</Typography>
				<Typography variant="body2" color="text.secondary" mt={0.5}>
					Crie um board para organizar tarefas por setor
				</Typography>
			</Box>

			{createBoard.error && (
				<ErrorAlert message={`Erro ao criar board: ${createBoard.error.message}`} />
			)}

			<Paper
				elevation={0}
				sx={{ border: "1px solid", borderColor: "divider", borderRadius: 2, p: 3 }}
				component="form"
				onSubmit={handleSubmit(onSubmit)}
			>
				<Box sx={{ display: "flex", flexDirection: "column", gap: 2.5 }}>
					<TextField
						label="Nome *"
						fullWidth
						error={!!errors.nome}
						helperText={errors.nome?.message}
						{...register("nome")}
					/>

					<TextField
						label="Setor *"
						fullWidth
						error={!!errors.setor}
						helperText={errors.setor?.message ?? "Ex: Comercial, Técnico, Financeiro"}
						{...register("setor")}
					/>

					{/* Color picker */}
					<Box>
						<Typography variant="caption" color="text.secondary" display="block" mb={0.5}>
							Cor do Board
						</Typography>
						<Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
							<Box
								component="input"
								type="color"
								defaultValue="#1976d2"
								{...register("cor")}
								sx={{
									width: 48,
									height: 40,
									borderRadius: 1,
									border: "1px solid",
									borderColor: "divider",
									cursor: "pointer",
									padding: "2px",
									bgcolor: "background.paper",
								}}
							/>
							{corValue && (
								<Box
									sx={{
										width: 24,
										height: 24,
										borderRadius: "50%",
										bgcolor: corValue,
										border: "1px solid",
										borderColor: "divider",
									}}
								/>
							)}
							<Typography variant="body2" color="text.secondary">
								{corValue ?? "Nenhuma cor selecionada"}
							</Typography>
						</Box>
					</Box>

					<TextField
						label="Descrição"
						fullWidth
						multiline
						rows={3}
						error={!!errors.descricao}
						helperText={errors.descricao?.message}
						{...register("descricao")}
					/>

					<Box sx={{ display: "flex", gap: 2, justifyContent: "flex-end", mt: 1 }}>
						<Button
							variant="outlined"
							onClick={() => navigate("/kanban")}
							disabled={isSubmitting || createBoard.isPending}
						>
							Cancelar
						</Button>
						<Button
							type="submit"
							variant="contained"
							disabled={isSubmitting || createBoard.isPending}
						>
							{createBoard.isPending ? "Criando..." : "Criar Board"}
						</Button>
					</Box>
				</Box>
			</Paper>
		</Container>
	);
}
