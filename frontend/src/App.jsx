import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";

import Navbar from "./components/Navbar";
import PrivateRoute from "./components/PrivateRoute";

import Home from "./pages/Home";
import Trips from "./pages/Trips";
import Login from "./pages/Login";
import Register from "./pages/Register";
import DriverDashboard from "./pages/DriverDashboard";
import Profile from "./pages/Profile";
import CreateTrip from "./pages/CreateTrip";
import Checkout from "./pages/Checkout";
import MyTrips from "./pages/MyTrips";
import LeaveReview from "./pages/LeaveReview";
import Payouts from "./pages/Payouts";
import Payments from "./pages/Payments";
import EditTrip from "./pages/EditTrip";
import AdminDashboard from "./pages/AdminDashboard"

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Navbar />

        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/trips" element={<Trips />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/createtrip" element={<CreateTrip />} />

          <Route
            path="/checkout/:bookingId"
            element={
              <PrivateRoute>
                <Checkout />
              </PrivateRoute>
            }
          />

          <Route
            path="/driver-dashboard"
            element={
              <PrivateRoute>
                <DriverDashboard />
              </PrivateRoute>
            }
          />
          <Route
            path="/edit-trip/:tripId"
            element={
              <PrivateRoute>
                <EditTrip />
              </PrivateRoute>
            }
          />
          <Route
            path="/admin-dashboard"
            element={
              <PrivateRoute>
                <AdminDashboard />
              </PrivateRoute>
            }
          />
          <Route
             path="/leave-review"
             element={
                <PrivateRoute>
                    <LeaveReview />
                </PrivateRoute>
              }
            />
          <Route
            path="/payments"
            element={
              <PrivateRoute>
                <Payments />
              </PrivateRoute>
            }
          />

          <Route
            path="/profile"
            element={
              <PrivateRoute>
                <Profile />
              </PrivateRoute>
            }
          />
          <Route
            path="/payouts"
            element={
              <PrivateRoute>
                <Payouts />
              </PrivateRoute>
            }
          />
          <Route
            path="/my-trips"
            element={
              <PrivateRoute>
                <MyTrips />
              </PrivateRoute>
            }
          />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;