import { ErrorAlert } from "@connected-repo/ui-mui/components/ErrorAlert";
import { LoadingSpinner } from "@connected-repo/ui-mui/components/LoadingSpinner";
import { Chip } from "@connected-repo/ui-mui/data-display/Chip";
import { Typography } from "@connected-repo/ui-mui/data-display/Typography";
import { Alert } from "@connected-repo/ui-mui/feedback/Alert";
import { CircularProgress } from "@connected-repo/ui-mui/feedback/CircularProgress";
import { Dialog } from "@connected-repo/ui-mui/feedback/Dialog";
import { Button } from "@connected-repo/ui-mui/form/Button";
import { TextField } from "@connected-repo/ui-mui/form/TextField";
import { Box } from "@connected-repo/ui-mui/layout/Box";
import { Container } from "@connected-repo/ui-mui/layout/Container";
import { Paper } from "@connected-repo/ui-mui/layout/Paper";
import { MenuItem } from "@connected-repo/ui-mui/navigation/MenuItem";
import {
	USER_ROLE_ENUM,
	type UserRole,
} from "@connected-repo/zod-schemas/crm_enums.zod";
import { trpc } from "@frontend/utils/trpc.client";
import {
	DialogActions,
	DialogContent,
	DialogTitle,
} from "@mui/material";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

const ROLE_COLORS: Record<
	UserRole,
	"error" | "warning" | "info" | "success" | "default" | "primary" | "secondary"
> = {
	Admin: "error",
	Gestor: "warning",
	Tecnico: "info",
	Comercial: "success",
	Marketing: "secondary",
	Atendimento: "primary",
	Financeiro: "default",
};

