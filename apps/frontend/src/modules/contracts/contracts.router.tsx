import ContractsPage from "@frontend/modules/contracts/pages/Contracts.page";
import CreateContractPage from "@frontend/modules/contracts/pages/CreateContract.page";
import ContractDetailPage from "@frontend/modules/contracts/pages/ContractDetail.page";
import { Route, Routes } from "react-router";

export const ContractsRouter = () => {
	return (
		<Routes>
			<Route path="/" element={<ContractsPage />} />
			<Route path="/new" element={<CreateContractPage />} />
			<Route path="/:contractId" element={<ContractDetailPage />} />
		</Routes>
	);
};

export default ContractsRouter;
