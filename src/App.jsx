import {
    BrowserRouter,
    Routes,
    Route,
    Navigate,
} from "react-router-dom";

import Login from "./pages/Login";
import Register from "./pages/Register";
import UserDashboard from "./pages/UserDashboard";
import AdminDashboard from "./pages/AdminDashboard";
import ResumeDetails from "./pages/ResumeDetails";

// ==========================================
// USER PROTECTED ROUTE
// ==========================================

function UserRoute({ children }) {
    const token = localStorage.getItem("token");

    let user = null;

    try {
        user = JSON.parse(
            localStorage.getItem("user") || "null"
        );
    } catch (error) {
        console.error("Invalid user data");
        localStorage.removeItem("user");
    }

    if (!token || !user) {
        return <Navigate to="/login" replace />;
    }

    if (user.role !== "user") {
        return <Navigate to="/admin" replace />;
    }

    return children;
}

// ==========================================
// ADMIN PROTECTED ROUTE
// ==========================================

function AdminRoute({ children }) {
    const token = localStorage.getItem("token");

    let user = null;

    try {
        user = JSON.parse(
            localStorage.getItem("user") || "null"
        );
    } catch (error) {
        console.error("Invalid user data");
        localStorage.removeItem("user");
    }

    if (!token || !user) {
        return <Navigate to="/login" replace />;
    }

    if (user.role !== "admin") {
        return <Navigate to="/dashboard" replace />;
    }

    return children;
}

// ==========================================
// APP
// ==========================================

function App() {
    return (
        <BrowserRouter>

            <Routes>

                {/* PUBLIC */}

                <Route
                    path="/"
                    element={
                        <Navigate
                            to="/login"
                            replace
                        />
                    }
                />

                <Route
                    path="/login"
                    element={<Login />}
                />

                <Route
                    path="/register"
                    element={<Register />}
                />


                {/* USER DASHBOARD */}

                <Route
                    path="/dashboard"
                    element={
                        <UserRoute>
                            <UserDashboard />
                        </UserRoute>
                    }
                />


                {/* USER RESUME */}

                <Route
                    path="/resume"
                    element={
                        <UserRoute>
                            <ResumeDetails />
                        </UserRoute>
                    }
                />


                {/* ADMIN DASHBOARD */}

                <Route
                    path="/admin"
                    element={
                        <AdminRoute>
                            <AdminDashboard />
                        </AdminRoute>
                    }
                />


                {/* UNKNOWN ROUTES */}

                <Route
                    path="*"
                    element={
                        <Navigate
                            to="/login"
                            replace
                        />
                    }
                />

            </Routes>

        </BrowserRouter>
    );
}

export default App;