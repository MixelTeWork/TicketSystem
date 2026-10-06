import "./index.css";
import React, { Suspense } from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import Preloader from "./components/Preloader";
import { ApiError } from "./api/dataTypes";

const root = ReactDOM.createRoot(document.getElementById("root") as HTMLElement);

const Application = React.lazy(() => import("./App"));

const queryClient = new QueryClient({ defaultOptions: { queries: {
	staleTime: Infinity,
	gcTime: Infinity,
	retry: (failureCount, error) => failureCount < 1 && !(error instanceof ApiError && error.status != null && error.status < 500),
	retryDelay: 1000,
} } });

root.render(
	<React.StrictMode>
		<Suspense fallback={<Preloader />}>
			<QueryClientProvider client={queryClient}>
				<BrowserRouter>
					<Application />
				</BrowserRouter>
				<ReactQueryDevtools initialIsOpen={false} />
			</QueryClientProvider>
		</Suspense>
	</React.StrictMode>,
);
