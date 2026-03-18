import CreateServiceOrderPage from "@frontend/modules/service-orders/pages/CreateServiceOrder.page";
import ServiceOrderDetailPage from "@frontend/modules/service-orders/pages/ServiceOrderDetail.page";
import ServiceOrdersPage from "@frontend/modules/service-orders/pages/ServiceOrders.page";
import { Route, Routes } from "react-router";

export const ServiceOrdersRouter = () => {
	return (
		<Routes>
			<Route path="/" element={<ServiceOrdersPage />} />
			<Route path="/new" element={<CreateServiceOrderPage />} />
			<Route path="/:serviceOrderId" element={<ServiceOrderDetailPage />} />
		</Routes>
	);
};

export default ServiceOrdersRouter;
