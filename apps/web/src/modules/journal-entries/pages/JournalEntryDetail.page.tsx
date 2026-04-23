import { ErrorAlert } from "@connected-repo/ui-mui/components/ErrorAlert";
import { LoadingSpinner } from "@connected-repo/ui-mui/components/LoadingSpinner";
import { Typography } from "@connected-repo/ui-mui/data-display/Typography";
import { Alert } from "@connected-repo/ui-mui/feedback/Alert";
import {
	Dialog,
	DialogActions,
	DialogContent,
	DialogContentText,
	DialogTitle,
} from "@connected-repo/ui-mui/feedback/Dialog";
import { Button } from "@connected-repo/ui-mui/form/Button";
import { TextField } from "@connected-repo/ui-mui/form/TextField";
import { ArrowBackIcon } from "@connected-repo/ui-mui/icons/ArrowBackIcon";
import { CalendarTodayIcon } from "@connected-repo/ui-mui/icons/CalendarTodayIcon";
import { DeleteIcon } from "@connected-repo/ui-mui/icons/DeleteIcon";
import { Box } from "@connected-repo/ui-mui/layout/Box";
import { Card, CardContent } from "@connected-repo/ui-mui/layout/Card";
import { Container } from "@connected-repo/ui-mui/layout/Container";
import { Divider } from "@connected-repo/ui-mui/layout/Divider";
import { Stack } from "@connected-repo/ui-mui/layout/Stack";
import { trpc } from "@frontend/utils/trpc.client";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useNavigate, useParams } from "react-router";

