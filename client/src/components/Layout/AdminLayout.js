import React, { useState } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import {
  ChartBarIcon,
  UsersIcon,
  ExclamationTriangleIcon,
  PlayIcon,
  ShieldCheckIcon,
  ArrowRightOnRectangleIcon,
  Bars3Icon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';

const brandLogo = `${process.env.PUBLIC_URL}/fixmypay-logo.png`;

const AdminLayout = () => {
  const { user, logout } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  const navigation = [
    { name: 'Dashboard', href: '/admin/dashboard', icon: ChartBarIcon },
    { name: 'Workers', href: '/admin/workers', icon: UsersIcon },
    { name: 'Policy & Terms', href: '/admin/policies', icon: ShieldCheckIcon },
    { name: 'Claims', href: '/admin/claims', icon: ExclamationTriangleIcon },
    { name: 'Simulation', href: '/admin/simulation', icon: PlayIcon },
  ];

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-transparent">
      <div className={`fixed inset-0 z-50 lg:hidden ${sidebarOpen ? 'block' : 'hidden'}`}>
        <div className="fixed inset-0 bg-slate-900/45" onClick={() => setSidebarOpen(false)} />
        <div className="fixed inset-y-0 left-0 flex w-72 flex-col bg-white/95 backdrop-blur">
          <div className="flex items-center justify-between border-b border-white/70 px-4 py-4">
            <img src={brandLogo} alt="FixMyPay Admin" className="h-16 w-auto" />
            <button
              onClick={() => setSidebarOpen(false)}
              className="rounded-md p-2 text-gray-400 hover:bg-primary-50 hover:text-primary-700"
            >
              <XMarkIcon className="h-6 w-6" />
            </button>
          </div>
          <nav className="flex-1 space-y-1 px-3 py-4">
            {navigation.map((item) => {
              const isActive = location.pathname === item.href;

              return (
                <Link
                  key={item.name}
                  to={item.href}
                  className={`group flex items-center rounded-2xl px-3 py-2.5 text-sm font-medium transition ${
                    isActive
                      ? 'bg-primary-50 text-primary-900 shadow-sm ring-1 ring-primary-100'
                      : 'text-gray-600 hover:bg-primary-50 hover:text-primary-900'
                  }`}
                >
                  <item.icon
                    className={`mr-3 h-5 w-5 ${
                      isActive ? 'text-primary-600' : 'text-gray-400 group-hover:text-primary-600'
                    }`}
                  />
                  {item.name}
                </Link>
              );
            })}
          </nav>
          <div className="border-t border-white/70 p-4">
            <div className="mb-4 flex items-center">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-100">
                <span className="text-sm font-medium text-primary-700">
                  {user?.personalInfo?.firstName?.[0] || 'A'}
                </span>
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-900">
                  {user?.personalInfo?.firstName} {user?.personalInfo?.lastName}
                </p>
                <p className="text-xs text-gray-500">{user?.personalInfo?.email}</p>
                <p className="text-xs font-medium text-success-700">Administrator</p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="flex w-full items-center rounded-2xl px-3 py-2.5 text-sm font-medium text-gray-600 hover:bg-primary-50 hover:text-primary-900"
            >
              <ArrowRightOnRectangleIcon className="mr-3 h-5 w-5 text-gray-400" />
              Logout
            </button>
          </div>
        </div>
      </div>

      <div className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-72 lg:flex-col">
        <div className="flex grow flex-col overflow-y-auto border-r border-white/70 bg-white/95 pt-5 pb-4 backdrop-blur">
          <div className="px-4">
            <img src={brandLogo} alt="FixMyPay Admin" className="h-20 w-auto" />
          </div>
          <nav className="mt-8 flex-1 space-y-1 px-3">
            {navigation.map((item) => {
              const isActive = location.pathname === item.href;

              return (
                <Link
                  key={item.name}
                  to={item.href}
                  className={`group flex items-center rounded-2xl px-3 py-2.5 text-sm font-medium transition ${
                    isActive
                      ? 'bg-primary-50 text-primary-900 shadow-sm ring-1 ring-primary-100'
                      : 'text-gray-600 hover:bg-primary-50 hover:text-primary-900'
                  }`}
                >
                  <item.icon
                    className={`mr-3 h-5 w-5 ${
                      isActive ? 'text-primary-600' : 'text-gray-400 group-hover:text-primary-600'
                    }`}
                  />
                  {item.name}
                </Link>
              );
            })}
          </nav>
          <div className="border-t border-white/70 p-4">
            <div className="mb-4 flex items-center">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-100">
                <span className="text-sm font-medium text-primary-700">
                  {user?.personalInfo?.firstName?.[0] || 'A'}
                </span>
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-900">
                  {user?.personalInfo?.firstName} {user?.personalInfo?.lastName}
                </p>
                <p className="text-xs text-gray-500">{user?.personalInfo?.email}</p>
                <p className="text-xs font-medium text-success-700">Administrator</p>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <button
                onClick={toggleTheme}
                className="flex items-center text-sm text-gray-600 hover:text-primary-900"
              >
                {isDark ? 'Night' : 'Day'} Theme
              </button>
              <button
                onClick={handleLogout}
                className="flex items-center text-sm text-gray-600 hover:text-primary-900"
              >
                <ArrowRightOnRectangleIcon className="mr-1 h-4 w-4" />
                Logout
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="lg:pl-72">
        <div className="lg:hidden">
          <div className="flex h-16 items-center justify-between border-b border-white/70 bg-white/95 px-4 backdrop-blur">
            <button
              onClick={() => setSidebarOpen(true)}
              className="rounded-md p-2 text-gray-400 hover:bg-primary-50 hover:text-primary-700"
            >
              <Bars3Icon className="h-6 w-6" />
            </button>
            <img src={brandLogo} alt="FixMyPay Admin" className="h-14 w-auto" />
            <div className="w-8" />
          </div>
        </div>

        <main className="flex-1">
          <div className="py-6">
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
              <Outlet />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default AdminLayout;
