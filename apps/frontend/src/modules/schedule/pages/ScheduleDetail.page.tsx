import { ErrorAlert } from "@connected-repo/ui-mui/components/ErrorAlert";
import { LoadingSpinner } from "@connected-repo/ui-mui/components/LoadingSpinner";
import { Typography } from "@connected-repo/ui-mui/data-display/Typography";
import { Dialog } from "@connected-repo/ui-mui/feedback/Dialog";
import { DialogActions } from "@connected-repo/ui-mui/feedback/DialogActions";
import { DialogContent } from "@connected-repo/ui-mui/feedback/DialogContent";
import { DialogTitle } from "@connected-repo/ui-mui/feedback/DialogTitle";
import { Button } from "@connected-repo/ui-mui/form/Button";
import { TextField } from "@connected-repo/ui-mui/form/TextField";
import { Box } from "@connected-repo/ui-mui/layout/Box";
import { Container } from "@connected-repo/ui-mui/layout/Container";
import { Paper } from "@connected-repo/ui-mui/layout/Paper";
import { trpc } from "@frontend/utils/trpc.client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useNavigate, useParams } from "react-router";
import { ScheduleStatusBadge } from "../components/ScheduleStatusBadge";

function formatDateTime(timestamp: number | string | Date): string {
	const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
	return date.toLocaleString("pt-BR", {
		weekday: "long",
		day: "2-digit",
		month: "long",
		year: "numeric",
		hour: "2-digit",
		minute: "2-digit",
	});
}

