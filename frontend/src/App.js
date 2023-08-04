import React from "react";
import { Route, Routes } from "react-router-dom";

import ScrollToTop from "./utils/scrollToTop";
import NotFoundPage from "./pages/NotFoundPage";


function App()
{
	return <div className="root">
		<ScrollToTop />
		<Routes>
			<Route path="*" element={<NotFoundPage />} />
		</Routes>
	</div>
}

export default App;