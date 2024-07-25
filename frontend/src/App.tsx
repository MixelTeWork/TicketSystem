import { Navigate, Route, Routes } from "react-router-dom";
import useUser from "./api/user";
import hasPermission, { Operation } from "./api/operations";
import Preloader from "./components/Preloader";
import ScrollToTop from "./utils/scrollToTop";
import displayError from "./utils/displayError";
import MessageFromBackend from "./components/MessageFromBackend";

import NotFoundPage from "./pages/NotFoundPage";
import NoPermissionPage from "./pages/NoPermissionPage";
import AuthPage from "./pages/AuthPage";
import IndexPage from "./pages/IndexPage";

import DebugPage from "./pages/DebugPage";
import EventPage from "./pages/EventPage";
import EventsFullPage from "./pages/EventsFullPage";
import EventsPage from "./pages/EventsPage";
import FontsPage from "./pages/FontsPage";
import LogPage from "./pages/LogPage";
import ManagersPage from "./pages/ManagersPage";
import PrintTicketsPage from "./pages/PrintTicketsPage";
import ProfilePage from "./pages/ProfilePage";
import ScannerPage from "./pages/ScannerPage";
import StaffPage from "./pages/StaffPage";
import TicketsPage from "./pages/TicketsPage";
import UsersPage from "./pages/UsersPage";


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
		<MessageFromBackend />

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
				{ProtectedRoute("page_debug", "/d", <DebugPage />)}
				{ProtectedRoute("page_debug", "/d/log", <LogPage />)}
				{ProtectedRoute("page_debug_users", "/d/users", <UsersPage />)}
				{ProtectedRoute("page_debug_events", "/d/events", <EventsFullPage />)}
				{ProtectedRoute("page_fonts", "/fonts", <FontsPage />)}
				{ProtectedRoute("page_managers", "/managers", <ManagersPage />)}
				{ProtectedRoute(null, "*", <NotFoundPage />)}
			</Routes>
		}
	</div>
}
