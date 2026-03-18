import { Typography } from "@connected-repo/ui-mui/data-display/Typography";
import { Button } from "@connected-repo/ui-mui/form/Button";
import { TextField } from "@connected-repo/ui-mui/form/TextField";
import { MenuItem } from "@connected-repo/ui-mui/navigation/MenuItem";
import { Box } from "@connected-repo/ui-mui/layout/Box";
import { Dialog } from "@connected-repo/ui-mui/feedback/Dialog";
import { DialogTitle } from "@connected-repo/ui-mui/feedback/DialogTitle";
import { DialogContent } from "@connected-repo/ui-mui/feedback/DialogContent";
import { DialogActions } from "@connected-repo/ui-mui/feedback/DialogActions";
import { ADDRESS_TYPE_ENUM } from "@connected-repo/zod-schemas/crm_enums.zod";
import { addressCreateInputZod, type AddressCreateInput } from "@connected-repo/zod-schemas/address.zod";
import { trpc } from "@frontend/utils/trpc.client";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Controller, useForm } from "react-hook-form";

interface AddressModalProps {
	clienteId: string;
	open: boolean;
	onClose: () => void;
}

export function AddressModal({ clienteId, open, onClose }: AddressModalProps) {
	const queryClient = useQueryClient();

	const { control, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<AddressCreateInput>({
		resolver: zodResolver(addressCreateInputZod),
		defaultValues: { clienteId },
	});

	const addAddress = useMutation(trpc.clients.addAddress.mutationOptions({
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: trpc.clients.listAddresses.queryKey({ clienteId }) });
			reset({ clienteId });
			onClose();
		},
	}));

	const onSubmit = (data: AddressCreateInput) => addAddress.mutate(data);

	return (
		<Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
			<DialogTitle>
				<Typography variant="h6" fontWeight={600}>Adicionar Endereço</Typography>
			</DialogTitle>
			<Box component="form" onSubmit={handleSubmit(onSubmit)}>
				<DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2.5 }}>
					<Controller
						name="tipo"
						control={control}
						render={({ field }) => (
							<TextField
								{...field}
								value={field.value ?? ""}
								onChange={(e) => field.onChange(e.target.value === "" ? null : e.target.value)}
								select
								label="Tipo"
								fullWidth
								error={!!errors.tipo}
								helperText={errors.tipo?.message}
							>
								<MenuItem value="">Selecione...</MenuItem>
								{ADDRESS_TYPE_ENUM.map((t) => (
									<MenuItem key={t} value={t}>{t}</MenuItem>
								))}
							</TextField>
						)}
					/>
					<Box sx={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 2 }}>
						<Controller
							name="rua"
							control={control}
							render={({ field }) => (
								<TextField
									{...field}
									label="Rua *"
									fullWidth
									error={!!errors.rua}
									helperText={errors.rua?.message}
								/>
							)}
						/>
						<Controller
							name="numero"
							control={control}
							render={({ field }) => (
								<TextField
									{...field}
									label="Número *"
									sx={{ width: 100 }}
									error={!!errors.numero}
									helperText={errors.numero?.message}
								/>
							)}
						/>
					</Box>
					<Controller
						name="complemento"
						control={control}
						render={({ field }) => (
							<TextField
								{...field}
								value={field.value ?? ""}
								label="Complemento"
								fullWidth
								error={!!errors.complemento}
								helperText={errors.complemento?.message}
							/>
						)}
					/>
					<Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 2 }}>
						<Controller
							name="bairro"
							control={control}
							render={({ field }) => (
								<TextField
									{...field}
									label="Bairro *"
									fullWidth
									error={!!errors.bairro}
									helperText={errors.bairro?.message}
								/>
							)}
						/>
						<Controller
							name="cep"
							control={control}
							render={({ field }) => (
								<TextField
									{...field}
									label="CEP *"
									fullWidth
									error={!!errors.cep}
									helperText={errors.cep?.message}
								/>
							)}
						/>
					</Box>
					<Box sx={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 2 }}>
						<Controller
							name="cidade"
							control={control}
							render={({ field }) => (
								<TextField
									{...field}
									label="Cidade *"
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
									label="UF *"
									sx={{ width: 70 }}
									inputProps={{ maxLength: 2 }}
									error={!!errors.estado}
									helperText={errors.estado?.message}
								/>
							)}
						/>
					</Box>
				</DialogContent>
				<DialogActions sx={{ px: 3, pb: 3 }}>
					<Button variant="outlined" onClick={onClose} disabled={isSubmitting}>Cancelar</Button>
					<Button type="submit" variant="contained" disabled={isSubmitting}>
						{isSubmitting ? "Salvando..." : "Adicionar"}
					</Button>
				</DialogActions>
			</Box>
		</Dialog>
	);
}
