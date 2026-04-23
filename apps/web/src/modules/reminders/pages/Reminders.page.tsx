import { ErrorAlert } from "@connected-repo/ui-mui/components/ErrorAlert";
import { LoadingSpinner } from "@connected-repo/ui-mui/components/LoadingSpinner";
import { Chip } from "@connected-repo/ui-mui/data-display/Chip";
import { Typography } from "@connected-repo/ui-mui/data-display/Typography";
import { Button } from "@connected-repo/ui-mui/form/Button";
import { TextField } from "@connected-repo/ui-mui/form/TextField";
import { Box } from "@connected-repo/ui-mui/layout/Box";
import { Container } from "@connected-repo/ui-mui/layout/Container";
import { Paper } from "@connected-repo/ui-mui/layout/Paper";
import { MenuItem } from "@connected-repo/ui-mui/navigation/MenuItem";
import type { ReminderStatus, ReminderType } from "@repo/zod-schemas/crm_enums.zod";
import {
	REMINDER_STATUS_ENUM,
	REMINDER_TYPE_ENUM,
} from "@repo/zod-schemas/crm_enums.zod";
import { trpc } from "@frontend/utils/trpc.client";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useNavigate } from "react-router";
import { ReminderStatusBadge } from "../components/ReminderStatusBadge";

function formatDate(dateStr: string | null | undefined): string {
	if (!dateStr) return "—";
	const date = new Date(`${dateStr}T12:00:00`);
	return date.toLocaleDateString("pt-BR", {
		day: "2-digit",
		month: "2-digit",
		year: "numeric",
	});
}

export default function RemindersPage() {
	const navigate = useNavigate();
	const [filterStatus, setFilterStatus] = useState<ReminderStatus | "">("");
	const [filterTipo, setFilterTipo] = useState<ReminderType | "">("");
	const [filterDataInicio, setFilterDataInicio] = useState("");
	const [filterDataFim, setFilterDataFim] = useState("");

	const {
		data: reminders,
		isLoading,
		error,
	} = useQuery(
		trpc.reminders.listReminders.queryOptions({
			status: filterStatus || undefined,
			tipo: filterTipo || undefined,
			dataInicio: filterDataInicio || undefined,
			dataFim: filterDataFim || undefined,
		}),
	);

	if (isLoading) return <LoadingSpinner text="Carregando lembretes..." />;

	if (error) {
		return (
			<Container maxWidth="lg" sx={{ py: 4 }}>
				<ErrorAlert message={`Erro ao carregar lembretes: ${error.message}`} />
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
						Lembretes
					</Typography>
					<Typography variant="body2" color="text.secondary">
						{reminders?.length ?? 0} lembretes
					</Typography>
				</Box>
				<Button
					variant="contained"
					onClick={() => navigate("/reminders/new")}
					sx={{
						transition: "all 0.2s ease-in-out",
						"&:hover": { transform: "translateY(-2px)", boxShadow: 4 },
					}}
				>
					Novo Lembrete
				</Button>
			</Box>

			{/* Filters */}
			<Paper
				elevation={0}
				sx={{ border: "1px solid", borderColor: "divider", borderRadius: 2, p: 3, mb: 4 }}
			>
				<Box
					sx={{
						display: "grid",
						gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr", md: "1fr 1fr 1fr 1fr" },
						gap: 2,
					}}
				>
					<TextField
						select
						label="Status"
						value={filterStatus}
						onChange={(e) => setFilterStatus(e.target.value as ReminderStatus | "")}
						size="small"
						fullWidth
					>
						<MenuItem value="">Todos</MenuItem>
						{REMINDER_STATUS_ENUM.map((s) => (
							<MenuItem key={s} value={s}>
								{s}
							</MenuItem>
						))}
					</TextField>

					<TextField
						select
						label="Tipo"
						value={filterTipo}
						onChange={(e) => setFilterTipo(e.target.value as ReminderType | "")}
						size="small"
						fullWidth
					>
						<MenuItem value="">Todos</MenuItem>
						{REMINDER_TYPE_ENUM.map((t) => (
							<MenuItem key={t} value={t}>
								{t}
							</MenuItem>
						))}
					</TextField>

					<TextField
						label="Data início"
						type="date"
						value={filterDataInicio}
						onChange={(e) => setFilterDataInicio(e.target.value)}
						size="small"
						fullWidth
						InputLabelProps={{ shrink: true }}
					/>

					<TextField
						label="Data fim"
						type="date"
						value={filterDataFim}
						onChange={(e) => setFilterDataFim(e.target.value)}
						size="small"
						fullWidth
						InputLabelProps={{ shrink: true }}
					/>
				</Box>
			</Paper>

			{/* List */}
			{!reminders || reminders.length === 0 ? (
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
						Nenhum lembrete encontrado
					</Typography>
					<Typography variant="body2" color="text.disabled" mb={3}>
						Crie o primeiro lembrete para acompanhar suas tarefas de CRM
					</Typography>
					<Button variant="contained" onClick={() => navigate("/reminders/new")}>
						Novo Lembrete
					</Button>
				</Paper>
			) : (
				<Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
					{reminders.map((reminder) => (
						<Paper
							key={reminder.reminderId}
							elevation={0}
							onClick={() => navigate(`/reminders/${reminder.reminderId}`)}
							sx={{
								border: "1px solid",
								borderColor: "divider",
								borderRadius: 2,
								p: 3,
								cursor: "pointer",
								transition: "all 0.2s ease-in-out",
								"&:hover": {
									borderColor: "primary.main",
									transform: "translateY(-2px)",
									boxShadow: 3,
								},
							}}
						>
							<Box
								sx={{
									display: "flex",
									alignItems: "center",
									justifyContent: "space-between",
									gap: 2,
									flexWrap: "wrap",
								}}
							>
								<Box sx={{ flex: 1, minWidth: 0 }}>
									<Typography variant="subtitle1" fontWeight={600} noWrap>
										{reminder.titulo}
									</Typography>
									<Box
										sx={{
											display: "flex",
											alignItems: "center",
											gap: 1.5,
											mt: 0.5,
											flexWrap: "wrap",
										}}
									>
										<Chip label={reminder.tipo} size="small" variant="outlined" />
										<Typography variant="body2" color="text.secondary">
											{reminder.clienteNome ?? "—"}
										</Typography>
										<Typography variant="body2" color="text.secondary">
											{formatDate(reminder.dataLembrete)}
										</Typography>
									</Box>
								</Box>
								<ReminderStatusBadge status={reminder.status} />
							</Box>
						</Paper>
					))}
				</Box>
			)}
		</Container>
	);
}
