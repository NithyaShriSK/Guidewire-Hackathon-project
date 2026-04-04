import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';

// Layout Components
import Layout from './components/Layout/Layout';
import AdminLayout from './components/Layout/AdminLayout';

// Page Components
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Policies from './pages/Policies';
import Claims from './pages/Claims';
import Profile from './pages/Profile';
import WeeklyPremium from './pages/WeeklyPremium';

// Admin Pages
import AdminDashboard from './pages/Admin/AdminDashboard';
import AdminWorkers from './pages/Admin/AdminWorkers';
import AdminPolicies from './pages/Admin/AdminPolicies';
import AdminClaims from './pages/Admin/AdminClaims';
import AdminSimulation from './pages/Admin/AdminSimulation';
import AdminSettings from './pages/Admin/AdminSettings';
import AdminGeographic from './pages/Admin/AdminGeographic';

// Auth Components
import ProtectedRoute from './components/Auth/ProtectedRoute';
import AdminRoute from './components/Auth/AdminRoute';

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <Router>
          <div className="min-h-screen bg-gray-50">
            <Toaster
              position="top-right"
              toastOptions={{
                duration: 4000,
                style: {
                  background: '#363636',
                  color: '#fff',
                },
                success: {
                  duration: 3000,
                  iconTheme: {
                    primary: '#22c55e',
                    secondary: '#fff',
                  },
                },
                error: {
                  duration: 5000,
                  iconTheme: {
                    primary: '#ef4444',
                    secondary: '#fff',
                  },
                },
              }}
            />
            
            <Routes>
              {/* Public Routes */}
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              
              {/* Worker Routes */}
              <Route path="/" element={
                <ProtectedRoute>
                  <Layout />
                </ProtectedRoute>
              }>
                <Route index element={<Navigate to="/dashboard" replace />} />
                <Route path="dashboard" element={<Dashboard />} />
                <Route path="policies" element={<Policies />} />
                <Route path="claims" element={<Claims />} />
                <Route path="weekly-premium" element={<WeeklyPremium />} />
                <Route path="profile" element={<Profile />} />
              </Route>
              
              {/* Admin Routes */}
              <Route path="/admin" element={
                <AdminRoute>
                  <AdminLayout />
                </AdminRoute>
              }>
                <Route index element={<Navigate to="/admin/dashboard" replace />} />
                <Route path="dashboard" element={<AdminDashboard />} />
                <Route path="workers" element={<AdminWorkers />} />
                <Route path="policies" element={<AdminPolicies />} />
                <Route path="claims" element={<AdminClaims />} />
                <Route path="simulation" element={<AdminSimulation />} />
                <Route path="geographic" element={<AdminGeographic />} />
                <Route path="settings" element={<AdminSettings />} />
              </Route>
              
              {/* Catch all */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </div>
        </Router>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
