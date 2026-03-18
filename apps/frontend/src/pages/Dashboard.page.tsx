import { ErrorAlert } from "@connected-repo/ui-mui/components/ErrorAlert";
import { Chip } from "@connected-repo/ui-mui/data-display/Chip";
import { Typography } from "@connected-repo/ui-mui/data-display/Typography";
import { Skeleton } from "@connected-repo/ui-mui/feedback/Skeleton";
import { Button } from "@connected-repo/ui-mui/form/Button";
import { CalendarTodayIcon } from "@connected-repo/ui-mui/icons/CalendarTodayIcon";
import { DescriptionIcon } from "@connected-repo/ui-mui/icons/DescriptionIcon";
import { GridViewIcon } from "@connected-repo/ui-mui/icons/GridViewIcon";
import { NotificationsIcon } from "@connected-repo/ui-mui/icons/NotificationsIcon";
import { PeopleIcon } from "@connected-repo/ui-mui/icons/PeopleIcon";
import { TrendingUpIcon } from "@connected-repo/ui-mui/icons/TrendingUpIcon";
import { Box } from "@connected-repo/ui-mui/layout/Box";
import { Container } from "@connected-repo/ui-mui/layout/Container";
import { Divider } from "@connected-repo/ui-mui/layout/Divider";
import { Paper } from "@connected-repo/ui-mui/layout/Paper";
import { Stack } from "@connected-repo/ui-mui/layout/Stack";
import { useSessionInfo } from "@frontend/contexts/UserContext";
import { trpc } from "@frontend/utils/trpc.client";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router";

// ── Formatters ────────────────────────────────────────────────────────────────

function formatDate(dateStr: string | null | undefined): string {
	if (!dateStr) return "—";
	const date = new Date(`${dateStr}T12:00:00`);
	return date.toLocaleDateString("pt-BR", {
		day: "2-digit",
		month: "2-digit",
		year: "numeric",
	});
}

function formatTime(timestamp: string | number | null | undefined): string {
	if (timestamp == null) return "—";
	const date = new Date(timestamp);
	return date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function formatCurrency(valor: number | null | undefined): string {
	if (valor == null) return "—";
	return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function todayPtBR(): string {
	return new Date().toLocaleDateString("pt-BR", {
		weekday: "long",
		day: "2-digit",
		month: "long",
		year: "numeric",
	});
}

// ── KPI Card ─────────────────────────────────────────────────────────────────

interface KpiCardProps {
	label: string;
	value: number;
	icon: React.ReactNode;
	color: string;
}

function KpiCard({ label, value, icon, color }: KpiCardProps) {
	return (
		<Paper
			elevation={0}
			sx={{
				border: "1px solid",
				borderColor: "divider",
				borderRadius: 2,
				p: 3,
				transition: "all 0.2s ease-in-out",
				"&:hover": { transform: "translateY(-2px)", boxShadow: 3 },
			}}
		>
			<Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1 }}>
				<Typography
					variant="caption"
					color="text.secondary"
					fontWeight={500}
					sx={{ textTransform: "uppercase", letterSpacing: "0.05em" }}
				>
					{label}
				</Typography>
				<Box sx={{ color, display: "flex" }}>{icon}</Box>
			</Box>
			<Typography
				variant="h3"
				fontWeight={700}
				sx={{ color, fontSize: { xs: "2rem", md: "2.5rem" } }}
			>
				{value}
			</Typography>
		</Paper>
	);
}

function KpiCardSkeleton() {
	return (
		<Paper
			elevation={0}
			sx={{ border: "1px solid", borderColor: "divider", borderRadius: 2, p: 3 }}
		>
			<Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1 }}>
				<Skeleton variant="text" width={80} height={16} />
				<Skeleton variant="circular" width={20} height={20} />
			</Box>
			<Skeleton variant="text" width={60} height={48} />
		</Paper>
	);
}

// ── Panel wrapper ─────────────────────────────────────────────────────────────

