import type { PaletteMode } from "@mui/material";
import { createTheme } from "@mui/material/styles";
import "./theme.types"; // Import type augmentations

/**
 * Base theme configuration shared across light and dark modes
 */
const baseThemeConfig = {
	typography: {
		fontFamily: [
			"-apple-system",
			"BlinkMacSystemFont",
			'"Segoe UI"',
			"Roboto",
			'"Helvetica Neue"',
			"Arial",
			"sans-serif",
		].join(","),
		h1: {
			fontSize: "2.5rem",
			fontWeight: 500,
		},
		h2: {
			fontSize: "2rem",
			fontWeight: 500,
		},
		h3: {
			fontSize: "1.75rem",
			fontWeight: 500,
		},
		h4: {
			fontSize: "1.5rem",
			fontWeight: 500,
		},
		h5: {
			fontSize: "1.25rem",
			fontWeight: 500,
		},
		h6: {
			fontSize: "1rem",
			fontWeight: 500,
		},
	},
	shape: {
		borderRadius: 5,
	},
	spacing: 8,
	components: {
		MuiButton: {
			styleOverrides: {
				root: {
					textTransform: "none" as const,
					fontWeight: 500,
				},
			},
			defaultProps: {
				disableElevation: true,
			},
		},
		MuiTextField: {
			defaultProps: {
				variant: "outlined" as const,
				size: "small" as const,
			},
		},
		MuiCard: {
			styleOverrides: {
				root: {
					boxShadow: "0 1px 3px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.24)",
				},
			},
		},
		MuiAlert: {
			styleOverrides: {
				root: {
					borderRadius: 5,
				},
			},
		},
	},
};

/**
 * Creates a theme with the specified mode (light or dark)
 * Preserves all component overrides and customizations
 */
export const createAppTheme = (mode: PaletteMode = "light") => {
	return createTheme({
		...baseThemeConfig,
		palette: {
			mode,
			...(mode === "light"
				? {
						// Refrimix Tecnologia — paleta oficial
						primary: {
							main: "#1D4ED8", // Azul institucional Refrimix
							light: "#3B6FE8",
							dark: "#123057", // Navy 800
							lighter: "rgba(29, 78, 216, 0.08)",
						},
						secondary: {
							main: "#6D28D9", // Roxo IA/automação
							light: "#8B5CF6",
							dark: "#4C1D95",
							contrastText: "#fff",
						},
						success: {
							main: "#16A34A", // Verde sucesso Refrimix
							light: "#22C55E",
							dark: "#15803D",
							lighter: "rgba(22, 163, 74, 0.08)",
							contrastText: "#fff",
						},
						error: {
							main: "#DC2626", // Vermelho crítico Refrimix
							light: "#EF4444",
							dark: "#B91C1C",
							lighter: "rgba(220, 38, 38, 0.08)",
							contrastText: "#fff",
						},
						warning: {
							main: "#F59E0B", // Amarelo alerta Refrimix
							light: "#FCD34D",
							dark: "#D97706",
							contrastText: "#000",
						},
						info: {
							main: "#06B6D4", // Ciano tecnológico Refrimix
							light: "#22D3EE",
							dark: "#0891B2",
							contrastText: "#fff",
						},
						background: {
							default: "#F5F7FB", // Fundo claro Refrimix
							paper: "#ffffff",
						},
						text: {
							primary: "#0B1F3A", // Navy 900 para texto principal
							secondary: "#64748B", // Texto secundário Refrimix
							disabled: "#94A3B8",
						},
					}
				: {
						// Dark mode colors
						primary: {
							main: "#4da3ff",
							light: "#80bdff",
							dark: "#007bff",
							lighter: "rgba(77, 163, 255, 0.12)",
						},
						secondary: {
							main: "#868e96",
							light: "#adb5bd",
							dark: "#6c757d",
							contrastText: "#fff",
						},
						success: {
							main: "#48b461",
							light: "#6ec283",
							dark: "#28a745",
							lighter: "rgba(72, 180, 97, 0.12)",
							contrastText: "#fff",
						},
						error: {
							main: "#e35d6a",
							light: "#e97c86",
							dark: "#dc3545",
							lighter: "rgba(227, 93, 106, 0.12)",
							contrastText: "#fff",
						},
						warning: {
							main: "#ffcd38",
							light: "#ffd966",
							dark: "#ffc107",
							contrastText: "#000",
						},
						info: {
							main: "#45b5c6",
							light: "#6dc4d2",
							dark: "#17a2b8",
							contrastText: "#fff",
						},
						background: {
							default: "#121212",
							paper: "#1e1e1e",
						},
						text: {
							primary: "#ffffff",
							secondary: "#b0b0b0",
							disabled: "#666666",
						},
					}),
		},
	});
};

/**
 * Default light theme (for backwards compatibility)
 */
export const theme = createAppTheme("light");
