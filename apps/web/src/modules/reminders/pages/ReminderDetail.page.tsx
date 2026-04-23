import { ErrorAlert } from "@connected-repo/ui-mui/components/ErrorAlert";
import { LoadingSpinner } from "@connected-repo/ui-mui/components/LoadingSpinner";
import { Typography } from "@connected-repo/ui-mui/data-display/Typography";
import { Button } from "@connected-repo/ui-mui/form/Button";
import { Box } from "@connected-repo/ui-mui/layout/Box";
import { Container } from "@connected-repo/ui-mui/layout/Container";
import { Paper } from "@connected-repo/ui-mui/layout/Paper";
import type { ReminderStatus } from "@repo/zod-schemas/crm_enums.zod";
import { trpc } from "@frontend/utils/trpc.client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router";
import { ReminderStatusBadge } from "../components/ReminderStatusBadge";

function formatDate(dateStr: string | null | undefined): string {
	if (!dateStr) return "—";
	const date = new Date(`${dateStr}T12:00:00`);
	return date.toLocaleDateString("pt-BR", {
		day: "2-digit",
		month: "long",
		year: "numeric",
	});
}

export default function ReminderDetailPage() {
	const { reminderId } = useParams<{ reminderId: string }>();
	const navigate = useNavigate();
	const queryClient = useQueryClient();

	const {
		data: reminder,
		isLoading,
		error,
	} = useQuery(trpc.reminders.getReminderDetail.queryOptions({ reminderId: reminderId! }));

	const invalidate = () => {
		queryClient.invalidateQueries({ queryKey: trpc.reminders.listReminders.queryKey() });
		queryClient.invalidateQueries({
			queryKey: trpc.reminders.getReminderDetail.queryKey({ reminderId: reminderId! }),
		});
	};

	const completeReminder = useMutation(
		trpc.reminders.completeReminder.mutationOptions({ onSuccess: invalidate }),
	);
	const cancelReminder = useMutation(
		trpc.reminders.cancelReminder.mutationOptions({ onSuccess: invalidate }),
	);

	if (isLoading) return <LoadingSpinner text="Carregando lembrete..." />;

	if (error || !reminder) {
		return (
			<Container maxWidth="lg" sx={{ py: 4 }}>
				<ErrorAlert message={`Erro ao carregar lembrete: ${error?.message ?? "Não encontrado"}`} />
			</Container>
		);
	}

	const status = reminder.status as ReminderStatus;
	const isBusy = completeReminder.isPending || cancelReminder.isPending;

	return (
		<Container maxWidth="lg" sx={{ py: { xs: 3, md: 5 } }}>
			{/* Header */}
			<Box sx={{ mb: 4 }}>
				<Button
					variant="text"
					size="small"
					onClick={() => navigate("/reminders")}
					sx={{ mb: 1, color: "text.secondary" }}
				>
					← Voltar para Lembretes
				</Button>
				<Box sx={{ display: "flex", alignItems: "center", gap: 2, flexWrap: "wrap" }}>
					<Typography variant="h4" fontWeight={700}>
						{reminder.titulo}
					</Typography>
					<ReminderStatusBadge status={status} />
				</Box>
				<Typography variant="body2" color="text.secondary" mt={0.5}>
					{reminder.clienteNome ?? "—"}
				</Typography>
			</Box>

			{/* Action buttons — only for Pendente */}
			{status === "Pendente" && (
				<Box sx={{ display: "flex", gap: 2, mb: 4, flexWrap: "wrap" }}>
					<Button
						variant="contained"
						color="success"
						disabled={isBusy}
						onClick={() => completeReminder.mutate({ reminderId: reminder.reminderId })}
					>
						Marcar Concluído
					</Button>
					<Button
						variant="outlined"
						color="error"
						disabled={isBusy}
						onClick={() => cancelReminder.mutate({ reminderId: reminder.reminderId })}
					>
						Cancelar
					</Button>
				</Box>
			)}

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
							Tipo
						</Typography>
						<Typography variant="body2">{reminder.tipo}</Typography>
					</Box>
					<Box>
						<Typography variant="caption" color="text.secondary">
							Data do Lembrete
						</Typography>
						<Typography variant="body2">{formatDate(reminder.dataLembrete)}</Typography>
					</Box>
					{reminder.descricao && (
						<Box>
							<Typography variant="caption" color="text.secondary">
								Descrição
							</Typography>
							<Typography variant="body2" sx={{ whiteSpace: "pre-wrap" }}>
								{reminder.descricao}
							</Typography>
						</Box>
					)}
					{!reminder.descricao && (
						<Typography variant="body2" color="text.disabled">
							Sem descrição adicional
						</Typography>
					)}
				</Box>
			</Paper>
		</Container>
	);
}
