import { ErrorAlert } from "@repo/ui-mui/components/ErrorAlert";
import { LoadingSpinner } from "@repo/ui-mui/components/LoadingSpinner";
import { Chip } from "@repo/ui-mui/data-display/Chip";
import { Typography } from "@repo/ui-mui/data-display/Typography";
import { Button } from "@repo/ui-mui/form/Button";
import { TextField } from "@repo/ui-mui/form/TextField";
import { Box } from "@repo/ui-mui/layout/Box";
import { Container } from "@repo/ui-mui/layout/Container";
import { Paper } from "@repo/ui-mui/layout/Paper";
import { MenuItem } from "@repo/ui-mui/navigation/MenuItem";
import type { ContractStatus, ContractType } from "@repo/zod-schemas/crm_enums.zod";
import {
	CONTRACT_STATUS_ENUM,
	CONTRACT_TYPE_ENUM,
} from "@repo/zod-schemas/crm_enums.zod";
import { trpc } from "@frontend/utils/trpc.client";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useNavigate } from "react-router";
import { ContractStatusBadge } from "../components/ContractStatusBadge";

function formatDate(dateStr: string | null | undefined): string {
	if (!dateStr) return "—";
	const date = new Date(`${dateStr}T12:00:00`);
	return date.toLocaleDateString("pt-BR", {
		day: "2-digit",
		month: "2-digit",
		year: "numeric",
	});
}

function formatCurrency(valor: number | null | undefined): string {
	if (valor == null) return "—";
	return valor.toLocaleString("pt-BR", {
		style: "currency",
		currency: "BRL",
	});
}