export default function UserRolesPage() {
	const queryClient = useQueryClient();
	const [dialogOpen, setDialogOpen] = useState(false);
	const [selectedUserId, setSelectedUserId] = useState("");
	const [selectedRole, setSelectedRole] = useState<UserRole | "">("");

	const { data: myRoles, isLoading: myRolesLoading } = useQuery(
		trpc.userRoles.getMyRoles.queryOptions(),
	);

	const isAdmin = myRoles?.some((r) => r.role === "Admin") ?? false;

	const { data: users, isLoading: usersLoading } = useQuery(
		trpc.users.getAll.queryOptions(),
	);

	const {
		data: roles,
		isLoading: rolesLoading,
		error: rolesError,
	} = useQuery(
		trpc.userRoles.listUserRoles.queryOptions(
			selectedUserId ? { userId: selectedUserId } : {},
		),
	);

	const assignMutation = useMutation(
		trpc.userRoles.assignRole.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries({ queryKey: trpc.userRoles.listUserRoles.queryKey() });
				setDialogOpen(false);
				setSelectedRole("");
			},
		}),
	);

	const revokeMutation = useMutation(
		trpc.userRoles.revokeRole.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries({ queryKey: trpc.userRoles.listUserRoles.queryKey() });
			},
		}),
	);

	if (myRolesLoading) return <LoadingSpinner text="Carregando permissões..." />;

	if (!isAdmin) {
		return (
			<Container maxWidth="lg" sx={{ py: 4 }}>
				<Alert severity="warning">
					Apenas usuários com perfil Admin podem gerenciar permissões.
				</Alert>
			</Container>
		);
	}

	return (
		<Container maxWidth="lg" sx={{ py: { xs: 3, md: 5 } }}>
			{/* Header */}
			<Box
				sx={{
					mb: 4,
					display: "flex",
					justifyContent: "space-between",
					alignItems: "center",
					flexWrap: "wrap",
					gap: 2,
				}}
			>
				<Box>
					<Typography
						variant="h3"
						component="h1"
						sx={{
							fontSize: { xs: "1.75rem", md: "2.5rem" },
							fontWeight: 700,
							letterSpacing: "-0.01em",
						}}
					>
						Usuários e Permissões
					</Typography>
					<Typography variant="body2" color="text.secondary">
						Gerencie os perfis de acesso dos usuários
					</Typography>
				</Box>
				<Button
					variant="contained"
					onClick={() => setDialogOpen(true)}
					sx={{
						transition: "all 0.2s ease-in-out",
						"&:hover": { transform: "translateY(-2px)", boxShadow: 4 },
					}}
				>
					Atribuir Perfil
				</Button>
			</Box>

			{/* User selector */}
			<Paper
				elevation={0}
				sx={{ border: "1px solid", borderColor: "divider", borderRadius: 2, p: 3, mb: 4 }}
			>
				<Typography variant="subtitle2" fontWeight={600} mb={2}>
					Selecionar Usuário
				</Typography>
				{usersLoading ? (
					<CircularProgress size={24} />
				) : (
					<TextField
						select
						label="Usuário"
						value={selectedUserId}
						onChange={(e) => setSelectedUserId(e.target.value)}
						size="small"
						sx={{ minWidth: 280 }}
					>
						<MenuItem value="">Selecione um usuário...</MenuItem>
						{users?.map((u) => (
							<MenuItem key={u.userId} value={u.userId}>
								{u.name ?? u.email}
							</MenuItem>
						))}
					</TextField>
				)}
			</Paper>

			{/* Roles list */}
			{selectedUserId && (
				<>
					{rolesLoading && <LoadingSpinner text="Carregando perfis..." />}
					{rolesError && (
						<ErrorAlert message={`Erro ao carregar perfis: ${rolesError.message}`} />
					)}
					{!rolesLoading && !rolesError && (
						<Paper
							elevation={0}
							sx={{ border: "1px solid", borderColor: "divider", borderRadius: 2, p: 3 }}
						>
							<Typography variant="subtitle2" fontWeight={600} mb={2}>
								Perfis Atribuídos
							</Typography>
							{!roles || roles.length === 0 ? (
								<Typography variant="body2" color="text.secondary">
									Nenhum perfil atribuído a este usuário.
								</Typography>
							) : (
								<Box sx={{ display: "flex", flexWrap: "wrap", gap: 1.5 }}>
									{roles.map((r) => (
										<Box
											key={r.userRoleId}
											sx={{ display: "flex", alignItems: "center", gap: 0.5 }}
										>
											<Chip
												label={r.role}
												color={ROLE_COLORS[r.role as UserRole] ?? "default"}
												variant="filled"
												size="medium"
												onDelete={
													isAdmin
														? () =>
																revokeMutation.mutate({
																	userId: selectedUserId,
																	role: r.role as UserRole,
																})
														: undefined
												}
											/>
										</Box>
									))}
								</Box>
							)}
						</Paper>
					)}
				</>
			)}

			{/* Assign role dialog */}
			<Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="xs" fullWidth>
				<DialogTitle>Atribuir Perfil</DialogTitle>
				<DialogContent sx={{ pt: 2 }}>
					<TextField
						select
						label="Usuário"
						value={selectedUserId}
						onChange={(e) => setSelectedUserId(e.target.value)}
						fullWidth
						size="small"
						sx={{ mb: 2 }}
					>
						{users?.map((u) => (
							<MenuItem key={u.userId} value={u.userId}>
								{u.name ?? u.email}
							</MenuItem>
						))}
					</TextField>
					<TextField
						select
						label="Perfil"
						value={selectedRole}
						onChange={(e) => setSelectedRole(e.target.value as UserRole)}
						fullWidth
						size="small"
					>
						{USER_ROLE_ENUM.map((role) => (
							<MenuItem key={role} value={role}>
								<Chip label={role} color={ROLE_COLORS[role]} size="small" sx={{ mr: 1 }} />
								{role}
							</MenuItem>
						))}
					</TextField>
					{assignMutation.error && (
						<Alert severity="error" sx={{ mt: 2 }}>
							{assignMutation.error.message}
						</Alert>
					)}
				</DialogContent>
				<DialogActions sx={{ px: 3, pb: 2 }}>
					<Button onClick={() => setDialogOpen(false)} color="inherit">
						Cancelar
					</Button>
					<Button
						variant="contained"
						disabled={!selectedUserId || !selectedRole || assignMutation.isPending}
						onClick={() => {
							if (selectedUserId && selectedRole) {
								assignMutation.mutate({ userId: selectedUserId, role: selectedRole });
							}
						}}
					>
						{assignMutation.isPending ? (
							<CircularProgress size={18} sx={{ mr: 1 }} />
						) : null}
						Atribuir
					</Button>
				</DialogActions>
			</Dialog>
		</Container>
	);
}
