import { Typography } from "@connected-repo/ui-mui/data-display/Typography";
import { Button } from "@connected-repo/ui-mui/form/Button";
import { TextField } from "@connected-repo/ui-mui/form/TextField";
import { Box } from "@connected-repo/ui-mui/layout/Box";
import { Container } from "@connected-repo/ui-mui/layout/Container";
import { Paper } from "@connected-repo/ui-mui/layout/Paper";
import { MenuItem } from "@connected-repo/ui-mui/navigation/MenuItem";
import {
	EDITORIAL_CHANNEL_ENUM,
	EDITORIAL_FORMAT_ENUM,
	EDITORIAL_STATUS_ENUM,
} from "@connected-repo/zod-schemas/crm_enums.zod";
import {
	type EditorialCreateInput,
	editorialCreateInputZod,
} from "@connected-repo/zod-schemas/editorial.zod";
import { trpc } from "@frontend/utils/trpc.client";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Controller, useForm } from "react-hook-form";
import { useNavigate } from "react-router";

export default function CreateEditorialPage() {
	const navigate = useNavigate();
	const queryClient = useQueryClient();

	const {
		control,
		handleSubmit,
		formState: { errors, isSubmitting },
	} = useForm<EditorialCreateInput>({
		resolver: zodResolver(editorialCreateInputZod),
		defaultValues: {
			status: "Ideia",
		},
	});

	const createEditorialItem = useMutation(
		trpc.editorial.createEditorialItem.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries({ queryKey: trpc.editorial.listEditorialItems.queryKey() });
				navigate("/editorial");
			},
		}),
	);

	const onSubmit = (data: EditorialCreateInput) => {
		createEditorialItem.mutate(data);
	};

	return (
		<Container maxWidth="md" sx={{ py: { xs: 3, md: 5 } }}>
			<Box sx={{ mb: 4 }}>
				<Button
					variant="text"
					size="small"
					onClick={() => navigate("/editorial")}
					sx={{ mb: 1, color: "text.secondary" }}
				>
					← Voltar para Calendário Editorial
				</Button>
				<Typography variant="h4" fontWeight={700}>
					Novo Item Editorial
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
					{/* Row 1: Título + Data Publicação */}
					<Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "2fr 1fr" }, gap: 3 }}>
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

						<Controller
							name="dataPublicacao"
							control={control}
							render={({ field }) => (
								<TextField
									{...field}
									label="Data de Publicação *"
									type="date"
									fullWidth
									InputLabelProps={{ shrink: true }}
									error={!!errors.dataPublicacao}
									helperText={errors.dataPublicacao?.message}
								/>
							)}
						/>
					</Box>

					{/* Row 2: Canal + Formato + Status */}
					<Box
						sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr 1fr" }, gap: 3 }}
					>
						<Controller
							name="canal"
							control={control}
							render={({ field }) => (
								<TextField
									{...field}
									select
									label="Canal *"
									fullWidth
									error={!!errors.canal}
									helperText={errors.canal?.message}
								>
									{EDITORIAL_CHANNEL_ENUM.map((c) => (
										<MenuItem key={c} value={c}>
											{c}
										</MenuItem>
									))}
								</TextField>
							)}
						/>

						<Controller
							name="formato"
							control={control}
							render={({ field }) => (
								<TextField
									{...field}
									select
									label="Formato *"
									fullWidth
									error={!!errors.formato}
									helperText={errors.formato?.message}
								>
									{EDITORIAL_FORMAT_ENUM.map((f) => (
										<MenuItem key={f} value={f}>
											{f}
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
									{EDITORIAL_STATUS_ENUM.map((s) => (
										<MenuItem key={s} value={s}>
											{s}
										</MenuItem>
									))}
								</TextField>
							)}
						/>
					</Box>

					{/* Row 3: Pauta */}
					<Controller
						name="pauta"
						control={control}
						render={({ field }) => (
							<TextField
								{...field}
								value={field.value ?? ""}
								label="Pauta"
								multiline
								rows={3}
								fullWidth
								error={!!errors.pauta}
								helperText={errors.pauta?.message}
							/>
						)}
					/>

					{/* Row 4: Copy */}
					<Controller
						name="copy"
						control={control}
						render={({ field }) => (
							<TextField
								{...field}
								value={field.value ?? ""}
								label="Copy"
								multiline
								rows={4}
								fullWidth
								error={!!errors.copy}
								helperText={errors.copy?.message}
							/>
						)}
					/>

					{/* Row 5: CTA + Observações */}
					<Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 3 }}>
						<Controller
							name="cta"
							control={control}
							render={({ field }) => (
								<TextField
									{...field}
									value={field.value ?? ""}
									label="CTA"
									fullWidth
									error={!!errors.cta}
									helperText={errors.cta?.message}
								/>
							)}
						/>

						<Controller
							name="observacoes"
							control={control}
							render={({ field }) => (
								<TextField
									{...field}
									value={field.value ?? ""}
									label="Observações"
									fullWidth
									error={!!errors.observacoes}
									helperText={errors.observacoes?.message}
								/>
							)}
						/>
					</Box>

					<Box sx={{ display: "flex", gap: 2, justifyContent: "flex-end", pt: 1 }}>
						<Button
							variant="outlined"
							onClick={() => navigate("/editorial")}
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
							{isSubmitting ? "Salvando..." : "Salvar Item"}
						</Button>
					</Box>
				</Box>
			</Paper>
		</Container>
	);
}