export default function ContractsPage() {
	const navigate = useNavigate();
	const [filterStatus, setFilterStatus] = useState<ContractStatus | "">("");
	const [filterTipo, setFilterTipo] = useState<ContractType | "">("");
	const [filterDataInicio, setFilterDataInicio] = useState("");
	const [filterDataFim, setFilterDataFim] = useState("");

	const {
		data: contracts,
		isLoading,
		error,
	} = useQuery(
		trpc.contracts.listContracts.queryOptions({
			status: filterStatus || undefined,
			tipo: filterTipo || undefined,
			dataInicio: filterDataInicio || undefined,
			dataFim: filterDataFim || undefined,
		}),
	);

	if (isLoading) return <LoadingSpinner text="Carregando contratos..." />;

	if (error) {
		return (
			<Container maxWidth="lg" sx={{ py: 4 }}>
				<ErrorAlert message={`Erro ao carregar contratos: ${error.message}`} />
			</Container>
		);
	}

	return (
		<Container maxWidth="xl" sx={{ py: { xs: 3, md: 5 } }}>
			{/* Header */}
			<Box
				sx={{
					mb: 4,
					display: "flex",
					justifyContent: "space-between",
					alignItems: { xs: "stretch", sm: "center" },
					flexDirection: { xs: "column", sm: "row" },
					gap: 2,
				}}
			>
				<Box>
					<Typography
						variant="h3"
						component="h1"
						sx={{
							fontSize: { xs: "2rem", md: "2.5rem" },
							fontWeight: 700,
							letterSpacing: "-0.01em",
						}}
					>
						Contratos
					</Typography>
					<Typography variant="body2" color="text.secondary">
						{contracts?.length ?? 0} contratos
					</Typography>
				</Box>
				<Button
					variant="contained"
					onClick={() => navigate("/contracts/new")}
					sx={{
						width: { xs: "100%", sm: "auto" },
						transition: "all 0.2s ease-in-out",
						"&:hover": { transform: "translateY(-2px)", boxShadow: 4 },
					}}
				>
					Novo Contrato
				</Button>
			</Box>

			{/* Filters */}
			<Paper
				elevation={0}
				sx={{ border: "1px solid", borderColor: "divider", borderRadius: 2, p: 3, mb: 4 }}
			>
				<Box
					sx={{
						display: "grid",
						gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr", md: "1fr 1fr 1fr 1fr" },
						gap: 2,
					}}
				>
					<TextField
						select
						label="Status"
						value={filterStatus}
						onChange={(e) => setFilterStatus(e.target.value as ContractStatus | "")}
						size="small"
						fullWidth
					>
						<MenuItem value="">Todos</MenuItem>
						{CONTRACT_STATUS_ENUM.map((s) => (
							<MenuItem key={s} value={s}>
								{s}
							</MenuItem>
						))}
					</TextField>

					<TextField
						select
						label="Tipo"
						value={filterTipo}
						onChange={(e) => setFilterTipo(e.target.value as ContractType | "")}
						size="small"
						fullWidth
					>
						<MenuItem value="">Todos</MenuItem>
						{CONTRACT_TYPE_ENUM.map((t) => (
							<MenuItem key={t} value={t}>
								{t}
							</MenuItem>
						))}
					</TextField>

					<TextField
						label="Data início"
						type="date"
						value={filterDataInicio}
						onChange={(e) => setFilterDataInicio(e.target.value)}
						size="small"
						fullWidth
						InputLabelProps={{ shrink: true }}
					/>

					<TextField
						label="Data fim"
						type="date"
						value={filterDataFim}
						onChange={(e) => setFilterDataFim(e.target.value)}
						size="small"
						fullWidth
						InputLabelProps={{ shrink: true }}
					/>
				</Box>
			</Paper>

			{/* List */}
			{!contracts || contracts.length === 0 ? (
				<Paper
					elevation={0}
					sx={{
						border: "1px solid",
						borderColor: "divider",
						borderRadius: 2,
						p: 8,
						textAlign: "center",
					}}
				>
					<Typography variant="h6" color="text.secondary" gutterBottom>
						Nenhum contrato cadastrado
					</Typography>
					<Typography variant="body2" color="text.disabled" mb={3}>
						Crie o primeiro contrato para gerenciar seus clientes
					</Typography>
					<Button variant="contained" onClick={() => navigate("/contracts/new")}>
						Novo Contrato
					</Button>
				</Paper>
			) : (
				<Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
					{contracts.map((contract) => {
						const c = contract as {
							contractId: string;
							clienteNome?: string;
							tipo: ContractType;
							status: ContractStatus;
							dataInicio: string;
							dataFim?: string | null;
							valor?: number | null;
						};
						return (
							<Paper
								key={c.contractId}
								elevation={0}
								onClick={() => navigate(`/contracts/${c.contractId}`)}
								sx={{
									border: "1px solid",
									borderColor: "divider",
									borderRadius: 2,
									p: 3,
									cursor: "pointer",
									transition: "all 0.2s ease-in-out",
									"&:hover": {
										borderColor: "primary.main",
										transform: "translateY(-2px)",
										boxShadow: 3,
									},
								}}
							>
								<Box
									sx={{
										display: "flex",
										alignItems: "center",
										justifyContent: "space-between",
										gap: 2,
										flexWrap: "wrap",
									}}
								>
									<Box sx={{ flex: 1, minWidth: 0 }}>
										<Typography variant="subtitle1" fontWeight={600} noWrap>
											{c.clienteNome ?? "Cliente"}
										</Typography>
										<Box
											sx={{
												display: "flex",
												alignItems: "center",
												gap: 1.5,
												mt: 0.5,
												flexWrap: "wrap",
											}}
										>
											<Chip label={c.tipo} size="small" variant="outlined" />
											<Typography variant="body2" color="text.secondary">
												{formatDate(c.dataInicio)}
												{c.dataFim ? ` — ${formatDate(c.dataFim)}` : ""}
											</Typography>
											{c.valor != null && (
												<Typography variant="body2" fontWeight={500} color="primary.main">
													{formatCurrency(c.valor)}
												</Typography>
											)}
										</Box>
									</Box>
									<ContractStatusBadge status={c.status} />
								</Box>
							</Paper>
						);
					})}
				</Box>
			)}
		</Container>
	);
}
