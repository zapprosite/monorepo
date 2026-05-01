import { Avatar } from "@repo/ui-mui/data-display/Avatar";
import { Typography } from "@repo/ui-mui/data-display/Typography";
import { CircularProgress } from "@repo/ui-mui/feedback/CircularProgress";
import { Fade } from "@repo/ui-mui/feedback/Fade";
import { Box } from "@repo/ui-mui/layout/Box";
import { Card } from "@repo/ui-mui/layout/Card";
import { Container } from "@repo/ui-mui/layout/Container";
import { Stack } from "@repo/ui-mui/layout/Stack";
import { RhfSubmitButton } from "@repo/ui-mui/rhf-form/RhfSubmitButton";
import { RhfTextField } from "@repo/ui-mui/rhf-form/RhfTextField";
import { useRhfForm } from "@repo/ui-mui/rhf-form/useRhfForm";
import { type UserCreateInput, userCreateInputZod } from "@repo/zod-schemas/user.zod";
import { trpc, trpcFetch } from "@frontend/utils/trpc.client";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { useNavigate } from "react-router";

type RegisterFormData = UserCreateInput;

const RegisterPage = () => {
	const navigate = useNavigate();

	// Guest loader already fetched this once; keep runtime resilient if cache is cold.
	const { data: sessionInfo, isPending: isLoadingSession } = useQuery({
		...trpc.auth.getSessionInfo.queryOptions(),
		retry: false,
	});

	// Form setup with Zod validation and RHF
	const { formMethods, RhfFormProvider } = useRhfForm<RegisterFormData>({
		onSubmit: async (data) => {
			await trpcFetch.users.create.mutate(data);
			navigate("/dashboard", { replace: true });
		},
		formConfig: {
			resolver: zodResolver(userCreateInputZod),
		},
	});

	// Pre-fill form with session data
	useEffect(() => {
		if (sessionInfo?.user) {
			formMethods.setValue("email", sessionInfo.user.email);
			formMethods.setValue("name", sessionInfo.user.name || "");
			formMethods.setValue("displayPicture", sessionInfo.user.displayPicture || null);
		}
	}, [sessionInfo, formMethods]);

	// Redirect if session state makes this page invalid
	useEffect(() => {
		if (!sessionInfo) {
			return;
		}

		if (sessionInfo.isRegistered) {
			navigate("/dashboard", { replace: true });
			return;
		}

		if (!sessionInfo.hasSession) {
			navigate("/auth/login", { replace: true });
		}
	}, [sessionInfo, navigate]);

	if (isLoadingSession) {
		return (
			<Box
				sx={{
					display: "flex",
					justifyContent: "center",
					alignItems: "center",
					minHeight: "100vh",
				}}
			>
				<CircularProgress />
			</Box>
		);
	}

	return (
		<Box
			sx={{
				minHeight: "100vh",
				bgcolor: "background.default",
				py: { xs: 4, md: 8 },
			}}
		>
			<Container maxWidth="sm">
				<Fade in timeout={400}>
					<Card
						sx={{
							p: { xs: 3, md: 4 },
							borderRadius: 2,
							boxShadow: "0 4px 24px rgba(0,0,0,0.08)",
							border: "1px solid",
							borderColor: "divider",
						}}
					>
						<Stack spacing={3} alignItems="center">
							{/* Profile Picture */}
							{sessionInfo?.user?.displayPicture && (
								<Avatar
									src={sessionInfo.user.displayPicture}
									alt={sessionInfo.user.name || undefined}
									sx={{
										width: 80,
										height: 80,
										border: "4px solid",
										borderColor: "primary.main",
										boxShadow: 2,
									}}
								/>
							)}

							{/* Header */}
							<Box textAlign="center">
								<Typography variant="h4" fontWeight={600} gutterBottom>
									Complete seu cadastro
								</Typography>
								<Typography variant="body1" color="text.secondary">
									Faltam só alguns detalhes para começar
								</Typography>
								{sessionInfo?.user?.email && (
									<Typography variant="body2" color="text.secondary">
										Entrando como {sessionInfo.user.email}
									</Typography>
								)}
							</Box>

							{/* Form */}
							<RhfFormProvider>
								<Stack spacing={3} sx={{ width: "100%" }}>
									{/* Hidden displayPicture field */}
									<input type="hidden" {...formMethods.register("displayPicture")} />

									{/* Email Field (pre-filled, readonly) */}
									<RhfTextField
										name="email"
										label="E-mail"
										type="email"
										helperText="Preenchido com a sua conta"
										InputProps={{
											readOnly: true,
										}}
										sx={{
											mb: 0,
											"& .MuiOutlinedInput-root": {
												bgcolor: "action.hover",
											},
										}}
									/>

									{/* Name Field (pre-filled, editable) */}
									<RhfTextField
										name="name"
										label="Nome completo"
										helperText="Pode editar se quiser"
										autoFocus
										sx={{
											mb: 0,
											"& .MuiOutlinedInput-root": {
												"&.Mui-focused": {
													"& fieldset": {
														borderWidth: 2,
														borderColor: "primary.main",
													},
												},
											},
										}}
									/>

									{/* Submit Button */}
									<RhfSubmitButton
										notSubmittingText="Concluir cadastro"
										isSubmittingText="Criando conta..."
										props={{
											variant: "contained",
											fullWidth: true,
											size: "large",
										}}
									/>
								</Stack>
							</RhfFormProvider>

							{/* Terms */}
							<Typography
								variant="caption"
								color="text.secondary"
								textAlign="center"
								sx={{ mt: 2 }}
							>
								Ao concluir o cadastro, você concorda com os nossos Termos de Serviço e a
								Política de Privacidade.
							</Typography>
						</Stack>
					</Card>
				</Fade>
			</Container>
		</Box>
	);
};

export default RegisterPage;
