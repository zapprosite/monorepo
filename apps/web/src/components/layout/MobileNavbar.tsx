import { Typography } from "@repo/ui-mui/data-display/Typography";
import { Box } from "@repo/ui-mui/layout/Box";
import { Paper } from "@repo/ui-mui/layout/Paper";
import { AppBar } from "@repo/ui-mui/navigation/AppBar";
import { BottomNavigation } from "@repo/ui-mui/navigation/BottomNavigation";
import { BottomNavigationAction } from "@repo/ui-mui/navigation/BottomNavigationAction";
import { Toolbar } from "@repo/ui-mui/navigation/Toolbar";
import { navItems } from "@frontend/config/nav.config";
import { useLocation, useNavigate } from "react-router";
import { UserProfileMenu } from "./UserProfileMenu";

export const MobileNavbar = () => {
	const navigate = useNavigate();
	const location = useLocation();

	// Map paths to bottom nav indices
	const getBottomNavValue = () => {
		// Check navigation items first
		const navIndex = navItems.findIndex((item) => item.path === location.pathname);
		if (navIndex !== -1) return navIndex;

		// Profile is the last item
		if (location.pathname === "/profile") return navItems.length;

		return 0; // Default to first nav item (Dashboard)
	};

	const handleBottomNavChange = (_event: React.SyntheticEvent, newValue: number) => {
		// If profile is clicked (last item), navigate to profile
		if (newValue === navItems.length) {
			navigate("/profile");
			return;
		}

		// Navigate to the selected nav item
		const item = navItems[newValue];
		if (item) {
			navigate(item.path);
		}
	};

	return (
		<>
			{/* Top AppBar — Refrimix navy */}
			<AppBar
				position="sticky"
				elevation={0}
				sx={{
					bgcolor: "#0B1F3A",
					borderBottom: "1px solid rgba(255,255,255,0.08)",
				}}
			>
				<Toolbar
					sx={{
						minHeight: 56,
						px: 2,
						justifyContent: "space-between",
					}}
				>
					{/* Logo */}
					<Box
						onClick={() => navigate("/dashboard")}
						sx={{
							display: "flex",
							alignItems: "center",
							cursor: "pointer",
						}}
					>
						<Box>
							<Typography
								variant="subtitle2"
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
									color: "#06B6D4",
									fontWeight: 500,
									fontSize: "0.6rem",
									letterSpacing: 0.3,
								}}
							>
								CRM Operacional
							</Typography>
						</Box>
					</Box>

					{/* User Avatar - triggers menu */}
					<UserProfileMenu />
				</Toolbar>
			</AppBar>

			{/* Bottom Navigation */}
			<Paper
				sx={{
					position: "fixed",
					bottom: 0,
					left: 0,
					right: 0,
					zIndex: 1000,
					borderTop: "1px solid",
					borderColor: "divider",
				}}
				elevation={3}
			>
				<BottomNavigation
					value={getBottomNavValue()}
					onChange={handleBottomNavChange}
					showLabels
					sx={{
						height: 64,
						"& .MuiBottomNavigationAction-root": {
							minWidth: 60,
							px: 0,
							transition: "all 0.2s ease-in-out",
							"&.Mui-selected": {
								color: "primary.main",
								"& .MuiSvgIcon-root": {
									transform: "scale(1.1)",
								},
							},
							"&:active": {
								transform: "scale(0.95)",
							},
						},
					}}
				>
					{/* Navigation items from config */}
					{navItems.map((item) => (
						<BottomNavigationAction
							key={item.path}
							label={item.label}
							icon={item.mobileIcon || item.desktopIcon}
							sx={{
								"&:hover": {
									bgcolor: "action.hover",
								},
							}}
						/>
					))}
				</BottomNavigation>
			</Paper>
		</>
	);
};
