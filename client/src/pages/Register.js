import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline';
import { useAuth } from '../contexts/AuthContext';

const brandLogo = `${process.env.PUBLIC_URL}/fixmypay-logo.svg`;

const Register = () => {
  const navigate = useNavigate();
  const { register: registerUser, loading } = useAuth();
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm();

  const onSubmit = async (data) => {
    try {
      await registerUser(data);
      navigate('/dashboard');
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
            <h2 className="mt-6 text-3xl font-extrabold text-gray-900">Join FixMyPay</h2>
            <p className="mt-2 text-sm text-gray-600">Protect your income with AI-powered insurance</p>
          </div>

          <form className="brand-shell space-y-6 px-6 py-7" onSubmit={handleSubmit(onSubmit)}>
            <div className="space-y-4">
              <div>
                <label htmlFor="firstName" className="block text-sm font-medium text-gray-700">
                  First Name
                </label>
                <input
                  {...register('personalInfo.firstName', { required: 'First name is required' })}
                  type="text"
                  className={`mt-1 block w-full rounded-xl border px-3 py-2 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-primary-500 sm:text-sm ${
                    errors.personalInfo?.firstName ? 'border-red-300' : 'border-gray-300'
                  }`}
                  placeholder="Enter your first name"
                />
                {errors.personalInfo?.firstName && (
                  <p className="mt-1 text-sm text-red-600">{errors.personalInfo.firstName.message}</p>
                )}
              </div>

              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                  Email address
                </label>
                <input
                  {...register('personalInfo.email', {
                    required: 'Email is required',
                    pattern: {
                      value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                      message: 'Invalid email address',
                    },
                  })}
                  type="email"
                  className={`mt-1 block w-full rounded-xl border px-3 py-2 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-primary-500 sm:text-sm ${
                    errors.personalInfo?.email ? 'border-red-300' : 'border-gray-300'
                  }`}
                  placeholder="Enter your email"
                />
                {errors.personalInfo?.email && (
                  <p className="mt-1 text-sm text-red-600">{errors.personalInfo.email.message}</p>
                )}
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                  Password
                </label>
                <div className="relative mt-1">
                  <input
                    {...register('security.password', {
                      required: 'Password is required',
                      minLength: {
                        value: 8,
                        message: 'Password must be at least 8 characters',
                      },
                    })}
                    type={showPassword ? 'text' : 'password'}
                    className={`block w-full rounded-xl border px-3 py-2 pr-10 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-primary-500 sm:text-sm ${
                      errors.security?.password ? 'border-red-300' : 'border-gray-300'
                    }`}
                    placeholder="Create a password"
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
                {errors.security?.password && (
                  <p className="mt-1 text-sm text-red-600">{errors.security.password.message}</p>
                )}
              </div>
            </div>

            <button type="submit" disabled={loading} className="btn-primary w-full">
              {loading ? 'Creating account...' : 'Create Account'}
            </button>

            <div className="text-center">
              <span className="text-sm text-gray-600">
                Already have an account?{' '}
                <Link to="/login" className="font-medium text-primary-700 hover:text-primary-600">
                  Sign in
                </Link>
              </span>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Register;
