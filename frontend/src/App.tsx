import { Route, Routes } from "react-router-dom";

import ScrollToTop from "./utils/scrollToTop";
import NotFoundPage from "./pages/NotFoundPage";


export default function App()
{
	return <div className="root">
		<ScrollToTop />
		<Routes>
			<Route path="*" element={<NotFoundPage />} />
		</Routes>
	</div>
}
