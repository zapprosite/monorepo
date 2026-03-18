import { Typography } from "@connected-repo/ui-mui/data-display/Typography";
import { Button } from "@connected-repo/ui-mui/form/Button";
import { Box } from "@connected-repo/ui-mui/layout/Box";
import { AppBar } from "@connected-repo/ui-mui/navigation/AppBar";
import { Toolbar } from "@connected-repo/ui-mui/navigation/Toolbar";
import { navItems } from "@frontend/config/nav.config";
import { useLocation, useNavigate } from "react-router";
import { UserProfileMenu } from "./UserProfileMenu";

/**
 * DesktopNavbar - Top navigation bar for desktop layout
 *
 * Features:
 * - App logo/brand
 * - Navigation links (Dashboard, Posts, Create Post)
 * - User profile menu on right
 * - Sticky position
 */
export const DesktopNavbar = () => {
	const navigate = useNavigate();
	const location = useLocation();

	const isActive = (path: string) => location.pathname === path;

	return (
		<AppBar
			position="sticky"
			elevation={0}
			sx={{
				bgcolor: "#0B1F3A",  // Navy 900 — Refrimix
				borderBottom: "1px solid rgba(255,255,255,0.08)",
			}}
		>
			<Toolbar sx={{ gap: 2 }}>
				{/* Logo/Brand — Refrimix Tecnologia */}
				<Box
					onClick={() => navigate("/dashboard")}
					sx={{
						display: "flex",
						alignItems: "center",
						cursor: "pointer",
						mr: 4,
						transition: "opacity 0.2s ease-in-out",
						"&:hover": { opacity: 0.85 },
					}}
				>
					<Box>
						<Typography
							variant="subtitle1"
							component="div"
							sx={{
								fontWeight: 700,
								color: "#ffffff",
								letterSpacing: -0.3,
								lineHeight: 1.2,
							}}
						>
							Refrimix Tecnologia
						</Typography>
						<Typography
							variant="caption"
							sx={{
								color: "#06B6D4",  // Ciano
								fontWeight: 500,
								letterSpacing: 0.3,
								fontSize: "0.65rem",
							}}
						>
							CRM Operacional
						</Typography>
					</Box>
				</Box>

				{/* Navigation Links */}
				<Box sx={{ flexGrow: 1, display: "flex", gap: 0.5 }}>
					{navItems.map((item) => (
						<Button
							key={item.path}
							onClick={() => navigate(item.path)}
							startIcon={item.desktopIcon}
							sx={{
								px: 2,
								py: 1,
								borderRadius: 1.5,
								color: isActive(item.path)
									? "#ffffff"
									: "rgba(255,255,255,0.65)",
								bgcolor: isActive(item.path)
									? "rgba(29,78,216,0.5)"  // Azul institucional semi-transparente
									: "transparent",
								fontWeight: isActive(item.path) ? 600 : 400,
								fontSize: "0.875rem",
								transition: "all 0.2s ease-in-out",
								"& .MuiSvgIcon-root": {
									color: isActive(item.path)
										? "#06B6D4"
										: "rgba(255,255,255,0.5)",
								},
								"&:hover": {
									bgcolor: "rgba(255,255,255,0.08)",
									color: "#ffffff",
								},
							}}
						>
							{item.label}
						</Button>
					))}
				</Box>

				{/* User Profile Menu */}
				<UserProfileMenu />
			</Toolbar>
		</AppBar>
	);
};
