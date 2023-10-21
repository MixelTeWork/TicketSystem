import { Navigate, Route, Routes } from "react-router-dom";
import useUser from "./api/user";
import hasPermission, { Operation } from "./api/operations";
import Preloader from "./components/Preloader";
import ScrollToTop from "./utils/scrollToTop";

import NotFoundPage from "./pages/NotFoundPage";
import NoPermissionPage from "./pages/NoPermissionPage";
import AuthPage from "./pages/AuthPage";
import IndexPage from "./pages/IndexPage";
import ScannerPage from "./pages/ScannerPage";
import EventsPage from "./pages/EventsPage";
import StaffPage from "./pages/StaffPage";
import EventPage from "./pages/EventPage";
import TicketsPage from "./pages/TicketsPage";
import PrintTicketsPage from "./pages/PrintTicketsPage";
import DebugPage from "./pages/DebugPage";
import UsersPage from "./pages/UsersPage";
import displayError from "./utils/displayError";
import ProfilePage from "./pages/ProfilePage";


export default function App()
{
	const user = useUser();

	function ProtectedRoute(permission: Operation | null, path: string, element: JSX.Element)
	{
		return <Route path={path} element={
			!user.data?.auth ? <Navigate to="/auth" /> : (
				permission == null || hasPermission(user, permission) ? element : <NoPermissionPage />
			)
		} />
	}

	return <div className="root">
		<ScrollToTop />

		{user.isLoading && <Preloader />}
		{displayError(user)}
		{user.isSuccess &&
			<Routes>
				<Route path="/auth" element={!user.data?.auth ? <AuthPage /> : <Navigate to="/" />} />
				<Route path="/scanner/:eventId" element={<ScannerPage />} />
				{ProtectedRoute(null, "/", <IndexPage />)}
				{ProtectedRoute(null, "/profile", <ProfilePage />)}
				{ProtectedRoute("page_events", "/events", <EventsPage />)}
				{ProtectedRoute("page_events", "/events/:eventId", <EventPage />)}
				{ProtectedRoute("page_events", "/events/:eventId/tickets", <TicketsPage />)}
				{ProtectedRoute("page_events", "/events/:eventId/print_tickets", <PrintTicketsPage />)}
				{ProtectedRoute("page_staff", "/staff", <StaffPage />)}
				{ProtectedRoute("page_debug", "/debug", <DebugPage />)}
				{ProtectedRoute("page_users", "/users", <UsersPage />)}
				{ProtectedRoute(null, "*", <NotFoundPage />)}
			</Routes>
		}
	</div>
}
