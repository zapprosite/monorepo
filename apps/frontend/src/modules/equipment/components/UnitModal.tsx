import { Typography } from "@connected-repo/ui-mui/data-display/Typography";
import { Dialog } from "@connected-repo/ui-mui/feedback/Dialog";
import { DialogActions } from "@connected-repo/ui-mui/feedback/DialogActions";
import { DialogContent } from "@connected-repo/ui-mui/feedback/DialogContent";
import { DialogTitle } from "@connected-repo/ui-mui/feedback/DialogTitle";
import { Button } from "@connected-repo/ui-mui/form/Button";
import { TextField } from "@connected-repo/ui-mui/form/TextField";
import { Box } from "@connected-repo/ui-mui/layout/Box";
import { unitCreateInputZod, type UnitCreateInput } from "@connected-repo/zod-schemas/unit.zod";
import { trpc } from "@frontend/utils/trpc.client";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Controller, useForm } from "react-hook-form";

interface UnitModalProps {
	clienteId: string;
	open: boolean;
	onClose: () => void;
}

export function UnitModal({ clienteId, open, onClose }: UnitModalProps) {
	const queryClient = useQueryClient();

	const {
		control,
		handleSubmit,
		reset,
		formState: { errors, isSubmitting },
	} = useForm<UnitCreateInput>({
		resolver: zodResolver(unitCreateInputZod),
		defaultValues: { clienteId },
	});

	const createUnit = useMutation(
		trpc.equipment.createUnit.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries({
					queryKey: trpc.equipment.listUnitsByClient.queryKey({ clienteId }),
				});
				reset({ clienteId });
				onClose();
			},
		}),
	);

	const onSubmit = (data: UnitCreateInput) => createUnit.mutate(data);

	return (
		<Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
			<DialogTitle>
				<Typography variant="h6" fontWeight={600}>
					Adicionar Unidade
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
								placeholder="ex: Sede, Filial Centro"
							/>
						)}
					/>
					<Controller
						name="descricao"
						control={control}
						render={({ field }) => (
							<TextField
								{...field}
								value={field.value ?? ""}
								label="Descrição"
								fullWidth
								multiline
								rows={2}
								error={!!errors.descricao}
								helperText={errors.descricao?.message}
							/>
						)}
					/>
					<Controller
						name="endereco"
						control={control}
						render={({ field }) => (
							<TextField
								{...field}
								value={field.value ?? ""}
								label="Endereço"
								fullWidth
								error={!!errors.endereco}
								helperText={errors.endereco?.message}
							/>
						)}
					/>
					<Box sx={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 2 }}>
						<Controller
							name="cidade"
							control={control}
							render={({ field }) => (
								<TextField
									{...field}
									value={field.value ?? ""}
									label="Cidade"
									fullWidth
									error={!!errors.cidade}
									helperText={errors.cidade?.message}
								/>
							)}
						/>
						<Controller
							name="estado"
							control={control}
							render={({ field }) => (
								<TextField
									{...field}
									value={field.value ?? ""}
									label="UF"
									fullWidth
									inputProps={{ maxLength: 2 }}
									sx={{ width: 80 }}
									error={!!errors.estado}
									helperText={errors.estado?.message}
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
