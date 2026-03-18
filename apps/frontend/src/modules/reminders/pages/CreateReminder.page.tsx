import { Typography } from "@connected-repo/ui-mui/data-display/Typography";
import { Button } from "@connected-repo/ui-mui/form/Button";
import { TextField } from "@connected-repo/ui-mui/form/TextField";
import { MenuItem } from "@connected-repo/ui-mui/navigation/MenuItem";
import { Box } from "@connected-repo/ui-mui/layout/Box";
import { Container } from "@connected-repo/ui-mui/layout/Container";
import { Paper } from "@connected-repo/ui-mui/layout/Paper";
import {
	REMINDER_STATUS_ENUM,
	REMINDER_TYPE_ENUM,
} from "@connected-repo/zod-schemas/crm_enums.zod";
import { reminderCreateInputZod, type ReminderCreateInput } from "@connected-repo/zod-schemas/reminder.zod";
import { trpc } from "@frontend/utils/trpc.client";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Controller, useForm } from "react-hook-form";
import { useNavigate } from "react-router";

export default function CreateReminderPage() {
	const navigate = useNavigate();
	const queryClient = useQueryClient();

	const { data: clients } = useQuery(trpc.clients.listClients.queryOptions({}));

	const { control, handleSubmit, formState: { errors, isSubmitting } } = useForm<ReminderCreateInput>({
		resolver: zodResolver(reminderCreateInputZod),
		defaultValues: {
			status: "Pendente",
		},
	});

	const createReminder = useMutation(
		trpc.reminders.createReminder.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries({ queryKey: trpc.reminders.listReminders.queryKey() });
				navigate("/reminders");
			},
		}),
	);

	const onSubmit = (data: ReminderCreateInput) => {
		createReminder.mutate(data);
	};

	return (
		<Container maxWidth="md" sx={{ py: { xs: 3, md: 5 } }}>
			<Box sx={{ mb: 4 }}>
				<Button
					variant="text"
					size="small"
					onClick={() => navigate("/reminders")}
					sx={{ mb: 1, color: "text.secondary" }}
				>
					← Voltar para Lembretes
				</Button>
				<Typography variant="h4" fontWeight={700}>
					Novo Lembrete
				</Typography>
			</Box>

			<Paper
				elevation={0}
				sx={{ border: "1px solid", borderColor: "divider", borderRadius: 2, p: 4 }}
			>
				<Box
					component="form"
					onSubmit={handleSubmit(onSubmit)}
					sx={{ display: "flex", flexDirection: "column", gap: 3 }}
				>
					{/* Row 1: Cliente + Data Lembrete */}
					<Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "2fr 1fr" }, gap: 3 }}>
						<Controller
							name="clienteId"
							control={control}
							render={({ field }) => (
								<TextField
									{...field}
									select
									label="Cliente *"
									fullWidth
									error={!!errors.clienteId}
									helperText={errors.clienteId?.message}
								>
									{(clients ?? []).map((c) => (
										<MenuItem key={c.clientId} value={c.clientId}>{c.nome}</MenuItem>
									))}
								</TextField>
							)}
						/>

						<Controller
							name="dataLembrete"
							control={control}
							render={({ field }) => (
								<TextField
									{...field}
									label="Data do Lembrete *"
									type="date"
									fullWidth
									InputLabelProps={{ shrink: true }}
									error={!!errors.dataLembrete}
									helperText={errors.dataLembrete?.message}
								/>
							)}
						/>
					</Box>

					{/* Row 2: Tipo + Status */}
					<Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 3 }}>
						<Controller
							name="tipo"
							control={control}
							render={({ field }) => (
								<TextField
									{...field}
									select
									label="Tipo *"
									fullWidth
									error={!!errors.tipo}
									helperText={errors.tipo?.message}
								>
									{REMINDER_TYPE_ENUM.map((t) => (
										<MenuItem key={t} value={t}>{t}</MenuItem>
									))}
								</TextField>
							)}
						/>

						<Controller
							name="status"
							control={control}
							render={({ field }) => (
								<TextField
									{...field}
									select
									label="Status *"
									fullWidth
									error={!!errors.status}
									helperText={errors.status?.message}
								>
									{REMINDER_STATUS_ENUM.map((s) => (
										<MenuItem key={s} value={s}>{s}</MenuItem>
									))}
								</TextField>
							)}
						/>
					</Box>

					{/* Row 3: Título */}
					<Controller
						name="titulo"
						control={control}
						render={({ field }) => (
							<TextField
								{...field}
								label="Título *"
								fullWidth
								error={!!errors.titulo}
								helperText={errors.titulo?.message}
							/>
						)}
					/>

					{/* Row 4: Descrição */}
					<Controller
						name="descricao"
						control={control}
						render={({ field }) => (
							<TextField
								{...field}
								value={field.value ?? ""}
								label="Descrição"
								multiline
								rows={3}
								fullWidth
								error={!!errors.descricao}
								helperText={errors.descricao?.message}
							/>
						)}
					/>

					<Box sx={{ display: "flex", gap: 2, justifyContent: "flex-end", pt: 1 }}>
						<Button
							variant="outlined"
							onClick={() => navigate("/reminders")}
							disabled={isSubmitting}
						>
							Cancelar
						</Button>
						<Button
							type="submit"
							variant="contained"
							disabled={isSubmitting}
							sx={{ minWidth: 160 }}
						>
							{isSubmitting ? "Salvando..." : "Salvar Lembrete"}
						</Button>
					</Box>
				</Box>
			</Paper>
		</Container>
	);
}
