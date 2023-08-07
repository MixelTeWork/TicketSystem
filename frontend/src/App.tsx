import { Route, Routes } from "react-router-dom";

import ScrollToTop from "./utils/scrollToTop";
import NotFoundPage from "./pages/NotFoundPage";
import AuthPage from "./pages/AuthPage";


export default function App()
{
	return <div className="root">
		<ScrollToTop />
		<Routes>
			<Route path="/auth" element={<AuthPage />} />
			<Route path="*" element={<NotFoundPage />} />
		</Routes>
	</div>
}
