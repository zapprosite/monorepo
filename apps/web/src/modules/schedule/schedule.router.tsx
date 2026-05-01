import CreateSchedulePage from "@frontend/modules/schedule/pages/CreateSchedule.page";
import SchedulePage from "@frontend/modules/schedule/pages/Schedule.page";
import ScheduleDetailPage from "@frontend/modules/schedule/pages/ScheduleDetail.page";
import { Route, Routes } from "react-router";

export const ScheduleRouter = () => {
	return (
		<Routes>
			<Route path="/" element={<SchedulePage />} />
			<Route path="/new" element={<CreateSchedulePage />} />
			<Route path="/:scheduleId" element={<ScheduleDetailPage />} />
		</Routes>
	);
};

export default ScheduleRouter;
