import "./index.css";
import React, { Suspense } from "react"
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom"
import { QueryClient, QueryClientProvider } from "react-query";
import Preloader from "./components/Preloader";
import { ReactQueryDevtools } from "react-query/devtools";

const root = ReactDOM.createRoot(document.getElementById("root") as HTMLElement);

const Application = React.lazy(() => import("./App"))

const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity, cacheTime: Infinity } } });

root.render(
	<React.StrictMode>
		<Suspense fallback={<Preloader />}>
			<QueryClientProvider client={queryClient}>
				<BrowserRouter>
					<Application />
					<ReactQueryDevtools />
				</BrowserRouter>
			</QueryClientProvider>
		</Suspense>
	</React.StrictMode>
);