export default function ScheduleDetailPage() {
	const { scheduleId } = useParams<{ scheduleId: string }>();
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const [cancelOpen, setCancelOpen] = useState(false);
	const [motivoCancelamento, setMotivoCancelamento] = useState("");

	const {
		data: schedule,
		isLoading,
		error,
	} = useQuery(trpc.schedule.getScheduleDetail.queryOptions({ scheduleId: scheduleId! }));

	const invalidate = () => {
		queryClient.invalidateQueries({ queryKey: trpc.schedule.listSchedules.queryKey() });
		queryClient.invalidateQueries({
			queryKey: trpc.schedule.getScheduleDetail.queryKey({ scheduleId: scheduleId! }),
		});
	};

	const confirmar = useMutation(
		trpc.schedule.confirmarAgendamento.mutationOptions({ onSuccess: invalidate }),
	);
	const iniciar = useMutation(
		trpc.schedule.iniciarAtendimento.mutationOptions({ onSuccess: invalidate }),
	);
	const concluir = useMutation(
		trpc.schedule.concluirAtendimento.mutationOptions({ onSuccess: invalidate }),
	);
	const cancelar = useMutation(
		trpc.schedule.cancelarAgendamento.mutationOptions({
			onSuccess: () => {
				invalidate();
				setCancelOpen(false);
				setMotivoCancelamento("");
			},
		}),
	);

	if (isLoading) return <LoadingSpinner text="Carregando agendamento..." />;

	if (error || !schedule) {
		return (
			<Container maxWidth="lg" sx={{ py: 4 }}>
				<ErrorAlert
					message={`Erro ao carregar agendamento: ${error?.message ?? "Não encontrado"}`}
				/>
			</Container>
		);
	}

	const isBusy =
		confirmar.isPending || iniciar.isPending || concluir.isPending || cancelar.isPending;

	return (
		<Container maxWidth="lg" sx={{ py: { xs: 3, md: 5 } }}>
			{/* Header */}
			<Box sx={{ mb: 4 }}>
				<Button
					variant="text"
					size="small"
					onClick={() => navigate("/schedule")}
					sx={{ mb: 1, color: "text.secondary" }}
				>
					← Voltar para Agenda
				</Button>
				<Box sx={{ display: "flex", alignItems: "center", gap: 2, flexWrap: "wrap" }}>
					<Typography variant="h4" fontWeight={700}>
						{schedule.tipo}
					</Typography>
					<ScheduleStatusBadge status={schedule.status} />
				</Box>
				<Typography variant="body2" color="text.secondary" mt={0.5}>
					{formatDateTime(schedule.dataHora)}
				</Typography>
			</Box>

			{/* Action buttons */}
			<Box sx={{ display: "flex", gap: 2, mb: 4, flexWrap: "wrap" }}>
				{schedule.status === "Agendado" && (
					<Button
						variant="contained"
						color="info"
						disabled={isBusy}
						onClick={() => confirmar.mutate({ scheduleId: schedule.scheduleId })}
					>
						Confirmar
					</Button>
				)}
				{schedule.status === "Confirmado" && (
					<Button
						variant="contained"
						color="warning"
						disabled={isBusy}
						onClick={() => iniciar.mutate({ scheduleId: schedule.scheduleId })}
					>
						Iniciar Atendimento
					</Button>
				)}
				{schedule.status === "Em Andamento" && (
					<Button
						variant="contained"
						color="success"
						disabled={isBusy}
						onClick={() => concluir.mutate({ scheduleId: schedule.scheduleId })}
					>
						Concluir Atendimento
					</Button>
				)}
				{schedule.status !== "Cancelado" && schedule.status !== "Concluído" && (
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

			{/* Details */}
			<Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: 3 }}>
				<Paper
					elevation={0}
					sx={{ border: "1px solid", borderColor: "divider", borderRadius: 2, p: 3 }}
				>
					<Typography variant="h6" fontWeight={600} mb={2}>
						Informações do Agendamento
					</Typography>
					<Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
						<Box>
							<Typography variant="caption" color="text.secondary">
								Data e Hora
							</Typography>
							<Typography variant="body2">{formatDateTime(schedule.dataHora)}</Typography>
						</Box>
						<Box>
							<Typography variant="caption" color="text.secondary">
								Tipo de Serviço
							</Typography>
							<Typography variant="body2">{schedule.tipo}</Typography>
						</Box>
						<Box>
							<Typography variant="caption" color="text.secondary">
								Duração
							</Typography>
							<Typography variant="body2">{schedule.duracaoMinutos ?? 60} minutos</Typography>
						</Box>
						{schedule.tecnicoId && (
							<Box>
								<Typography variant="caption" color="text.secondary">
									Técnico
								</Typography>
								<Typography variant="body2">{schedule.tecnicoId}</Typography>
							</Box>
						)}
					</Box>
				</Paper>

				<Paper
					elevation={0}
					sx={{ border: "1px solid", borderColor: "divider", borderRadius: 2, p: 3 }}
				>
					<Typography variant="h6" fontWeight={600} mb={2}>
						Detalhes
					</Typography>
					<Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
						{schedule.descricao && (
							<Box>
								<Typography variant="caption" color="text.secondary">
									Descrição
								</Typography>
								<Typography variant="body2">{schedule.descricao}</Typography>
							</Box>
						)}
						{schedule.observacoes && (
							<Box>
								<Typography variant="caption" color="text.secondary">
									Observações
								</Typography>
								<Typography variant="body2">{schedule.observacoes}</Typography>
							</Box>
						)}
						{schedule.motivoCancelamento && (
							<Box>
								<Typography variant="caption" color="error.main">
									Motivo do Cancelamento
								</Typography>
								<Typography variant="body2">{schedule.motivoCancelamento}</Typography>
							</Box>
						)}
						{!schedule.descricao && !schedule.observacoes && !schedule.motivoCancelamento && (
							<Typography variant="body2" color="text.disabled">
								Sem detalhes adicionais
							</Typography>
						)}
					</Box>
				</Paper>
			</Box>

			{/* Cancel Modal */}
			<Dialog
				open={cancelOpen}
				onClose={() => {
					setCancelOpen(false);
					setMotivoCancelamento("");
				}}
				maxWidth="sm"
				fullWidth
			>
				<DialogTitle>Cancelar Agendamento</DialogTitle>
				<DialogContent>
					<Typography variant="body2" color="text.secondary" mb={2}>
						Informe o motivo do cancelamento (opcional).
					</Typography>
					<TextField
						label="Motivo do cancelamento"
						multiline
						rows={3}
						fullWidth
						value={motivoCancelamento}
						onChange={(e) => setMotivoCancelamento(e.target.value)}
					/>
				</DialogContent>
				<DialogActions>
					<Button
						onClick={() => {
							setCancelOpen(false);
							setMotivoCancelamento("");
						}}
						variant="outlined"
						disabled={cancelar.isPending}
					>
						Voltar
					</Button>
					<Button
						variant="contained"
						color="error"
						disabled={cancelar.isPending}
						onClick={() =>
							cancelar.mutate({
								scheduleId: schedule.scheduleId,
								motivoCancelamento: motivoCancelamento || undefined,
							})
						}
					>
						{cancelar.isPending ? "Cancelando..." : "Confirmar Cancelamento"}
					</Button>
				</DialogActions>
			</Dialog>
		</Container>
	);
}
