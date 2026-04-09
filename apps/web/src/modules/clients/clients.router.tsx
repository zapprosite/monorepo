import ClientDetailPage from "@frontend/modules/clients/pages/ClientDetail.page";
import ClientsPage from "@frontend/modules/clients/pages/Clients.page";
import CreateClientPage from "@frontend/modules/clients/pages/CreateClient.page";
import { Route, Routes } from "react-router";

export const ClientsRouter = () => {
	return (
		<Routes>
			<Route path="/" element={<ClientsPage />} />
			<Route path="/new" element={<CreateClientPage />} />
			<Route path="/:clientId" element={<ClientDetailPage />} />
		</Routes>
	);
};

export default ClientsRouter;
