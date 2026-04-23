import { Typography } from "@repo/ui-mui/data-display/Typography";
import { Dialog } from "@repo/ui-mui/feedback/Dialog";
import { DialogActions } from "@repo/ui-mui/feedback/DialogActions";
import { DialogContent } from "@repo/ui-mui/feedback/DialogContent";
import { DialogTitle } from "@repo/ui-mui/feedback/DialogTitle";
import { Button } from "@repo/ui-mui/form/Button";
import { TextField } from "@repo/ui-mui/form/TextField";
import { Box } from "@repo/ui-mui/layout/Box";
import {
	type ContactCreateInput,
	contactCreateInputZod,
} from "@repo/zod-schemas/contact.zod";
import { trpc } from "@frontend/utils/trpc.client";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Controller, useForm } from "react-hook-form";

interface ContactModalProps {
	clienteId: string;
	open: boolean;
	onClose: () => void;
}

export function ContactModal({ clienteId, open, onClose }: ContactModalProps) {
	const queryClient = useQueryClient();

	const {
		control,
		handleSubmit,
		reset,
		formState: { errors, isSubmitting },
	} = useForm<ContactCreateInput>({
		resolver: zodResolver(contactCreateInputZod),
		defaultValues: { clienteId },
	});

	const addContact = useMutation(
		trpc.clients.addContact.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries({
					queryKey: trpc.clients.listContacts.queryKey({ clienteId }),
				});
				reset({ clienteId });
				onClose();
			},
		}),
	);

	const onSubmit = (data: ContactCreateInput) => addContact.mutate(data);

	return (
		<Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
			<DialogTitle>
				<Typography variant="h6" fontWeight={600}>
					Adicionar Contato
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
							/>
						)}
					/>
					<Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 2 }}>
						<Controller
							name="email"
							control={control}
							render={({ field }) => (
								<TextField
									{...field}
									value={field.value ?? ""}
									label="Email"
									fullWidth
									error={!!errors.email}
									helperText={errors.email?.message}
								/>
							)}
						/>
						<Controller
							name="telefone"
							control={control}
							render={({ field }) => (
								<TextField
									{...field}
									value={field.value ?? ""}
									label="Telefone"
									fullWidth
									error={!!errors.telefone}
									helperText={errors.telefone?.message}
								/>
							)}
						/>
					</Box>
					<Controller
						name="cargo"
						control={control}
						render={({ field }) => (
							<TextField
								{...field}
								value={field.value ?? ""}
								label="Cargo"
								fullWidth
								error={!!errors.cargo}
								helperText={errors.cargo?.message}
							/>
						)}
					/>
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
