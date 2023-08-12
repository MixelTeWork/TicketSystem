import "./index.css";
import React, { Suspense } from "react"
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom"
import { QueryClient, QueryClientProvider } from "react-query";
import Preloader from "./components/Preloader";

const root = ReactDOM.createRoot(document.getElementById("root") as HTMLElement);

const Application = React.lazy(() => import("./App"))

const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity, cacheTime: Infinity, retry: 1, retryDelay: 1000 } } });

root.render(
	<React.StrictMode>
		<Suspense fallback={<Preloader />}>
			<QueryClientProvider client={queryClient}>
				<BrowserRouter>
					<Application />
				</BrowserRouter>
			</QueryClientProvider>
		</Suspense>
	</React.StrictMode>
);
