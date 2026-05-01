import CreateEquipmentPage from "@frontend/modules/equipment/pages/CreateEquipment.page";
import EquipmentPage from "@frontend/modules/equipment/pages/Equipment.page";
import EquipmentDetailPage from "@frontend/modules/equipment/pages/EquipmentDetail.page";
import { Route, Routes } from "react-router";

export const EquipmentRouter = () => {
	return (
		<Routes>
			<Route path="/" element={<EquipmentPage />} />
			<Route path="/new" element={<CreateEquipmentPage />} />
			<Route path="/:equipmentId" element={<EquipmentDetailPage />} />
		</Routes>
	);
};

export default EquipmentRouter;
