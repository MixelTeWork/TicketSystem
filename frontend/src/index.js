import "./index.css";
import React, { Suspense } from "react"
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom"
import { Provider } from "react-redux"
import store from "./store";
import Preloader from "./components/Preloader";

const root = ReactDOM.createRoot(document.getElementById("root"));

const Application = React.lazy(() => import("./App"))

root.render(
	<React.StrictMode>
		<Suspense fallback={<Preloader />}>
			<Provider store={store}>
				<BrowserRouter>
					<Application />
				</BrowserRouter>
			</Provider>
		</Suspense>
	</React.StrictMode>
);

