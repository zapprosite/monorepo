import { BuildIcon } from "@connected-repo/ui-mui/icons/BuildIcon";
import { EventNoteIcon } from "@connected-repo/ui-mui/icons/EventNoteIcon";
import { CalendarTodayIcon } from "@connected-repo/ui-mui/icons/CalendarTodayIcon";
import { DashboardIcon } from "@connected-repo/ui-mui/icons/DashboardIcon";
import { DescriptionIcon } from "@connected-repo/ui-mui/icons/DescriptionIcon";
import { GridViewIcon } from "@connected-repo/ui-mui/icons/GridViewIcon";
import { HomeIcon } from "@connected-repo/ui-mui/icons/HomeIcon";
import { ListIcon } from "@connected-repo/ui-mui/icons/ListIcon";
import { PeopleIcon } from "@connected-repo/ui-mui/icons/PeopleIcon";
import { PostAddIcon } from "@connected-repo/ui-mui/icons/PostAddIcon";
import { NotificationsIcon } from "@connected-repo/ui-mui/icons/NotificationsIcon";
import { TrendingUpIcon } from "@connected-repo/ui-mui/icons/TrendingUpIcon";

export interface NavItem {
	/** Display label for the nav item */
	label: string;
	/** Route path */
	path: string;
	/** Icon for desktop navbar */
	desktopIcon: React.ReactNode;
	/** Icon for mobile navbar (optional, defaults to desktopIcon) */
	mobileIcon?: React.ReactNode;
}

/**
 * Main navigation items for the application
 * Used by both DesktopNavbar and MobileNavbar
 */
export const navItems: NavItem[] = [
	{
		label: "Dashboard",
		path: "/dashboard",
		desktopIcon: <DashboardIcon fontSize="small" />,
		mobileIcon: <HomeIcon />, // Different icon for mobile
	},
	{
		label: "Journal Entries",
		path: "/journal-entries",
		desktopIcon: <ListIcon fontSize="small" />,
		mobileIcon: <ListIcon />,
	},
	{
		label: "New Entry",
		path: "/journal-entries/new",
		desktopIcon: <PostAddIcon fontSize="small" />,
		mobileIcon: <PostAddIcon />,
	},
	{
		label: "Leads",
		path: "/leads",
		desktopIcon: <TrendingUpIcon fontSize="small" />,
		mobileIcon: <TrendingUpIcon />,
	},
	{
		label: "Clientes",
		path: "/clients",
		desktopIcon: <PeopleIcon fontSize="small" />,
		mobileIcon: <PeopleIcon />,
	},
	{
		label: "Equipamentos",
		path: "/equipment",
		desktopIcon: <BuildIcon fontSize="small" />,
		mobileIcon: <BuildIcon />,
	},
	{
		label: "Agenda",
		path: "/schedule",
		desktopIcon: <CalendarTodayIcon fontSize="small" />,
		mobileIcon: <CalendarTodayIcon />,
	},
	{
		label: "Ordens de Serviço",
		path: "/service-orders",
		desktopIcon: <GridViewIcon fontSize="small" />,
		mobileIcon: <GridViewIcon />,
	},
	{
		label: "Contratos",
		path: "/contracts",
		desktopIcon: <DescriptionIcon fontSize="small" />,
		mobileIcon: <DescriptionIcon />,
	},
	{
		label: "Calendário Editorial",
		path: "/editorial",
		desktopIcon: <EventNoteIcon fontSize="small" />,
		mobileIcon: <EventNoteIcon />,
	},
	{
		label: "Lembretes",
		path: "/reminders",
		desktopIcon: <NotificationsIcon fontSize="small" />,
		mobileIcon: <NotificationsIcon />,
	},
];

/**
 * Get icon for navbar based on platform
 */
export const getNavIcon = (item: NavItem, isMobile: boolean) => {
	return isMobile && item.mobileIcon ? item.mobileIcon : item.desktopIcon;
};
