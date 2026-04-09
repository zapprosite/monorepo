import { Typography } from "@connected-repo/ui-mui/data-display/Typography";
import { Box } from "@connected-repo/ui-mui/layout/Box";
import { Container } from "@connected-repo/ui-mui/layout/Container";
import { Paper } from "@connected-repo/ui-mui/layout/Paper";
import { useNavigate } from "react-router";

export default function SettingsPage() {
	const navigate = useNavigate();

	return (
		<Container maxWidth="lg" sx={{ py: { xs: 3, md: 5 } }}>
			<Box sx={{ mb: 4 }}>
				<Typography
					variant="h3"
					component="h1"
					sx={{
						fontSize: { xs: "1.75rem", md: "2.5rem" },
						fontWeight: 700,
						letterSpacing: "-0.01em",
					}}
				>
					Configurações
				</Typography>
				<Typography variant="body2" color="text.secondary">
					Gerencie as configurações do sistema
				</Typography>
			</Box>

			<Box
				sx={{
					display: "grid",
					gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
					gap: 3,
				}}
			>
				<Paper
					elevation={0}
					onClick={() => navigate("/settings/roles")}
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
					<Typography variant="h6" fontWeight={600} gutterBottom>
						Usuários e Permissões
					</Typography>
					<Typography variant="body2" color="text.secondary">
						Gerencie os perfis de acesso e permissões dos usuários do sistema
					</Typography>
				</Paper>
			</Box>
		</Container>
	);
}
