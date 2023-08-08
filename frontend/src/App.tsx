import { Route, Routes } from "react-router-dom";
import { ReactQueryDevtools } from "react-query/devtools";

import ScrollToTop from "./utils/scrollToTop";
import NotFoundPage from "./pages/NotFoundPage";
import AuthPage from "./pages/AuthPage";
import IndexPage from "./pages/IndexPage";


export default function App()
{
	return <div className="root">
		<ScrollToTop />
		<Routes>
			<Route path="/" element={<IndexPage />} />
			<Route path="/auth" element={<AuthPage />} />
			<Route path="*" element={<NotFoundPage />} />
		</Routes>
		{/* <ReactQueryDevtools initialIsOpen={false} /> */}
	</div>
}
