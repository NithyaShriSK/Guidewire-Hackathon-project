import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline';
import { useAuth } from '../contexts/AuthContext';

const brandLogo = `${process.env.PUBLIC_URL}/fixmypay-logo.svg`;

const Login = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, loading } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [userType, setUserType] = useState('worker');

  const from = location.state?.from?.pathname || '/';

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm();

  const onSubmit = async (data) => {
    try {
      await login(data.email, data.password, userType);

      if (userType === 'admin') {
        const target = from && from.startsWith('/admin') ? from : '/admin/dashboard';
        navigate(target, { replace: true });
      } else {
        const target = from && !from.startsWith('/admin') ? from : '/dashboard';
        navigate(target, { replace: true });
      }
    } catch (error) {
      // Error is handled in AuthContext
    }
  };

  return (
    <div className="min-h-screen bg-transparent py-12 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto flex min-h-[calc(100vh-6rem)] max-w-md items-center">
        <div className="w-full space-y-6">
          <div className="brand-shell px-6 py-8 text-center">
            <img src={brandLogo} alt="FixMyPay" className="mx-auto h-14 w-auto" />
            <h2 className="mt-6 text-3xl font-extrabold text-gray-900">Sign in to FixMyPay</h2>
            <p className="mt-2 text-sm text-gray-600">
              Parametric AI income protection for Amazon Flex and the gig economy.
            </p>
            <p className="mt-2 text-xs text-gray-500">
              Defending income. Detecting fraud. Surviving market volatility.
            </p>
          </div>

          <div className="flex rounded-2xl border border-primary-100 bg-white p-1 shadow-sm">
            <button
              type="button"
              onClick={() => setUserType('worker')}
              className={`flex-1 rounded-xl py-2 text-sm font-medium transition ${
                userType === 'worker'
                  ? 'bg-primary-600 text-white shadow-sm'
                  : 'text-gray-500 hover:text-primary-700'
              }`}
            >
              Gig Worker
            </button>
            <button
              type="button"
              onClick={() => setUserType('admin')}
              className={`flex-1 rounded-xl py-2 text-sm font-medium transition ${
                userType === 'admin'
                  ? 'bg-success-600 text-white shadow-sm'
                  : 'text-gray-500 hover:text-primary-700'
              }`}
            >
              Administrator
            </button>
          </div>

          <form className="brand-shell space-y-6 px-6 py-7" onSubmit={handleSubmit(onSubmit)}>
            <div className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                  Email address
                </label>
                <input
                  {...register('email', {
                    required: 'Email is required',
                    pattern: {
                      value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                      message: 'Invalid email address',
                    },
                  })}
                  type="email"
                  autoComplete="email"
                  className={`mt-1 block w-full rounded-xl border px-3 py-2 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-primary-500 sm:text-sm ${
                    errors.email ? 'border-red-300' : 'border-gray-300'
                  }`}
                  placeholder="Enter your email"
                />
                {errors.email && <p className="mt-1 text-sm text-red-600">{errors.email.message}</p>}
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                  Password
                </label>
                <div className="relative mt-1">
                  <input
                    {...register('password', {
                      required: 'Password is required',
                      minLength: {
                        value: 6,
                        message: 'Password must be at least 6 characters',
                      },
                    })}
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    className={`block w-full rounded-xl border px-3 py-2 pr-10 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-primary-500 sm:text-sm ${
                      errors.password ? 'border-red-300' : 'border-gray-300'
                    }`}
                    placeholder="Enter your password"
                  />
                  <button
                    type="button"
                    className="absolute inset-y-0 right-0 flex items-center pr-3"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? (
                      <EyeSlashIcon className="h-5 w-5 text-gray-400" />
                    ) : (
                      <EyeIcon className="h-5 w-5 text-gray-400" />
                    )}
                  </button>
                </div>
                {errors.password && <p className="mt-1 text-sm text-red-600">{errors.password.message}</p>}
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <input
                  id="remember-me"
                  name="remember-me"
                  type="checkbox"
                  className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
                <label htmlFor="remember-me" className="ml-2 block text-sm text-gray-900">
                  Remember me
                </label>
              </div>

              <div className="text-sm">
                <span className="font-medium text-primary-700">Demo access enabled</span>
              </div>
            </div>

            <button type="submit" disabled={loading} className="btn-primary w-full">
              {loading ? (
                <svg className="-ml-1 mr-3 h-5 w-5 animate-spin text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              ) : null}
              {loading ? 'Signing in...' : 'Sign in'}
            </button>

            <div className="text-center">
              <span className="text-sm text-gray-600">
                Don't have an account?{' '}
                <Link to="/register" className="font-medium text-primary-700 hover:text-primary-600">
                  Sign up
                </Link>
              </span>
            </div>
          </form>

          <div className="brand-shell p-4">
            <h3 className="mb-2 text-sm font-medium text-primary-900">Demo Credentials</h3>
            <div className="space-y-1 text-xs text-primary-800">
              <p><strong>Worker:</strong> worker@fixmypay.com / password123</p>
              <p><strong>Admin:</strong> admin@fixmypay.com / admin123</p>
              <p className="pt-2">
                Admin demo mode can auto-create a weekly Amazon Flex protection policy if the selected worker has not been configured yet.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
