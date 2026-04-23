import { Alert } from "@connected-repo/ui-mui/feedback/Alert";
import { Typography } from "@connected-repo/ui-mui/data-display/Typography";
import { Button } from "@connected-repo/ui-mui/form/Button";
import { TextField } from "@connected-repo/ui-mui/form/TextField";
import { Box } from "@connected-repo/ui-mui/layout/Box";
import { Container } from "@connected-repo/ui-mui/layout/Container";
import { Paper } from "@connected-repo/ui-mui/layout/Paper";
import { MenuItem } from "@connected-repo/ui-mui/navigation/MenuItem";
import { LEAD_SOURCE_ENUM, LEAD_STATUS_ENUM } from "@repo/zod-schemas/crm_enums.zod";
import { type LeadCreateInput, leadCreateInputZod } from "@repo/zod-schemas/lead.zod";
import { trpc } from "@frontend/utils/trpc.client";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Controller, useForm } from "react-hook-form";
import { useNavigate } from "react-router";

export default function CreateLeadPage() {
	const navigate = useNavigate();
	const queryClient = useQueryClient();

	const {
		control,
		handleSubmit,
		setError,
		formState: { errors, isSubmitting },
	} = useForm<LeadCreateInput>({
		resolver: zodResolver(leadCreateInputZod),
		defaultValues: {
			status: "Novo",
			origem: "Site",
		},
	});

	const createLead = useMutation(
		trpc.leads.createLead.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries({ queryKey: trpc.leads.listLeads.queryKey() });
				navigate("/leads");
			},
			onError: (error) => {
				setError("root", {
					type: "server",
					message: error.message || "Não foi possível salvar o lead. Tente novamente.",
				});
			},
		}),
	);

	const onSubmit = (data: LeadCreateInput) => {
		createLead.mutate(data);
	};

	return (
		<Container maxWidth="md" sx={{ py: { xs: 3, md: 5 } }}>
			<Box sx={{ mb: 4 }}>
				<Button
					variant="text"
					size="small"
					onClick={() => navigate("/leads")}
					sx={{ mb: 1, color: "text.secondary" }}
				>
					← Voltar para Leads
				</Button>
				<Typography variant="h4" fontWeight={700}>
					Novo Lead
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
					{errors.root?.message && <Alert severity="error">{errors.root.message}</Alert>}
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

					<Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 3 }}>
						<Controller
							name="origem"
							control={control}
							render={({ field }) => (
								<TextField
									{...field}
									select
									label="Origem *"
									fullWidth
									error={!!errors.origem}
									helperText={errors.origem?.message}
								>
									{LEAD_SOURCE_ENUM.map((src) => (
										<MenuItem key={src} value={src}>
											{src}
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
									{LEAD_STATUS_ENUM.map((s) => (
										<MenuItem key={s} value={s}>
											{s}
										</MenuItem>
									))}
								</TextField>
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
						<Button variant="outlined" onClick={() => navigate("/leads")} disabled={isSubmitting}>
							Cancelar
						</Button>
						<Button
							type="submit"
							variant="contained"
							disabled={isSubmitting || createLead.isPending}
							sx={{ minWidth: 140, minHeight: 44 }}
						>
							{isSubmitting || createLead.isPending ? "Salvando..." : "Salvar lead"}
						</Button>
					</Box>
				</Box>
			</Paper>
		</Container>
	);
}
