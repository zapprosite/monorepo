import CreateBoardPage from "@frontend/modules/kanban/pages/CreateBoard.page";
import KanbanBoardPage from "@frontend/modules/kanban/pages/KanbanBoard.page";
import KanbanBoardsPage from "@frontend/modules/kanban/pages/KanbanBoards.page";
import { Route, Routes } from "react-router";

export const KanbanRouter = () => {
	return (
		<Routes>
			<Route path="/" element={<KanbanBoardsPage />} />
			<Route path="/new" element={<CreateBoardPage />} />
			<Route path="/:boardId" element={<KanbanBoardPage />} />
		</Routes>
	);
};

export default KanbanRouter;
