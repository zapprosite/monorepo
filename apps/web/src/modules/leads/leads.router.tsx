import CreateLeadPage from "@frontend/modules/leads/pages/CreateLead.page";
import LeadDetailPage from "@frontend/modules/leads/pages/LeadDetail.page";
import LeadsPage from "@frontend/modules/leads/pages/Leads.page";
import { Route, Routes } from "react-router";

export const LeadsRouter = () => {
	return (
		<Routes>
			<Route path="/" element={<LeadsPage />} />
			<Route path="/new" element={<CreateLeadPage />} />
			<Route path="/:leadId" element={<LeadDetailPage />} />
		</Routes>
	);
};

export default LeadsRouter;
