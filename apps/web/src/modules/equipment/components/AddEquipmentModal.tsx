import { Typography } from "@repo/ui-mui/data-display/Typography";
import { Dialog } from "@repo/ui-mui/feedback/Dialog";
import { DialogActions } from "@repo/ui-mui/feedback/DialogActions";
import { DialogContent } from "@repo/ui-mui/feedback/DialogContent";
import { DialogTitle } from "@repo/ui-mui/feedback/DialogTitle";
import { Button } from "@repo/ui-mui/form/Button";
import { TextField } from "@repo/ui-mui/form/TextField";
import { Box } from "@repo/ui-mui/layout/Box";
import { MenuItem } from "@repo/ui-mui/navigation/MenuItem";
import { EQUIPMENT_STATUS_ENUM } from "@repo/zod-schemas/crm_enums.zod";
import {
	type EquipmentCreateInput,
	equipmentCreateInputZod,
} from "@repo/zod-schemas/equipment.zod";
import { trpc } from "@frontend/utils/trpc.client";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Controller, useForm } from "react-hook-form";

interface AddEquipmentModalProps {
	clienteId: string;
	open: boolean;
	onClose: () => void;
}

export function AddEquipmentModal({ clienteId, open, onClose }: AddEquipmentModalProps) {
	const queryClient = useQueryClient();

	const {
		control,
		handleSubmit,
		reset,
		formState: { errors, isSubmitting },
	} = useForm<EquipmentCreateInput>({
		resolver: zodResolver(equipmentCreateInputZod),
		defaultValues: {
			clienteId,
			status: "Ativo",
		},
	});

	const { data: units } = useQuery(trpc.equipment.listUnitsByClient.queryOptions({ clienteId }));

	const createEquipment = useMutation(
		trpc.equipment.createEquipment.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries({
					queryKey: trpc.equipment.listEquipmentByClient.queryKey({ clienteId }),
				});
				reset({ clienteId, status: "Ativo" });
				onClose();
			},
		}),
	);

	const onSubmit = (data: EquipmentCreateInput) => createEquipment.mutate(data);

	return (
		<Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
			<DialogTitle>
				<Typography variant="h6" fontWeight={600}>
					Adicionar Equipamento
				</Typography>
			</DialogTitle>
			<Box component="form" onSubmit={handleSubmit(onSubmit)}>
				<DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2.5 }}>
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
					<Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 2 }}>
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
									placeholder="ex: Split, Chiller"
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
								error={!!errors.unitId}
								helperText={errors.unitId?.message}
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
					<Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 2 }}>
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
				</DialogContent>
				<DialogActions sx={{ px: 3, pb: 3 }}>
					<Button variant="outlined" onClick={onClose} disabled={isSubmitting}>
						Cancelar
					</Button>
					<Button type="submit" variant="contained" disabled={isSubmitting}>
						{isSubmitting ? "Salvando..." : "Adicionar"}
					</Button>
				</DialogActions>
			</Box>
		</Dialog>
	);
}
