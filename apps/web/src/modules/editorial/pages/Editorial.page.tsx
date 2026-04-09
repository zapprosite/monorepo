import { ErrorAlert } from "@connected-repo/ui-mui/components/ErrorAlert";
import { LoadingSpinner } from "@connected-repo/ui-mui/components/LoadingSpinner";
import { Chip } from "@connected-repo/ui-mui/data-display/Chip";
import { Typography } from "@connected-repo/ui-mui/data-display/Typography";
import { Button } from "@connected-repo/ui-mui/form/Button";
import { TextField } from "@connected-repo/ui-mui/form/TextField";
import { Box } from "@connected-repo/ui-mui/layout/Box";
import { Container } from "@connected-repo/ui-mui/layout/Container";
import { Paper } from "@connected-repo/ui-mui/layout/Paper";
import { MenuItem } from "@connected-repo/ui-mui/navigation/MenuItem";
import type {
	EditorialChannel,
	EditorialFormat,
	EditorialStatus,
} from "@connected-repo/zod-schemas/crm_enums.zod";
import {
	EDITORIAL_CHANNEL_ENUM,
	EDITORIAL_FORMAT_ENUM,
	EDITORIAL_STATUS_ENUM,
} from "@connected-repo/zod-schemas/crm_enums.zod";
import { trpc } from "@frontend/utils/trpc.client";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useNavigate } from "react-router";
import { EditorialStatusBadge } from "../components/EditorialStatusBadge";

function formatDate(dateStr: string | null | undefined): string {
	if (!dateStr) return "—";
	const date = new Date(`${dateStr}T12:00:00`);
	return date.toLocaleDateString("pt-BR", {
		day: "2-digit",
		month: "2-digit",
		year: "numeric",
	});
}

export default function EditorialPage() {
	const navigate = useNavigate();
	const [filterStatus, setFilterStatus] = useState<EditorialStatus | "">("");
	const [filterCanal, setFilterCanal] = useState<EditorialChannel | "">("");
	const [filterFormato, setFilterFormato] = useState<EditorialFormat | "">("");
	const [filterDataInicio, setFilterDataInicio] = useState("");
	const [filterDataFim, setFilterDataFim] = useState("");

	const {
		data: items,
		isLoading,
		error,
	} = useQuery(
		trpc.editorial.listEditorialItems.queryOptions({
			status: filterStatus || undefined,
			canal: filterCanal || undefined,
			formato: filterFormato || undefined,
			dataInicio: filterDataInicio || undefined,
			dataFim: filterDataFim || undefined,
		}),
	);

	if (isLoading) return <LoadingSpinner text="Carregando calendário editorial..." />;

	if (error) {
		return (
			<Container maxWidth="lg" sx={{ py: 4 }}>
				<ErrorAlert message={`Erro ao carregar itens editoriais: ${error.message}`} />
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
						Calendário Editorial
					</Typography>
					<Typography variant="body2" color="text.secondary">
						{items?.length ?? 0} itens
					</Typography>
				</Box>
				<Button
					variant="contained"
					onClick={() => navigate("/editorial/new")}
					sx={{
						transition: "all 0.2s ease-in-out",
						"&:hover": { transform: "translateY(-2px)", boxShadow: 4 },
					}}
				>
					Novo Item
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
						onChange={(e) => setFilterStatus(e.target.value as EditorialStatus | "")}
						size="small"
						fullWidth
					>
						<MenuItem value="">Todos</MenuItem>
						{EDITORIAL_STATUS_ENUM.map((s) => (
							<MenuItem key={s} value={s}>
								{s}
							</MenuItem>
						))}
					</TextField>

					<TextField
						select
						label="Canal"
						value={filterCanal}
						onChange={(e) => setFilterCanal(e.target.value as EditorialChannel | "")}
						size="small"
						fullWidth
					>
						<MenuItem value="">Todos</MenuItem>
						{EDITORIAL_CHANNEL_ENUM.map((c) => (
							<MenuItem key={c} value={c}>
								{c}
							</MenuItem>
						))}
					</TextField>

					<TextField
						select
						label="Formato"
						value={filterFormato}
						onChange={(e) => setFilterFormato(e.target.value as EditorialFormat | "")}
						size="small"
						fullWidth
					>
						<MenuItem value="">Todos</MenuItem>
						{EDITORIAL_FORMAT_ENUM.map((f) => (
							<MenuItem key={f} value={f}>
								{f}
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
			{!items || items.length === 0 ? (
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
						Nenhum item no calendário editorial
					</Typography>
					<Typography variant="body2" color="text.disabled" mb={3}>
						Crie o primeiro item para organizar sua estratégia de conteúdo
					</Typography>
					<Button variant="contained" onClick={() => navigate("/editorial/new")}>
						Novo Item
					</Button>
				</Paper>
			) : (
				<Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
					{items.map((item) => (
						<Paper
							key={item.editorialId}
							elevation={0}
							onClick={() => navigate(`/editorial/${item.editorialId}`)}
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
										{item.titulo}
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
										<Chip label={item.canal} size="small" variant="outlined" />
										<Chip label={item.formato} size="small" variant="outlined" />
										<Typography variant="body2" color="text.secondary">
											{formatDate(item.dataPublicacao)}
										</Typography>
									</Box>
								</Box>
								<EditorialStatusBadge status={item.status} />
							</Box>
						</Paper>
					))}
				</Box>
			)}
		</Container>
	);
}
