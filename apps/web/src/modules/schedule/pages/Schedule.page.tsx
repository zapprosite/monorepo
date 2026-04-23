import { ErrorAlert } from "@connected-repo/ui-mui/components/ErrorAlert";
import { LoadingSpinner } from "@connected-repo/ui-mui/components/LoadingSpinner";
import { Typography } from "@connected-repo/ui-mui/data-display/Typography";
import { Button } from "@connected-repo/ui-mui/form/Button";
import { TextField } from "@connected-repo/ui-mui/form/TextField";
import { Box } from "@connected-repo/ui-mui/layout/Box";
import { Container } from "@connected-repo/ui-mui/layout/Container";
import { Paper } from "@connected-repo/ui-mui/layout/Paper";
import { MenuItem } from "@connected-repo/ui-mui/navigation/MenuItem";
import type { ScheduleStatus, ServiceType } from "@connected-repo/zod-schemas/crm_enums.zod";
import { SCHEDULE_STATUS_ENUM, SERVICE_TYPE_ENUM } from "@connected-repo/zod-schemas/crm_enums.zod";
import { trpc } from "@frontend/utils/trpc.client";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useNavigate } from "react-router";
import { ScheduleStatusBadge } from "../components/ScheduleStatusBadge";

function formatDate(timestamp: number | string): string {
	const date = typeof timestamp === "number" ? new Date(timestamp) : new Date(timestamp);
	return date.toLocaleDateString("pt-BR", {
		weekday: "long",
		day: "2-digit",
		month: "long",
		year: "numeric",
	});
}

function formatTime(timestamp: number | string): string {
	const date = typeof timestamp === "number" ? new Date(timestamp) : new Date(timestamp);
	return date.toLocaleTimeString("pt-BR", {
		hour: "2-digit",
		minute: "2-digit",
	});
}

function groupByDay(
	schedules: Array<{ scheduleId: string; dataHora: number | string; [key: string]: unknown }>,
): Map<string, typeof schedules> {
	const groups = new Map<string, typeof schedules>();
	for (const s of schedules) {
		const date = typeof s.dataHora === "number" ? new Date(s.dataHora) : new Date(s.dataHora);
		const day = date.toISOString().slice(0, 10);
		if (!groups.has(day)) groups.set(day, []);
		groups.get(day)?.push(s);
	}
	return groups;
}

export default function SchedulePage() {
	const navigate = useNavigate();
	const [filterStatus, setFilterStatus] = useState<ScheduleStatus | "">("");
	const [filterTipo, setFilterTipo] = useState<ServiceType | "">("");
	const [filterDataInicio, setFilterDataInicio] = useState("");
	const [filterDataFim, setFilterDataFim] = useState("");

	const hasActiveFilters = Boolean(filterStatus || filterTipo || filterDataInicio || filterDataFim);

	const {
		data: schedules,
		isLoading,
		error,
	} = useQuery(
		trpc.schedule.listSchedules.queryOptions({
			status: filterStatus || undefined,
			tipo: filterTipo || undefined,
			dataInicio: filterDataInicio ? new Date(filterDataInicio).toISOString() : undefined,
			dataFim: filterDataFim ? new Date(`${filterDataFim}T23:59:59`).toISOString() : undefined,
		}),
	);

	if (isLoading) return <LoadingSpinner text="Carregando agenda..." />;

	if (error) {
		return (
			<Container maxWidth="lg" sx={{ py: 4 }}>
				<ErrorAlert message={`Erro ao carregar agenda: ${error.message}`} />
			</Container>
		);
	}

	const grouped = groupByDay(
		(schedules ?? []) as Array<{
			scheduleId: string;
			dataHora: number | string;
			[key: string]: unknown;
		}>,
	);
	const days = Array.from(grouped.keys()).sort();

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
						Agenda
					</Typography>
					<Typography variant="body2" color="text.secondary">
						{schedules?.length ?? 0} agendamentos
					</Typography>
				</Box>
				<Button
					variant="contained"
					onClick={() => navigate("/schedule/new")}
					sx={{
						transition: "all 0.2s ease-in-out",
						"&:hover": { transform: "translateY(-2px)", boxShadow: 4 },
					}}
				>
					Novo Agendamento
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
						onChange={(e) => setFilterStatus(e.target.value as ScheduleStatus | "")}
						size="small"
						fullWidth
					>
						<MenuItem value="">Todos</MenuItem>
						{SCHEDULE_STATUS_ENUM.map((s) => (
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
			{!schedules || schedules.length === 0 ? (
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
						Nenhum agendamento encontrado
					</Typography>
					<Typography variant="body2" color="text.disabled" mb={3}>
						Crie o primeiro agendamento para organizar a agenda da equipe
					</Typography>
					<Button variant="contained" onClick={() => navigate("/schedule/new")}>
						Novo Agendamento
					</Button>
				</Paper>
			) : (
				<Box sx={{ display: "flex", flexDirection: "column", gap: 4 }}>
					{days.map((day) => {
						const daySchedules = grouped.get(day)!;
						const firstDate = new Date(`${day}T12:00:00`);
						return (
							<Box key={day}>
								<Typography
									variant="subtitle2"
									color="text.secondary"
									fontWeight={600}
									textTransform="capitalize"
									mb={1.5}
									sx={{ letterSpacing: "0.02em" }}
								>
									{formatDate(firstDate.toISOString())}
								</Typography>
								<Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
									{daySchedules.map((schedule) => {
										const s = schedule as {
											scheduleId: string;
											dataHora: string | number;
											tipo: ServiceType;
											status: ScheduleStatus;
											duracaoMinutos?: number;
											tecnicoId?: string | null;
										};
										return (
											<Paper
												key={s.scheduleId}
												elevation={0}
												onClick={() => navigate(`/schedule/${s.scheduleId}`)}
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
													<Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
														<Typography
															variant="h6"
															fontWeight={700}
															color="primary.main"
															sx={{ minWidth: 48 }}
														>
															{formatTime(s.dataHora)}
														</Typography>
														<Box>
															<Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.5 }}>
																<Typography variant="subtitle1" fontWeight={600}>
																	{s.tipo}
																</Typography>
																<ScheduleStatusBadge status={s.status} />
															</Box>
															<Typography variant="body2" color="text.secondary">
																{s.duracaoMinutos ? `${s.duracaoMinutos} min` : ""}
																{s.tecnicoId ? ` · Técnico: ${s.tecnicoId}` : ""}
															</Typography>
														</Box>
													</Box>
												</Box>
											</Paper>
										);
									})}
								</Box>
							</Box>
						);
					})}
				</Box>
			)}
		</Container>
	);
}
