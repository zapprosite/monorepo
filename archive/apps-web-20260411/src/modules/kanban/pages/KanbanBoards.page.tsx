import { ErrorAlert } from "@connected-repo/ui-mui/components/ErrorAlert";
import { LoadingSpinner } from "@connected-repo/ui-mui/components/LoadingSpinner";
import { Chip } from "@connected-repo/ui-mui/data-display/Chip";
import { Typography } from "@connected-repo/ui-mui/data-display/Typography";
import { Button } from "@connected-repo/ui-mui/form/Button";
import { Box } from "@connected-repo/ui-mui/layout/Box";
import { Container } from "@connected-repo/ui-mui/layout/Container";
import { Paper } from "@connected-repo/ui-mui/layout/Paper";
import { trpc } from "@frontend/utils/trpc.client";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router";

export default function KanbanBoardsPage() {
	const navigate = useNavigate();

	const {
		data: boards,
		isLoading,
		error,
	} = useQuery(trpc.kanban.listBoards.queryOptions({}));

	if (isLoading) return <LoadingSpinner text="Carregando boards..." />;

	if (error) {
		return (
			<Container maxWidth="lg" sx={{ py: 4 }}>
				<ErrorAlert message={`Erro ao carregar boards: ${error.message}`} />
			</Container>
		);
	}

	return (
		<Container maxWidth="xl" sx={{ py: { xs: 3, md: 5 } }}>
			{/* Header */}
			<Box
				sx={{
					mb: 4,
					display: "flex",
					justifyContent: "space-between",
					alignItems: "center",
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
						Kanban
					</Typography>
					<Typography variant="body2" color="text.secondary">
						{boards?.length ?? 0} {boards?.length === 1 ? "board" : "boards"}
					</Typography>
				</Box>
				<Button
					variant="contained"
					onClick={() => navigate("/kanban/new")}
					sx={{
						transition: "all 0.2s ease-in-out",
						"&:hover": { transform: "translateY(-2px)", boxShadow: 4 },
					}}
				>
					Novo Board
				</Button>
			</Box>

			{/* Grid */}
			{!boards || boards.length === 0 ? (
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
						Nenhum board cadastrado
					</Typography>
					<Typography variant="body2" color="text.disabled" mb={3}>
						Crie o primeiro board para organizar as tarefas do time
					</Typography>
					<Button variant="contained" onClick={() => navigate("/kanban/new")}>
						Novo Board
					</Button>
				</Paper>
			) : (
				<Box
					sx={{
						display: "grid",
						gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr", md: "1fr 1fr 1fr" },
						gap: 2.5,
					}}
				>
					{boards.map((board) => (
						<Paper
							key={board.boardId}
							elevation={0}
							onClick={() => navigate(`/kanban/${board.boardId}`)}
							sx={{
								border: "1px solid",
								borderColor: "divider",
								borderLeft: board.cor ? `4px solid ${board.cor}` : "1px solid",
								borderLeftColor: board.cor ?? "divider",
								borderRadius: 2,
								p: 3,
								cursor: "pointer",
								transition: "all 0.2s ease-in-out",
								"&:hover": {
									borderColor: "primary.main",
									transform: "translateY(-3px)",
									boxShadow: 4,
								},
							}}
						>
							<Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", mb: 1.5 }}>
								<Typography variant="h6" fontWeight={600} noWrap sx={{ flex: 1, mr: 1 }}>
									{board.nome}
								</Typography>
								{board.cor && (
									<Box
										sx={{
											width: 16,
											height: 16,
											borderRadius: "50%",
											bgcolor: board.cor,
											flexShrink: 0,
											mt: 0.5,
										}}
									/>
								)}
							</Box>
							<Chip label={board.setor} size="small" variant="outlined" sx={{ mb: 1.5 }} />
							{board.descricao && (
								<Typography
									variant="body2"
									color="text.secondary"
									sx={{
										mt: 1,
										overflow: "hidden",
										display: "-webkit-box",
										WebkitLineClamp: 2,
										WebkitBoxOrient: "vertical",
									}}
								>
									{board.descricao}
								</Typography>
							)}
						</Paper>
					))}
				</Box>
			)}
		</Container>
	);
}
