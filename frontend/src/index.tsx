import "./index.css";
import React, { Suspense } from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import Preloader from "./components/Preloader";
import { createQueryClient } from "./api/queryClient";

const root = ReactDOM.createRoot(document.getElementById("root") as HTMLElement);

const Application = React.lazy(() => import("./App"));

const queryClient = createQueryClient();

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