export default function JournalEntryDetailPage() {
	const navigate = useNavigate();
	const { entryId } = useParams<{ entryId: string }>();
	const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
	const [confirmationText, setConfirmationText] = useState("");
	const [deleteError, setDeleteError] = useState<string | null>(null);

	const {
		data: journalEntry,
		isLoading,
		error,
	} = useQuery(trpc.journalEntries.getById.queryOptions({ journalEntryId: entryId || "" }));

	const deleteMutation = useMutation(trpc.journalEntries.delete.mutationOptions());

	const handleDeleteClick = () => {
		setDeleteDialogOpen(true);
		setConfirmationText("");
		setDeleteError(null);
	};

	const handleDeleteConfirm = async () => {
		if (confirmationText.toLowerCase() !== "excluir") {
			setDeleteError('Digite "EXCLUIR" para confirmar');
			return;
		}

		try {
			await deleteMutation.mutateAsync({ journalEntryId: entryId || "" });
			navigate("/journal-entries", { replace: true });
		} catch (_error) {
			setDeleteError("Não foi possível excluir a entrada do diário. Tente novamente.");
		}
	};

	const handleDeleteCancelar = () => {
		setDeleteDialogOpen(false);
		setConfirmationText("");
		setDeleteError(null);
	};

	const formatDate = (timestamp: number) => {
		return new Date(timestamp).toLocaleDateString("pt-BR", {
			year: "numeric",
			month: "long",
			day: "numeric",
			hour: "2-digit",
			minute: "2-digit",
		});
	};

	if (isLoading) return <LoadingSpinner text="Carregando entrada do diário..." />;

	if (error) {
		const errorMessage = error.data?.userFriendlyMessage || error.message;
		return (
			<Container maxWidth="lg" sx={{ py: 4 }}>
				<ErrorAlert message={`Erro ao carregar entrada do diário: ${errorMessage}`} />
			</Container>
		);
	}

	if (!journalEntry) {
		return (
			<Container maxWidth="lg" sx={{ py: 4 }}>
				<Alert severity="error">Entrada do diário não encontrada</Alert>
			</Container>
		);
	}

	return (
		<Container maxWidth="md" sx={{ py: { xs: 3, md: 5 } }}>
			{/* Back Button */}
			<Button
				startIcon={<ArrowBackIcon />}
				onClick={() => navigate("/journal-entries")}
				sx={{
					mb: 3,
					color: "text.secondary",
					"&:hover": {
						color: "primary.main",
						bgcolor: "action.hover",
					},
				}}
			>
				Voltar para o diário
			</Button>

			{/* Main Card */}
			<Card
				sx={{
					boxShadow: 3,
					borderRadius: 2,
					border: "1px solid",
					borderColor: "divider",
					transition: "box-shadow 0.3s ease-in-out",
					"&:hover": {
						boxShadow: 6,
					},
				}}
			>
				<CardContent sx={{ p: { xs: 3, md: 4 } }}>
					{/* Header Section */}
					<Stack
						direction={{ xs: "column", sm: "row" }}
						justifyContent="space-between"
						alignItems={{ xs: "flex-start", sm: "center" }}
						spacing={2}
						sx={{ mb: 3 }}
					>
						<Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
							<CalendarTodayIcon sx={{ fontSize: 20, color: "text.secondary" }} />
							<Typography variant="body2" color="text.secondary">
								{formatDate(journalEntry.createdAt)}
							</Typography>
						</Box>
						<Button
							variant="outlined"
							color="error"
							startIcon={<DeleteIcon />}
							onClick={handleDeleteClick}
							sx={{
								transition: "all 0.2s ease-in-out",
								"&:hover": {
									transform: "translateY(-2px)",
									boxShadow: 2,
								},
							}}
						>
							Excluir entrada
						</Button>
					</Stack>

					<Divider sx={{ mb: 4 }} />

					{/* Prompt Section */}
					{journalEntry.prompt && (
						<Box sx={{ mb: 4 }}>
							<Typography
								variant="overline"
								color="primary.main"
								sx={{
									fontWeight: 600,
									letterSpacing: "0.1em",
									display: "block",
									mb: 1,
								}}
							>
								Prompt
							</Typography>
							<Box
								sx={{
									bgcolor: "primary.lighter",
									borderLeft: "4px solid",
									borderColor: "primary.main",
									p: 2,
									borderRadius: 1,
								}}
							>
								<Typography
									variant="body1"
									sx={{
										fontStyle: "italic",
										color: "text.primary",
										lineHeight: 1.7,
									}}
								>
									{journalEntry.prompt}
								</Typography>
							</Box>
						</Box>
					)}

					{/* Content Section */}
					<Box>
						<Typography
							variant="overline"
							color="text.secondary"
							sx={{
								fontWeight: 600,
								letterSpacing: "0.1em",
								display: "block",
								mb: 2,
							}}
						>
							Sua entrada
						</Typography>
						<Typography
							variant="body1"
							sx={{
								whiteSpace: "pre-wrap",
								lineHeight: 1.8,
								color: "text.primary",
								fontSize: "1.05rem",
							}}
						>
							{journalEntry.content}
						</Typography>
					</Box>
				</CardContent>
			</Card>

			{/* Delete Confirmation Dialog */}
			<Dialog open={deleteDialogOpen} onClose={handleDeleteCancelar} maxWidth="sm" fullWidth>
				<DialogTitle>Excluir entrada do diário?</DialogTitle>
				<DialogContent>
					<DialogContentText sx={{ mb: 3 }}>
						Esta ação não pode ser desfeita. Para confirmar a exclusão, digite{" "}
						<Typography component="span" fontWeight={600} color="error.main">
							EXCLUIR
						</Typography>{" "}
						abaixo.
					</DialogContentText>
					<TextField
						fullWidth
						label="Digite EXCLUIR para confirmar"
						value={confirmationText}
						onChange={(e) => setConfirmationText(e.target.value)}
						error={!!deleteError}
						helperText={deleteError}
						autoFocus
						sx={{
							"& .MuiOutlinedInput-root": {
								"&.Mui-focused fieldset": {
									borderWidth: 2,
								},
							},
						}}
					/>
				</DialogContent>
				<DialogActions sx={{ px: 3, pb: 3 }}>
					<Button onClick={handleDeleteCancelar} disabled={deleteMutation.isPending}>
						Cancelar
					</Button>
					<Button
						onClick={handleDeleteConfirm}
						color="error"
						variant="contained"
						disabled={deleteMutation.isPending}
						sx={{
							transition: "all 0.2s ease-in-out",
							"&:hover": {
								transform: "translateY(-2px)",
								boxShadow: 4,
							},
						}}
					>
						{deleteMutation.isPending ? "Excluindo..." : "Excluir entrada"}
					</Button>
				</DialogActions>
			</Dialog>
		</Container>
	);
}
