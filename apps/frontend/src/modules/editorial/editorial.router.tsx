import EditorialPage from "@frontend/modules/editorial/pages/Editorial.page";
import CreateEditorialPage from "@frontend/modules/editorial/pages/CreateEditorial.page";
import EditorialDetailPage from "@frontend/modules/editorial/pages/EditorialDetail.page";
import { Route, Routes } from "react-router";

export const EditorialRouter = () => {
	return (
		<Routes>
			<Route path="/" element={<EditorialPage />} />
			<Route path="/new" element={<CreateEditorialPage />} />
			<Route path="/:editorialId" element={<EditorialDetailPage />} />
		</Routes>
	);
};

export default EditorialRouter;
