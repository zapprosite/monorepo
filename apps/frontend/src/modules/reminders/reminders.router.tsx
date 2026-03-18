import RemindersPage from "@frontend/modules/reminders/pages/Reminders.page";
import CreateReminderPage from "@frontend/modules/reminders/pages/CreateReminder.page";
import ReminderDetailPage from "@frontend/modules/reminders/pages/ReminderDetail.page";
import { Route, Routes } from "react-router";

export const RemindersRouter = () => {
	return (
		<Routes>
			<Route path="/" element={<RemindersPage />} />
			<Route path="/new" element={<CreateReminderPage />} />
			<Route path="/:reminderId" element={<ReminderDetailPage />} />
		</Routes>
	);
};

export default RemindersRouter;
