import { Typography } from "@connected-repo/ui-mui/data-display/Typography";
import { Button } from "@connected-repo/ui-mui/form/Button";
import { TextField } from "@connected-repo/ui-mui/form/TextField";
import { Box } from "@connected-repo/ui-mui/layout/Box";
import { Container } from "@connected-repo/ui-mui/layout/Container";
import { Paper } from "@connected-repo/ui-mui/layout/Paper";
import { MenuItem } from "@connected-repo/ui-mui/navigation/MenuItem";
import {
	type ClientCreateInput,
	clientCreateInputZod,
} from "@connected-repo/zod-schemas/client.zod";
import { CLIENT_TYPE_ENUM } from "@connected-repo/zod-schemas/crm_enums.zod";
import { trpc } from "@frontend/utils/trpc.client";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Controller, useForm } from "react-hook-form";
import { useNavigate } from "react-router";

export default function CreateClientPage() {
	const navigate = useNavigate();
	const queryClient = useQueryClient();

	const {
		control,
		handleSubmit,
		reset,
		formState: { errors, isSubmitting },
	} = useForm<ClientCreateInput>({
		resolver: zodResolver(clientCreateInputZod),
		defaultValues: {
			tipo: "Pessoa Física",
			ativo: true,
		},
	});

	const createClient = useMutation(
		trpc.clients.createClient.mutationOptions({
			onSuccess: (client) => {
				queryClient.invalidateQueries({ queryKey: trpc.clients.listClients.queryKey() });
				reset({
					nome: "",
					email: "",
					telefone: "",
					cpfCnpj: "",
					tipo: "Pessoa Física",
					ativo: true,
				});
				navigate(`/clients/${client.clientId}`);
			},
		}),
	);

	const onSubmit = (data: ClientCreateInput) => createClient.mutate(data);

	return (
		<Container maxWidth="md" sx={{ py: { xs: 3, md: 5 } }}>
			<Box sx={{ mb: 4 }}>
				<Button
					variant="text"
					size="small"
					onClick={() => navigate("/clients")}
					sx={{ mb: 1, color: "text.secondary" }}
				>
					← Voltar para Clientes
				</Button>
				<Typography variant="h4" fontWeight={700}>
					Novo Cliente
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
					<Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "2fr 1fr" }, gap: 3 }}>
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
									{CLIENT_TYPE_ENUM.map((t) => (
										<MenuItem key={t} value={t}>
											{t}
										</MenuItem>
									))}
								</TextField>
							)}
						/>
					</Box>

					<Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 3 }}>
						<Controller
							name="email"
							control={control}
							render={({ field }) => (
								<TextField
									{...field}
									value={field.value ?? ""}
									label="Email"
									type="email"
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
						name="cpfCnpj"
						control={control}
						render={({ field }) => (
							<TextField
								{...field}
								value={field.value ?? ""}
								label="CPF / CNPJ"
								fullWidth
								error={!!errors.cpfCnpj}
								helperText={errors.cpfCnpj?.message}
							/>
						)}
					/>

					<Box sx={{ display: "flex", gap: 2, justifyContent: "flex-end", pt: 1 }}>
						<Button variant="outlined" onClick={() => navigate("/clients")} disabled={isSubmitting}>
							Cancelar
						</Button>
						<Button
							type="submit"
							variant="contained"
							disabled={isSubmitting}
							sx={{ minWidth: 160 }}
						>
							{isSubmitting ? "Salvando..." : "Salvar Cliente"}
						</Button>
					</Box>
				</Box>
			</Paper>
		</Container>
	);
}
