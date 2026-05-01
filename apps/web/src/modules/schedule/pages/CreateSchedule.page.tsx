import { Typography } from "@repo/ui-mui/data-display/Typography";
import { Button } from "@repo/ui-mui/form/Button";
import { TextField } from "@repo/ui-mui/form/TextField";
import { Box } from "@repo/ui-mui/layout/Box";
import { Container } from "@repo/ui-mui/layout/Container";
import { Paper } from "@repo/ui-mui/layout/Paper";
import { MenuItem } from "@repo/ui-mui/navigation/MenuItem";
import { SCHEDULE_STATUS_ENUM, SERVICE_TYPE_ENUM } from "@repo/zod-schemas/crm_enums.zod";
import {
	type ScheduleCreateInput,
	scheduleCreateInputZod,
} from "@repo/zod-schemas/schedule.zod";
import { trpc } from "@frontend/utils/trpc.client";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Controller, useForm, useWatch } from "react-hook-form";
import { useNavigate } from "react-router";

export default function CreateSchedulePage() {
	const navigate = useNavigate();
	const queryClient = useQueryClient();

	const {
		control,
		handleSubmit,
		formState: { errors },
	} = useForm<ScheduleCreateInput>({
		resolver: zodResolver(scheduleCreateInputZod),
		defaultValues: {
			status: "Agendado",
			duracaoMinutos: 60,
		},
	});

	const selectedClienteId = useWatch({ control, name: "clienteId" });

	const { data: clients } = useQuery(trpc.clients.listClients.queryOptions({}));

	const { data: units } = useQuery({
		...trpc.equipment.listUnitsByClient.queryOptions({ clienteId: selectedClienteId ?? "" }),
		enabled: !!selectedClienteId,
	});

	const { data: equipment } = useQuery({
		...trpc.equipment.listEquipmentByClient.queryOptions({ clienteId: selectedClienteId ?? "" }),
		enabled: !!selectedClienteId,
	});

	const createSchedule = useMutation(
		trpc.schedule.createSchedule.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries({ queryKey: trpc.schedule.listSchedules.queryKey() });
				navigate("/schedule");
			},
		}),
	);

	const onSubmit = (data: ScheduleCreateInput) => {
		if (createSchedule.isPending) return;
		createSchedule.mutate(data);
	};

	return (
		<Container maxWidth="md" sx={{ py: { xs: 3, md: 5 } }}>
			<Box sx={{ mb: 4 }}>
				<Button
					variant="text"
					size="small"
					onClick={() => navigate("/schedule")}
					sx={{ mb: 1, color: "text.secondary" }}
				>
					← Voltar para Agenda
				</Button>
				<Typography variant="h4" fontWeight={700}>
					Novo Agendamento
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
					{/* Cliente */}
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
									<MenuItem key={c.clientId} value={c.clientId}>
										{c.nome}
									</MenuItem>
								))}
							</TextField>
						)}
					/>

					<Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 3 }}>
						{/* Unidade */}
						<Controller
							name="unitId"
							control={control}
							render={({ field }) => (
								<TextField
									{...field}
									value={field.value ?? ""}
									select
									label="Unidade"
									fullWidth
									disabled={!selectedClienteId}
									error={!!errors.unitId}
									helperText={errors.unitId?.message}
								>
									<MenuItem value="">Nenhuma</MenuItem>
									{(units ?? []).map((u) => (
										<MenuItem key={u.unitId} value={u.unitId}>
											{u.nome}
										</MenuItem>
									))}
								</TextField>
							)}
						/>

						{/* Equipamento */}
						<Controller
							name="equipmentId"
							control={control}
							render={({ field }) => (
								<TextField
									{...field}
									value={field.value ?? ""}
									select
									label="Equipamento"
									fullWidth
									disabled={!selectedClienteId}
									error={!!errors.equipmentId}
									helperText={errors.equipmentId?.message}
								>
									<MenuItem value="">Nenhum</MenuItem>
									{(equipment ?? []).map((eq) => (
										<MenuItem key={eq.equipmentId} value={eq.equipmentId}>
											{eq.nome}
										</MenuItem>
									))}
								</TextField>
							)}
						/>
					</Box>

					{/* Data/Hora e Duração */}
					<Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 3 }}>
						<Controller
							name="dataHora"
							control={control}
							render={({ field }) => (
								<TextField
									{...field}
									label="Data e Hora *"
									type="datetime-local"
									fullWidth
									InputLabelProps={{ shrink: true }}
									error={!!errors.dataHora}
									helperText={errors.dataHora?.message}
								/>
							)}
						/>

						<Controller
							name="duracaoMinutos"
							control={control}
							render={({ field }) => (
								<TextField
									{...field}
									value={field.value ?? 60}
									onChange={(e) => field.onChange(Number(e.target.value))}
									label="Duração (minutos)"
									type="number"
									fullWidth
									inputProps={{ min: 15, max: 480, step: 15 }}
									error={!!errors.duracaoMinutos}
									helperText={errors.duracaoMinutos?.message}
								/>
							)}
						/>
					</Box>

					{/* Tipo e Status */}
					<Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 3 }}>
						<Controller
							name="tipo"
							control={control}
							render={({ field }) => (
								<TextField
									{...field}
									select
									label="Tipo de Serviço *"
									fullWidth
									error={!!errors.tipo}
									helperText={errors.tipo?.message}
								>
									{SERVICE_TYPE_ENUM.map((t) => (
										<MenuItem key={t} value={t}>
											{t}
										</MenuItem>
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
									{SCHEDULE_STATUS_ENUM.map((s) => (
										<MenuItem key={s} value={s}>
											{s}
										</MenuItem>
									))}
								</TextField>
							)}
						/>
					</Box>

					{/* Descrição */}
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

					{/* Observações */}
					<Controller
						name="observacoes"
						control={control}
						render={({ field }) => (
							<TextField
								{...field}
								value={field.value ?? ""}
								label="Observações"
								multiline
								rows={3}
								fullWidth
								error={!!errors.observacoes}
								helperText={errors.observacoes?.message}
							/>
						)}
					/>

					<Box sx={{ display: "flex", gap: 2, justifyContent: "flex-end", pt: 1 }}>
						<Button
							variant="outlined"
							onClick={() => navigate("/schedule")}
							disabled={createSchedule.isPending}
						>
							Cancelar
						</Button>
						<Button
							type="submit"
							variant="contained"
							disabled={createSchedule.isPending}
							sx={{ minWidth: 160 }}
						>
							{createSchedule.isPending ? "Salvando..." : "Salvar Agendamento"}
						</Button>
					</Box>
				</Box>
			</Paper>
		</Container>
	);
}
