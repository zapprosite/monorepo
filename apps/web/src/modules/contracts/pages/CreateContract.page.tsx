import { ErrorAlert } from "@connected-repo/ui-mui/components/ErrorAlert";
import { Typography } from "@connected-repo/ui-mui/data-display/Typography";
import { Button } from "@connected-repo/ui-mui/form/Button";
import { TextField } from "@connected-repo/ui-mui/form/TextField";
import { Box } from "@connected-repo/ui-mui/layout/Box";
import { Container } from "@connected-repo/ui-mui/layout/Container";
import { Paper } from "@connected-repo/ui-mui/layout/Paper";
import { MenuItem } from "@connected-repo/ui-mui/navigation/MenuItem";
import {
	type ContractCreateInput,
	contractCreateInputZod,
} from "@repo/zod-schemas/contract.zod";
import {
	CONTRACT_FREQUENCY_ENUM,
	CONTRACT_TYPE_ENUM,
} from "@repo/zod-schemas/crm_enums.zod";
import { trpc } from "@frontend/utils/trpc.client";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Controller, useForm, useWatch } from "react-hook-form";
import { useNavigate } from "react-router";

export default function CreateContractPage() {
	const navigate = useNavigate();
	const queryClient = useQueryClient();

	const {
		control,
		handleSubmit,
		formState: { errors },
	} = useForm<ContractCreateInput>({
		resolver: zodResolver(contractCreateInputZod),
		defaultValues: {
			status: "Rascunho",
		},
	});

	const selectedTipo = useWatch({ control, name: "tipo" });

	const { data: clients } = useQuery(trpc.clients.listClients.queryOptions({}));

	const createContract = useMutation(
		trpc.contracts.createContract.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries({ queryKey: trpc.contracts.listContracts.queryKey() });
				navigate("/contracts");
			},
		}),
	);

	const onSubmit = async (data: ContractCreateInput) => {
		await createContract.mutateAsync(data);
	};

	const showFrequencia = selectedTipo === "PMOC" || selectedTipo === "Residencial";
	const isBusy = createContract.isPending;

	return (
		<Container maxWidth="md" sx={{ py: { xs: 3, md: 5 } }}>
			<Box sx={{ mb: 4 }}>
				<Button
					variant="text"
					size="small"
					onClick={() => navigate("/contracts")}
					sx={{ mb: 1, color: "text.secondary" }}
				>
					← Voltar para Contratos
				</Button>
				<Typography variant="h4" fontWeight={700}>
					Novo Contrato
				</Typography>
			</Box>

			<Paper
				elevation={0}
				sx={{ border: "1px solid", borderColor: "divider", borderRadius: 2, p: 4 }}
			>
				{createContract.error && (
					<ErrorAlert
						message={`Erro ao salvar contrato: ${createContract.error.message}`}
						sx={{ mb: 3 }}
					/>
				)}
				<Box
					component="form"
					onSubmit={handleSubmit(onSubmit)}
					sx={{ display: "flex", flexDirection: "column", gap: 3 }}
				>
					{/* Row 1: Cliente + Tipo */}
					<Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "2fr 1fr" }, gap: 3 }}>
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
									{CONTRACT_TYPE_ENUM.map((t) => (
										<MenuItem key={t} value={t}>
											{t}
										</MenuItem>
									))}
								</TextField>
							)}
						/>
					</Box>

					{/* Row 2: Datas */}
					<Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 3 }}>
						<Controller
							name="dataInicio"
							control={control}
							render={({ field }) => (
								<TextField
									{...field}
									label="Data Início *"
									type="date"
									fullWidth
									InputLabelProps={{ shrink: true }}
									error={!!errors.dataInicio}
									helperText={errors.dataInicio?.message}
								/>
							)}
						/>

						<Controller
							name="dataFim"
							control={control}
							render={({ field }) => (
								<TextField
									{...field}
									value={field.value ?? ""}
									label="Data Fim"
									type="date"
									fullWidth
									InputLabelProps={{ shrink: true }}
									error={!!errors.dataFim}
									helperText={errors.dataFim?.message}
								/>
							)}
						/>
					</Box>

					{/* Row 3: Valor + Frequência */}
					<Box
						sx={{
							display: "grid",
							gridTemplateColumns: { xs: "1fr", sm: showFrequencia ? "1fr 1fr" : "1fr" },
							gap: 3,
						}}
					>
						<Controller
							name="valor"
							control={control}
							render={({ field }) => (
								<TextField
									{...field}
									value={field.value ?? ""}
									onChange={(e) => {
										const v = e.target.value;
										field.onChange(v === "" ? undefined : Number(v));
									}}
									label="Valor Mensal (R$)"
									type="number"
									fullWidth
									inputProps={{ min: 0, step: 0.01 }}
									error={!!errors.valor}
									helperText={errors.valor?.message}
								/>
							)}
						/>

						{showFrequencia && (
							<Controller
								name="frequencia"
								control={control}
								render={({ field }) => (
									<TextField
										{...field}
										value={field.value ?? ""}
										select
										label="Frequência"
										fullWidth
										error={!!errors.frequencia}
										helperText={errors.frequencia?.message}
									>
										<MenuItem value="">Nenhuma</MenuItem>
										{CONTRACT_FREQUENCY_ENUM.map((f) => (
											<MenuItem key={f} value={f}>
												{f}
											</MenuItem>
										))}
									</TextField>
								)}
							/>
						)}
					</Box>

					{/* Row 4: Descrição */}
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

					{/* Row 5: Observações */}
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
							onClick={() => navigate("/contracts")}
							disabled={isBusy}
						>
							Cancelar
						</Button>
						<Button
							type="submit"
							variant="contained"
							disabled={isBusy}
							sx={{ minWidth: 160 }}
						>
							{isBusy ? "Salvando..." : "Salvar Contrato"}
						</Button>
					</Box>
				</Box>
			</Paper>
		</Container>
	);
}
