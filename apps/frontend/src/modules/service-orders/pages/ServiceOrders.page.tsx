import { ErrorAlert } from "@connected-repo/ui-mui/components/ErrorAlert";
import { LoadingSpinner } from "@connected-repo/ui-mui/components/LoadingSpinner";
import { Typography } from "@connected-repo/ui-mui/data-display/Typography";
import { Button } from "@connected-repo/ui-mui/form/Button";
import { TextField } from "@connected-repo/ui-mui/form/TextField";
import { Box } from "@connected-repo/ui-mui/layout/Box";
import { Container } from "@connected-repo/ui-mui/layout/Container";
import { Paper } from "@connected-repo/ui-mui/layout/Paper";
import { MenuItem } from "@connected-repo/ui-mui/navigation/MenuItem";
import type { ServiceOrderStatus, ServiceType } from "@connected-repo/zod-schemas/crm_enums.zod";
import {
	SERVICE_ORDER_STATUS_ENUM,
	SERVICE_TYPE_ENUM,
} from "@connected-repo/zod-schemas/crm_enums.zod";
import { trpc } from "@frontend/utils/trpc.client";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useNavigate } from "react-router";
import { ServiceOrderStatusBadge } from "../components/ServiceOrderStatusBadge";

function formatDate(iso: string): string {
	return new Date(iso).toLocaleDateString("pt-BR", {
		day: "2-digit",
		month: "2-digit",
		year: "numeric",
	});
}

export default function ServiceOrdersPage() {
	const navigate = useNavigate();
	const [filterStatus, setFilterStatus] = useState<ServiceOrderStatus | "">("");
	const [filterTipo, setFilterTipo] = useState<ServiceType | "">("");
	const [filterSearch, setFilterSearch] = useState("");

	const { data: serviceOrders, isLoading, error } = useQuery(
		trpc.serviceOrders.listServiceOrders.queryOptions({
			status: filterStatus || undefined,
			tipo: filterTipo || undefined,
			search: filterSearch || undefined,
		}),
	);

	if (isLoading) return <LoadingSpinner text="Carregando ordens de serviço..." />;

	if (error) {
		return (
			<Container maxWidth="lg" sx={{ py: 4 }}>
				<ErrorAlert message={`Erro ao carregar ordens de serviço: ${error.message}`} />
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
					alignItems: "center",
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
						Ordens de Serviço
					</Typography>
					<Typography variant="body2" color="text.secondary">
						{serviceOrders?.length ?? 0} ordens
					</Typography>
				</Box>
				<Button
					variant="contained"
					onClick={() => navigate("/service-orders/new")}
					sx={{
						transition: "all 0.2s ease-in-out",
						"&:hover": { transform: "translateY(-2px)", boxShadow: 4 },
					}}
				>
					+ Nova OS
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
						gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr", md: "1fr 1fr 1fr" },
						gap: 2,
					}}
				>
					<TextField
						label="Buscar por número"
						value={filterSearch}
						onChange={(e) => setFilterSearch(e.target.value)}
						size="small"
						fullWidth
						placeholder="Ex: OS-0001"
					/>

					<TextField
						select
						label="Status"
						value={filterStatus}
						onChange={(e) => setFilterStatus(e.target.value as ServiceOrderStatus | "")}
						size="small"
						fullWidth
					>
						<MenuItem value="">Todos</MenuItem>
						{SERVICE_ORDER_STATUS_ENUM.map((s) => (
							<MenuItem key={s} value={s}>
								{s}
							</MenuItem>
						))}
					</TextField>

					<TextField
						select
						label="Tipo de Serviço"
						value={filterTipo}
						onChange={(e) => setFilterTipo(e.target.value as ServiceType | "")}
						size="small"
						fullWidth
					>
						<MenuItem value="">Todos</MenuItem>
						{SERVICE_TYPE_ENUM.map((t) => (
							<MenuItem key={t} value={t}>
								{t}
							</MenuItem>
						))}
					</TextField>
				</Box>
			</Paper>

			{/* List */}
			{!serviceOrders || serviceOrders.length === 0 ? (
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
						Nenhuma ordem de serviço encontrada
					</Typography>
					<Typography variant="body2" color="text.disabled" mb={3}>
						Crie a primeira OS para gerenciar os atendimentos da equipe
					</Typography>
					<Button variant="contained" onClick={() => navigate("/service-orders/new")}>
						+ Nova OS
					</Button>
				</Paper>
			) : (
				<Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
					{serviceOrders.map((so) => {
						const order = so as {
							serviceOrderId: string;
							numero: string;
							clienteId: string;
							tipo: ServiceType;
							status: ServiceOrderStatus;
							dataAbertura: string;
						};
						return (
							<Paper
								key={order.serviceOrderId}
								elevation={0}
								onClick={() => navigate(`/service-orders/${order.serviceOrderId}`)}
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
									<Box sx={{ display: "flex", alignItems: "center", gap: 2, flex: 1 }}>
										<Typography
											variant="subtitle1"
											fontWeight={700}
											color="primary.main"
											sx={{ minWidth: 80 }}
										>
											{order.numero}
										</Typography>
										<Box sx={{ flex: 1 }}>
											<Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.5 }}>
												<Typography variant="subtitle1" fontWeight={600}>
													{order.tipo}
												</Typography>
												<ServiceOrderStatusBadge status={order.status} />
											</Box>
											<Typography variant="body2" color="text.secondary">
												Cliente: {order.clienteId} &middot; Aberta em{" "}
												{formatDate(order.dataAbertura)}
											</Typography>
										</Box>
									</Box>
								</Box>
							</Paper>
						);
					})}
				</Box>
			)}
		</Container>
	);
}
