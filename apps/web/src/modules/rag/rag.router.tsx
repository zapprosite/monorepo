import { lazy } from "react";
import { Route, Routes } from "react-router";

const RagSearchPage = lazy(() => import("../pages/RagSearch.page"));

export const RagRouter = () => {
	return (
		<Routes>
			<Route path="/" element={<RagSearchPage />} />
		</Routes>
	);
};

export default RagRouter;