interface PanelProps {
	title: string;
	actionLabel: string;
	onAction: () => void;
	children: React.ReactNode;
}

function Panel({ title, actionLabel, onAction, children }: PanelProps) {
	return (
		<Paper
			elevation={0}
			sx={{
				border: "1px solid",
				borderColor: "divider",
				borderRadius: 2,
				display: "flex",
				flexDirection: "column",
				overflow: "hidden",
			}}
		>
			<Box
				sx={{
					px: 3,
					py: 2,
					display: "flex",
					alignItems: "center",
					justifyContent: "space-between",
				}}
			>
				<Typography variant="subtitle1" fontWeight={700}>
					{title}
				</Typography>
				<Button size="small" variant="text" onClick={onAction} sx={{ fontSize: "0.75rem" }}>
					{actionLabel}
				</Button>
			</Box>
			<Divider />
			<Box sx={{ flex: 1, overflow: "hidden" }}>{children}</Box>
		</Paper>
	);
}

function PanelEmpty({ message }: { message: string }) {
	return (
		<Box sx={{ p: 4, textAlign: "center" }}>
			<Typography variant="body2" color="text.disabled">
				{message}
			</Typography>
		</Box>
	);
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function DashboardPage() {
	const navigate = useNavigate();
	const { user } = useSessionInfo();

	const { data, isLoading, error } = useQuery(trpc.dashboard.getStats.queryOptions());

	// ── Loading ──────────────────────────────────────────────────────────────

	if (isLoading) {
		return (
			<Container maxWidth="xl" sx={{ py: { xs: 3, md: 5 } }}>
				<Stack spacing={4}>
					{/* Header skeleton */}
					<Box>
						<Skeleton variant="text" width={200} height={48} />
						<Skeleton variant="text" width={280} height={24} />
					</Box>

					{/* KPI skeletons */}
					<Box
						sx={{
							display: "grid",
							gridTemplateColumns: { xs: "1fr 1fr", sm: "repeat(3, 1fr)", md: "repeat(6, 1fr)" },
							gap: 2,
						}}
					>
						{Array.from({ length: 6 }).map((_, i) => (
							<KpiCardSkeleton key={i} />
						))}
					</Box>

					{/* Panel skeletons */}
					<Box
						sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "2fr 1fr 1fr" }, gap: 3 }}
					>
						{Array.from({ length: 3 }).map((_, i) => (
							<Paper
								key={i}
								elevation={0}
								sx={{ border: "1px solid", borderColor: "divider", borderRadius: 2, p: 3 }}
							>
								<Skeleton variant="text" width="60%" height={28} sx={{ mb: 2 }} />
								{Array.from({ length: 4 }).map((__, j) => (
									<Skeleton key={j} variant="text" width="100%" height={20} sx={{ mb: 1 }} />
								))}
							</Paper>
						))}
					</Box>
				</Stack>
			</Container>
		);
	}

	// ── Error ────────────────────────────────────────────────────────────────

	if (error) {
		return (
			<Container maxWidth="xl" sx={{ py: 4 }}>
				<ErrorAlert message={`Erro ao carregar dashboard: ${error.message}`} />
			</Container>
		);
	}

	const { kpis, recentContracts, upcomingSchedules, pendingRemindersList } = data!;

	// ── Render ───────────────────────────────────────────────────────────────

	return (
		<Container maxWidth="xl" sx={{ py: { xs: 3, md: 5 } }}>
			<Stack spacing={4}>
				{/* Header */}
				<Box
					sx={{
						pb: 3,
						borderBottom: "1px solid",
						borderColor: "divider",
						background: "linear-gradient(135deg, #0B1F3A 0%, #0e2a4d 100%)",
						mx: -3,
						px: 3,
						pt: 3,
						borderRadius: 2,
					}}
				>
					<Typography
						variant="h3"
						component="h1"
						sx={{
							fontWeight: 700,
							letterSpacing: "-0.01em",
							color: "#06B6D4",
							fontSize: { xs: "2rem", md: "2.5rem" },
						}}
					>
						Dashboard
					</Typography>
					<Typography
						variant="body2"
						sx={{ color: "rgba(255,255,255,0.7)", mt: 0.5, textTransform: "capitalize" }}
					>
						Bem-vindo, {user?.name ?? user?.email ?? "Usuário"} &nbsp;·&nbsp; {todayPtBR()}
					</Typography>
				</Box>

				{/* KPI Cards */}
				<Box
					sx={{
						display: "grid",
						gridTemplateColumns: { xs: "1fr 1fr", sm: "repeat(3, 1fr)", md: "repeat(6, 1fr)" },
						gap: 2,
					}}
				>
					<KpiCard
						label="Clientes"
						value={kpis.totalClients}
						icon={<PeopleIcon sx={{ fontSize: 20 }} />}
						color="primary.main"
					/>
					<KpiCard
						label="Leads"
						value={kpis.totalLeads}
						icon={<TrendingUpIcon sx={{ fontSize: 20 }} />}
						color="warning.main"
					/>
					<KpiCard
						label="Contratos Ativos"
						value={kpis.activeContracts}
						icon={<DescriptionIcon sx={{ fontSize: 20 }} />}
						color="success.main"
					/>
					<KpiCard
						label="Lembretes"
						value={kpis.pendingReminders}
						icon={<NotificationsIcon sx={{ fontSize: 20 }} />}
						color="error.main"
					/>
					<KpiCard
						label="Agenda Hoje"
						value={kpis.todaySchedules}
						icon={<CalendarTodayIcon sx={{ fontSize: 20 }} />}
						color="info.main"
					/>
					<KpiCard
						label="OS Abertas"
						value={kpis.openServiceOrders}
						icon={<GridViewIcon sx={{ fontSize: 20 }} />}
						color="secondary.main"
					/>
				</Box>

				{/* Panels */}
				<Box
					sx={{
						display: "grid",
						gridTemplateColumns: { xs: "1fr", md: "2fr 1fr 1fr" },
						gap: 3,
						alignItems: "start",
					}}
				>
					{/* Panel A — Próximos Agendamentos */}
					<Panel
						title="Próximos Agendamentos"
						actionLabel="Ver Agenda"
						onAction={() => navigate("/schedule")}
					>
						{upcomingSchedules.length === 0 ? (
							<PanelEmpty message="Nenhum agendamento próximo" />
						) : (
							<Box sx={{ display: "flex", flexDirection: "column" }}>
								{upcomingSchedules.map((s, idx) => {
									const schedule = s as {
										scheduleId: string;
										tipo: string;
										status: string;
										dataHora: string | number;
										clienteId: string;
									};
									return (
										<Box key={schedule.scheduleId}>
											{idx > 0 && <Divider />}
											<Box
												sx={{
													px: 3,
													py: 2,
													display: "flex",
													alignItems: "center",
													gap: 2,
													cursor: "pointer",
													transition: "background 0.15s ease",
													"&:hover": { bgcolor: "action.hover" },
												}}
												onClick={() => navigate(`/schedule/${schedule.scheduleId}`)}
											>
												<Typography
													variant="subtitle2"
													fontWeight={700}
													sx={{
														color: "#06B6D4",
														minWidth: 44,
														fontVariantNumeric: "tabular-nums",
													}}
												>
													{formatTime(schedule.dataHora)}
												</Typography>
												<Box sx={{ flex: 1, minWidth: 0 }}>
													<Chip
														label={schedule.tipo}
														size="small"
														variant="outlined"
														sx={{ mb: 0.25 }}
													/>
												</Box>
												<Chip
													label={schedule.status}
													size="small"
													sx={{
														bgcolor:
															schedule.status === "Confirmado"
																? "success.light"
																: schedule.status === "Cancelado"
																	? "error.light"
																	: "info.light",
														color:
															schedule.status === "Confirmado"
																? "success.dark"
																: schedule.status === "Cancelado"
																	? "error.dark"
																	: "info.dark",
														fontWeight: 600,
														fontSize: "0.7rem",
													}}
												/>
											</Box>
										</Box>
									);
								})}
							</Box>
						)}
					</Panel>

					{/* Panel B — Lembretes Pendentes */}
					<Panel
						title="Lembretes Pendentes"
						actionLabel="Ver Lembretes"
						onAction={() => navigate("/reminders")}
					>
						{pendingRemindersList.length === 0 ? (
							<PanelEmpty message="Nenhum lembrete pendente" />
						) : (
							<Box sx={{ display: "flex", flexDirection: "column" }}>
								{pendingRemindersList.map((r, idx) => {
									const reminder = r as {
										reminderId: string;
										titulo: string;
										tipo: string;
										dataLembrete: string;
										clienteId: string;
									};
									return (
										<Box key={reminder.reminderId}>
											{idx > 0 && <Divider />}
											<Box
												sx={{
													px: 3,
													py: 2,
													cursor: "pointer",
													transition: "background 0.15s ease",
													"&:hover": { bgcolor: "action.hover" },
												}}
												onClick={() => navigate("/reminders")}
											>
												<Typography variant="body2" fontWeight={600} noWrap>
													{reminder.titulo}
												</Typography>
												<Box sx={{ display: "flex", alignItems: "center", gap: 1, mt: 0.5 }}>
													<Chip label={reminder.tipo} size="small" variant="outlined" />
													<Typography variant="caption" color="text.secondary">
														{formatDate(reminder.dataLembrete)}
													</Typography>
												</Box>
											</Box>
										</Box>
									);
								})}
							</Box>
						)}
					</Panel>

					{/* Panel C — Contratos Recentes */}
					<Panel
						title="Contratos Recentes"
						actionLabel="Ver Contratos"
						onAction={() => navigate("/contracts")}
					>
						{recentContracts.length === 0 ? (
							<PanelEmpty message="Nenhum contrato recente" />
						) : (
							<Box sx={{ display: "flex", flexDirection: "column" }}>
								{recentContracts.map((c, idx) => {
									const contract = c as {
										contractId: string;
										tipo: string;
										status: string;
										dataInicio: string;
										valor: number | null;
										clienteId: string;
									};
									return (
										<Box key={contract.contractId}>
											{idx > 0 && <Divider />}
											<Box
												sx={{
													px: 3,
													py: 2,
													cursor: "pointer",
													transition: "background 0.15s ease",
													"&:hover": { bgcolor: "action.hover" },
												}}
												onClick={() => navigate(`/contracts/${contract.contractId}`)}
											>
												<Box
													sx={{
														display: "flex",
														alignItems: "center",
														justifyContent: "space-between",
														gap: 1,
													}}
												>
													<Chip label={contract.tipo} size="small" variant="outlined" />
													<Chip
														label={contract.status}
														size="small"
														sx={{
															bgcolor:
																contract.status === "Ativo"
																	? "success.light"
																	: contract.status === "Cancelado"
																		? "error.light"
																		: "warning.light",
															color:
																contract.status === "Ativo"
																	? "success.dark"
																	: contract.status === "Cancelado"
																		? "error.dark"
																		: "warning.dark",
															fontWeight: 600,
															fontSize: "0.7rem",
														}}
													/>
												</Box>
												<Typography
													variant="body2"
													fontWeight={600}
													sx={{ mt: 0.5, color: "#06B6D4" }}
												>
													{formatCurrency(contract.valor)}
												</Typography>
												<Typography variant="caption" color="text.secondary">
													{formatDate(contract.dataInicio)}
												</Typography>
											</Box>
										</Box>
									);
								})}
							</Box>
						)}
					</Panel>
				</Box>
			</Stack>
		</Container>
	);
}
