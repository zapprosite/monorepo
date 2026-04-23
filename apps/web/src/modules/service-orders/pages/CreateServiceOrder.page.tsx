import { Typography } from "@connected-repo/ui-mui/data-display/Typography";
import { Button } from "@connected-repo/ui-mui/form/Button";
import { TextField } from "@connected-repo/ui-mui/form/TextField";
import { Box } from "@connected-repo/ui-mui/layout/Box";
import { Container } from "@connected-repo/ui-mui/layout/Container";
import { Paper } from "@connected-repo/ui-mui/layout/Paper";
import { MenuItem } from "@connected-repo/ui-mui/navigation/MenuItem";
import {
	SERVICE_ORDER_STATUS_ENUM,
	SERVICE_TYPE_ENUM,
} from "@repo/zod-schemas/crm_enums.zod";
import {
	type ServiceOrderCreateInput,
	serviceOrderCreateInputZod,
} from "@repo/zod-schemas/service_order.zod";
import { trpc } from "@frontend/utils/trpc.client";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Controller, useForm, useWatch } from "react-hook-form";
import { useEffect } from "react";
import { useNavigate } from "react-router";

function toLocalDatetimeString(date: Date): string {
	const pad = (n: number) => String(n).padStart(2, "0");
	return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export default function CreateServiceOrderPage() {
	const navigate = useNavigate();
	const queryClient = useQueryClient();

	const {
		control,
		handleSubmit,
		setValue,
		formState: { errors, isSubmitting },
	} = useForm<ServiceOrderCreateInput>({
		resolver: zodResolver(serviceOrderCreateInputZod),
		defaultValues: {
			status: "Aberta",
			dataAbertura: toLocalDatetimeString(new Date()),
		},
	});

	const selectedClienteId = useWatch({ control, name: "clienteId" });

	const { data: clients } = useQuery(trpc.clients.listClients.queryOptions({}));

	const { data: equipment } = useQuery({
		...trpc.equipment.listEquipmentByClient.queryOptions({
			clienteId: selectedClienteId ?? "",
		}),
		enabled: !!selectedClienteId,
	});

	useEffect(() => {
		if (selectedClienteId) {
			setValue("equipmentId", null, { shouldDirty: true, shouldValidate: true });
		}
	}, [selectedClienteId, setValue]);

	const createServiceOrder = useMutation(
		trpc.serviceOrders.createServiceOrder.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries({
					queryKey: trpc.serviceOrders.listServiceOrders.queryKey(),
				});
				navigate("/service-orders");
			},
		}),
	);

	const onSubmit = (data: ServiceOrderCreateInput) => {
		createServiceOrder.mutate(data);
	};

	return (
		<Container maxWidth="md" sx={{ py: { xs: 3, md: 5 } }}>
			<Box sx={{ mb: 4 }}>
				<Button
					variant="text"
					size="small"
					onClick={() => navigate("/service-orders")}
					sx={{ mb: 1, color: "text.secondary" }}
				>
					← Voltar para Ordens de Serviço
				</Button>
				<Typography variant="h4" fontWeight={700}>
					Nova Ordem de Serviço
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
								value={field.value ?? ""}
								select
								label="Cliente *"
								fullWidth
								error={!!errors.clienteId}
								helperText={errors.clienteId?.message}
							>
								<MenuItem value="" disabled>
									Selecione um cliente
								</MenuItem>
								{(clients ?? []).map((c) => (
									<MenuItem key={c.clientId} value={c.clientId}>
										{c.nome}
									</MenuItem>
								))}
							</TextField>
						)}
					/>

					{/* Tipo e Status */}
					<Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 3 }}>
						<Controller
							name="tipo"
							control={control}
							render={({ field }) => (
								<TextField
									{...field}
									value={field.value ?? ""}
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
									value={field.value ?? "Aberta"}
									select
									label="Status *"
									fullWidth
									error={!!errors.status}
									helperText={errors.status?.message}
								>
									{SERVICE_ORDER_STATUS_ENUM.map((s) => (
										<MenuItem key={s} value={s}>
											{s}
										</MenuItem>
									))}
								</TextField>
							)}
						/>
					</Box>

					{/* Data de Abertura */}
					<Controller
						name="dataAbertura"
						control={control}
						render={({ field }) => (
							<TextField
								{...field}
								label="Data de Abertura *"
								type="datetime-local"
								fullWidth
								InputLabelProps={{ shrink: true }}
								error={!!errors.dataAbertura}
								helperText={errors.dataAbertura?.message}
							/>
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
								helperText={
									errors.equipmentId?.message ??
									(!selectedClienteId ? "Selecione um cliente primeiro" : undefined)
								}
							>
								<MenuItem value="">Sem equipamento</MenuItem>
								{(equipment ?? []).map((eq) => (
									<MenuItem key={eq.equipmentId} value={eq.equipmentId}>
										{eq.nome}
									</MenuItem>
								))}
							</TextField>
						)}
					/>

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
								rows={4}
								fullWidth
								error={!!errors.descricao}
								helperText={errors.descricao?.message}
							/>
						)}
					/>

					<Box sx={{ display: "flex", gap: 2, justifyContent: "flex-end", pt: 1 }}>
						<Button
							variant="outlined"
							onClick={() => navigate("/service-orders")}
							disabled={isSubmitting || createServiceOrder.isPending}
						>
							Cancelar
						</Button>
						<Button
							type="submit"
							variant="contained"
							disabled={isSubmitting || createServiceOrder.isPending}
							sx={{ minWidth: 160 }}
						>
							{createServiceOrder.isPending ? "Salvando..." : "Salvar OS"}
						</Button>
					</Box>
				</Box>
			</Paper>
		</Container>
	);
}
