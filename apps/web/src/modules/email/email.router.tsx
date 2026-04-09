import { EmailCampaignsPage } from "@frontend/modules/email/pages/EmailCampaigns.page";
import { Route, Routes } from "react-router";

export const EmailRouter = () => {
	return (
		<Routes>
			<Route path="/" element={<EmailCampaignsPage />} />
		</Routes>
	);
};

export default EmailRouter;
