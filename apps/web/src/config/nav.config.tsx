import { BuildIcon } from "@repo/ui-mui/icons/BuildIcon";
import { CalendarTodayIcon } from "@repo/ui-mui/icons/CalendarTodayIcon";
import { DashboardIcon } from "@repo/ui-mui/icons/DashboardIcon";
import { DescriptionIcon } from "@repo/ui-mui/icons/DescriptionIcon";
import { EventNoteIcon } from "@repo/ui-mui/icons/EventNoteIcon";
import { GridViewIcon } from "@repo/ui-mui/icons/GridViewIcon";
import { HomeIcon } from "@repo/ui-mui/icons/HomeIcon";
import { ListIcon } from "@repo/ui-mui/icons/ListIcon";
import { NotificationsIcon } from "@repo/ui-mui/icons/NotificationsIcon";
import { PeopleIcon } from "@repo/ui-mui/icons/PeopleIcon";
import { ViewKanbanIcon } from "@repo/ui-mui/icons/ViewKanbanIcon";
import { PostAddIcon } from "@repo/ui-mui/icons/PostAddIcon";
import { SettingsIcon } from "@repo/ui-mui/icons/SettingsIcon";
import { TrendingUpIcon } from "@repo/ui-mui/icons/TrendingUpIcon";

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
		label: "Kanban",
		path: "/kanban",
		desktopIcon: <ViewKanbanIcon fontSize="small" />,
		mobileIcon: <ViewKanbanIcon />,
	},
	{
		label: "Lembretes",
		path: "/reminders",
		desktopIcon: <NotificationsIcon fontSize="small" />,
		mobileIcon: <NotificationsIcon />,
	},
	{
		label: "Configurações",
		path: "/settings",
		desktopIcon: <SettingsIcon fontSize="small" />,
		mobileIcon: <SettingsIcon />,
	},
];

/**
 * Get icon for navbar based on platform
 */
export const getNavIcon = (item: NavItem, isMobile: boolean) => {
	return isMobile && item.mobileIcon ? item.mobileIcon : item.desktopIcon;
};
