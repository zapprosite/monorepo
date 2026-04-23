import { Button } from "@connected-repo/ui-mui/form/Button";
import { Box } from "@connected-repo/ui-mui/layout/Box";

export const ErrorFallback = () => {
	const handleReload = () => {
		window.location.reload();
	};

	return (
		<Box
			role="alert"
			aria-live="assertive"
			sx={{
				display: "flex",
				flexDirection: "column",
				alignItems: "center",
				justifyContent: "center",
				gap: 2,
				minHeight: "100vh",
				px: 3,
				textAlign: "center",
				bgcolor: "background.default",
				color: "text.primary",
			}}
		>
			<Box component="h1" sx={{ m: 0, fontSize: "1.5rem", fontWeight: 700 }}>
				Algo deu errado
			</Box>
			<Box component="p" sx={{ m: 0, maxWidth: 480, color: "text.secondary" }}>
				Ocorreu um erro inesperado ao carregar esta tela. Tente recarregar a página.
			</Box>
			<Button onClick={handleReload} autoFocus>
				Recarregar página
			</Button>
		</Box>
	);
};
