import { Typography } from "@repo/ui-mui/data-display/Typography";
import { Alert } from "@repo/ui-mui/feedback/Alert";
import { Fade } from "@repo/ui-mui/feedback/Fade";
import { Button } from "@repo/ui-mui/form/Button";
import { TextField } from "@repo/ui-mui/form/TextField";
import { Box } from "@repo/ui-mui/layout/Box";
import { Container } from "@repo/ui-mui/layout/Container";
import { Paper } from "@repo/ui-mui/layout/Paper";
import { Stack } from "@repo/ui-mui/layout/Stack";
import { env } from "@frontend/configs/env.config";
import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router";

const API_URL = env.VITE_API_URL;
const IS_DEV = import.meta.env.DEV;

export const LoginPage = () => {
	const [isLoading, setIsLoading] = useState(false);
	const [showContent] = useState(true);
	const [searchParams] = useSearchParams();
	const error = searchParams.get("error");
	const navigate = useNavigate();

	const [devEmail, setDevEmail] = useState("dev@localhost");
	const [devPassword, setDevPassword] = useState("dev123");

	const handleGoogleLogin = () => {
		setIsLoading(true);
		window.location.href = `${API_URL}/oauth2/google`;
	};

	const handleDevLogin = async (e: React.FormEvent) => {
		e.preventDefault();
		setIsLoading(true);
		if (devEmail === "dev@localhost" && devPassword === "dev123") {
			sessionStorage.setItem(
				"dev_user",
				JSON.stringify({
					id: "dev-user-001",
					email: "dev@localhost",
					name: "Dev User",
				}),
			);
			navigate("/dashboard");
		} else {
			setIsLoading(false);
		}
	};

	return (
		<Box
			sx={{
				minHeight: "100vh",
				display: "flex",
				alignItems: "center",
				justifyContent: "center",
				background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
				px: { xs: 2, sm: 3 },
				py: { xs: 3, sm: 4 },
			}}
		>
			<Container maxWidth="sm">
				<Fade in={showContent} timeout={600}>
					<Paper
						elevation={0}
						sx={{
							p: { xs: 4, sm: 5, md: 6 },
							borderRadius: 3,
							border: "1px solid",
							borderColor: "divider",
							boxShadow: "0 8px 32px rgba(0,0,0,0.1)",
							bgcolor: "background.paper",
							transition: "all 0.3s ease-in-out",
							"&:hover": {
								boxShadow: "0 12px 48px rgba(0,0,0,0.15)",
							},
						}}
					>
						<Stack spacing={4} alignItems="center">
							<Box sx={{ textAlign: "center" }}>
								<Typography
									variant="h3"
									sx={{
										fontWeight: 600,
										color: "text.primary",
										mb: 2,
										fontSize: { xs: "2rem", sm: "2.5rem", md: "2.75rem" },
										letterSpacing: "-1px",
									}}
								>
									Entrar
								</Typography>
								<Typography
									variant="h6"
									sx={{
										color: "text.secondary",
										lineHeight: 1.7,
										fontWeight: 400,
										mb: 1,
										fontSize: { xs: "1.1rem", sm: "1.25rem" },
									}}
								>
									Acesse o Connected Repo CRM
								</Typography>
							</Box>

							{error && (
								<Fade in>
									<Alert
										severity="error"
										sx={{
											width: "100%",
											maxWidth: 400,
											borderRadius: 2,
										}}
									>
										{error === "oauth_failed"
											? "Falha na autenticação. Tente novamente."
											: "Ocorreu um erro no login. Tente novamente."}
									</Alert>
								</Fade>
							)}

							{IS_DEV && (
								<Box sx={{ width: "100%", maxWidth: 360 }}>
									<form onSubmit={handleDevLogin}>
										<Stack spacing={2}>
											<TextField
												label="E-mail (dev)"
												type="email"
												value={devEmail}
												onChange={(e) => setDevEmail(e.target.value)}
												fullWidth
												size="small"
											/>
											<TextField
												label="Senha (dev)"
												type="password"
												value={devPassword}
												onChange={(e) => setDevPassword(e.target.value)}
												fullWidth
												size="small"
											/>
											<Button type="submit" variant="contained" fullWidth disabled={isLoading}>
												{isLoading ? "Entrando..." : "Entrar no modo dev"}
											</Button>
										</Stack>
									</form>
								</Box>
							)}

							{!IS_DEV && (
								<Box sx={{ width: "100%", maxWidth: 360 }}>
									<Button
										variant="outlined"
										fullWidth
										onClick={handleGoogleLogin}
										disabled={isLoading}
										sx={{
											py: { xs: 1.75, sm: 1.5 },
											px: 3,
											fontSize: { xs: "1rem", sm: "0.95rem" },
											fontWeight: 600,
											textTransform: "none",
											borderRadius: 2,
											borderWidth: 2,
											borderColor: "divider",
											color: "text.primary",
											bgcolor: "background.paper",
											minHeight: { xs: 56, sm: 52 },
											transition: "all 0.25s ease-in-out",
											boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
											"&:hover": {
												borderWidth: 2,
												borderColor: "primary.main",
												bgcolor: "primary.light",
												transform: "translateY(-2px)",
												boxShadow: "0 4px 16px rgba(102, 126, 234, 0.2)",
											},
											"&:active": {
												transform: "translateY(0)",
												boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
											},
											"&.Mui-disabled": {
												borderColor: "action.disabledBackground",
												bgcolor: "action.disabledBackground",
												color: "action.disabled",
											},
										}}
									>
										<Box
											sx={{
												display: "flex",
												alignItems: "center",
												justifyContent: "center",
												gap: 1.5,
											}}
										>
											<span>{isLoading ? "Conectando..." : "Continuar com Google"}</span>
										</Box>
									</Button>
								</Box>
							)}

							<Box
								sx={{ mt: 4, pt: 4, borderTop: "1px solid", borderColor: "divider", width: "100%" }}
							>
								<Stack spacing={2}>
									<FeatureItem icon="📝" text="Prompts diários para reflexão" />
									<FeatureItem icon="⏰" text="Notificações agendadas no horário que você escolher" />
									<FeatureItem icon="🔍" text="Busca simples para revisitar reflexões anteriores" />
								</Stack>
							</Box>

							<Box sx={{ mt: 2 }}>
								<Typography
									variant="caption"
									sx={{
										color: "text.disabled",
										fontSize: { xs: "0.8rem", sm: "0.75rem" },
									}}
								>
									Ao continuar, você concorda com os nossos Termos de Serviço e a Política de Privacidade
								</Typography>
							</Box>
						</Stack>
					</Paper>
				</Fade>
			</Container>
		</Box>
	);
};

const FeatureItem = ({ icon, text }: { icon: string; text: string }) => (
	<Box
		sx={{
			display: "flex",
			alignItems: "center",
			gap: 2,
			px: 1,
		}}
	>
		<Typography
			sx={{
				fontSize: { xs: "1.5rem", sm: "1.25rem" },
				lineHeight: 1,
			}}
		>
			{icon}
		</Typography>
		<Typography
			variant="body2"
			sx={{
				color: "text.secondary",
				fontSize: { xs: "0.95rem", sm: "0.9rem" },
				lineHeight: 1.6,
			}}
		>
			{text}
		</Typography>
	</Box>
);
