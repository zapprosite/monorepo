import { guestLoader } from "@frontend/utils/auth.loader";
import { LoginPage } from "@frontend/modules/auth/pages/Login.page";
import { lazy } from "react";
import { Navigate, Route, Routes } from "react-router";

const RegisterPage = lazy(() => import("@frontend/modules/auth/pages/Register.page"));

const AuthRouter = () => {
	return (
		<Routes>
			<Route path="/" loader={guestLoader}>
				<Route index element={<Navigate to="/auth/login" replace />} />
				<Route path="login" element={<LoginPage />} />
				<Route path="register" element={<RegisterPage />} />
			</Route>
		</Routes>
	);
};

export default AuthRouter;
