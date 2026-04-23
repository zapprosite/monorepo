import { Typography } from "@repo/ui-mui/data-display/Typography";
import { Button } from "@repo/ui-mui/form/Button";
import { TextField } from "@repo/ui-mui/form/TextField";
import { Box } from "@repo/ui-mui/layout/Box";
import { Container } from "@repo/ui-mui/layout/Container";
import { Paper } from "@repo/ui-mui/layout/Paper";
import { MenuItem } from "@repo/ui-mui/navigation/MenuItem";
import { EQUIPMENT_STATUS_ENUM } from "@repo/zod-schemas/crm_enums.zod";
import {
	type EquipmentCreateInput,
	equipmentCreateInputZod,
} from "@repo/zod-schemas/equipment.zod";
import { trpc } from "@frontend/utils/trpc.client";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Controller, useForm, useWatch } from "react-hook-form";
import { useNavigate } from "react-router";

export default function CreateEquipmentPage() {
	const navigate = useNavigate();
	const queryClient = useQueryClient();

	const {
		control,
		handleSubmit,
		formState: { errors, isSubmitting },
	} = useForm<EquipmentCreateInput>({
		resolver: zodResolver(equipmentCreateInputZod),
		defaultValues: {
			status: "Ativo",
		},
	});

	const clienteId = useWatch({ control, name: "clienteId" });

	const { data: clients } = useQuery(trpc.clients.listClients.queryOptions({}));

	const { data: units } = useQuery({
		...trpc.equipment.listUnitsByClient.queryOptions({ clienteId: clienteId ?? "" }),
		enabled: !!clienteId,
	});

	const createEquipment = useMutation(
		trpc.equipment.createEquipment.mutationOptions({
			onSuccess: (eq) => {
				queryClient.invalidateQueries({ queryKey: trpc.equipment.listEquipment.queryKey() });
				navigate(`/equipment/${eq.equipmentId}`);
			},
		}),
	);

	const onSubmit = (data: EquipmentCreateInput) => {
		createEquipment.mutate(data);
	};

	return (
		<Container maxWidth="md" sx={{ py: { xs: 3, md: 5 } }}>
			<Box sx={{ mb: 4 }}>
				<Button
					variant="text"
					size="small"
					onClick={() => navigate("/equipment")}
					sx={{ mb: 1, color: "text.secondary" }}
				>
					← Voltar para Equipamentos
				</Button>
				<Typography variant="h4" fontWeight={700}>
					Novo Equipamento
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
					{/* Campos obrigatórios */}
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
								{clients?.map((c) => (
									<MenuItem key={c.clientId} value={c.clientId}>
										{c.nome}
									</MenuItem>
								))}
							</TextField>
						)}
					/>

					<Controller
						name="nome"
						control={control}
						render={({ field }) => (
							<TextField
								{...field}
								label="Nome *"
								fullWidth
								error={!!errors.nome}
								helperText={errors.nome?.message}
								placeholder="ex: Split Samsung 12000 BTUs"
							/>
						)}
					/>

					<Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 3 }}>
						<Controller
							name="tipo"
							control={control}
							render={({ field }) => (
								<TextField
									{...field}
									label="Tipo *"
									fullWidth
									error={!!errors.tipo}
									helperText={errors.tipo?.message}
									placeholder="ex: Split, Chiller, Fan Coil"
								/>
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
									{EQUIPMENT_STATUS_ENUM.map((s) => (
										<MenuItem key={s} value={s}>
											{s}
										</MenuItem>
									))}
								</TextField>
							)}
						/>
					</Box>

					{/* Unidade (dinâmica baseada no cliente) */}
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
								disabled={!clienteId}
								error={!!errors.unitId}
								helperText={!clienteId ? "Selecione um cliente primeiro" : errors.unitId?.message}
							>
								<MenuItem value="">Nenhuma</MenuItem>
								{units?.map((u) => (
									<MenuItem key={u.unitId} value={u.unitId}>
										{u.nome}
									</MenuItem>
								))}
							</TextField>
						)}
					/>

					{/* Campos opcionais */}
					<Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 3 }}>
						<Controller
							name="marca"
							control={control}
							render={({ field }) => (
								<TextField
									{...field}
									value={field.value ?? ""}
									label="Marca"
									fullWidth
									error={!!errors.marca}
									helperText={errors.marca?.message}
								/>
							)}
						/>
						<Controller
							name="modelo"
							control={control}
							render={({ field }) => (
								<TextField
									{...field}
									value={field.value ?? ""}
									label="Modelo"
									fullWidth
									error={!!errors.modelo}
									helperText={errors.modelo?.message}
								/>
							)}
						/>
					</Box>

					<Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 3 }}>
						<Controller
							name="numeroDeSerie"
							control={control}
							render={({ field }) => (
								<TextField
									{...field}
									value={field.value ?? ""}
									label="Número de Série"
									fullWidth
									error={!!errors.numeroDeSerie}
									helperText={errors.numeroDeSerie?.message}
								/>
							)}
						/>
						<Controller
							name="capacidadeBtu"
							control={control}
							render={({ field }) => (
								<TextField
									{...field}
									value={field.value ?? ""}
									label="Capacidade (BTU)"
									type="number"
									fullWidth
									onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : null)}
									error={!!errors.capacidadeBtu}
									helperText={errors.capacidadeBtu?.message}
								/>
							)}
						/>
					</Box>

					<Box
						sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr 1fr" }, gap: 3 }}
					>
						<Controller
							name="anoFabricacao"
							control={control}
							render={({ field }) => (
								<TextField
									{...field}
									value={field.value ?? ""}
									label="Ano Fabricação"
									type="number"
									fullWidth
									onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : null)}
									error={!!errors.anoFabricacao}
									helperText={errors.anoFabricacao?.message}
								/>
							)}
						/>
						<Controller
							name="dataInstalacao"
							control={control}
							render={({ field }) => (
								<TextField
									{...field}
									value={field.value ?? ""}
									label="Data Instalação"
									type="date"
									fullWidth
									InputLabelProps={{ shrink: true }}
									error={!!errors.dataInstalacao}
									helperText={errors.dataInstalacao?.message}
								/>
							)}
						/>
						<Controller
							name="ultimaManutencao"
							control={control}
							render={({ field }) => (
								<TextField
									{...field}
									value={field.value ?? ""}
									label="Última Manutenção"
									type="date"
									fullWidth
									InputLabelProps={{ shrink: true }}
									error={!!errors.ultimaManutencao}
									helperText={errors.ultimaManutencao?.message}
								/>
							)}
						/>
					</Box>

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
							onClick={() => navigate("/equipment")}
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
							{isSubmitting ? "Salvando..." : "Salvar Equipamento"}
						</Button>
					</Box>
				</Box>
			</Paper>
		</Container>
	);
}
