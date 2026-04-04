import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline';
import { useAuth } from '../contexts/AuthContext';

const brandLogo = `${process.env.PUBLIC_URL}/fixmypay-logo.png`;

const Register = () => {
  const navigate = useNavigate();
  const { register: registerUser, loading } = useAuth();
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    defaultValues: {
      personalInfo: {
        address: {
          coordinates: {
            latitude: 13.0827,
            longitude: 80.2707,
          },
        },
      },
      workInfo: {
        preferredZoneName: 'Chennai Central',
        typicalWorkingHours: {
          start: '08:00',
          end: '20:00',
        },
      },
      financialInfo: {
        weeklyIncomeRange: {
          min: 2000,
          max: 5000,
        },
      },
    },
  });

  const onSubmit = async (data) => {
    try {
      const payload = {
        personalInfo: {
          ...data.personalInfo,
          phone: String(data.personalInfo.phone || ''),
          aadhaarNumber: String(data.personalInfo.aadhaarNumber || ''),
          address: {
            ...data.personalInfo.address,
            pincode: String(data.personalInfo.address?.pincode || ''),
            coordinates: {
              latitude: Number(data.personalInfo.address?.coordinates?.latitude),
              longitude: Number(data.personalInfo.address?.coordinates?.longitude),
            },
          },
        },
        security: data.security,
        workInfo: {
          platforms: [{
            name: 'Amazon Flex',
            workerId: data.workInfo.platformWorkerId,
            startDate: new Date().toISOString(),
            averageDailyEarnings: Number(data.workInfo.averageDailyEarnings),
            averageWeeklyHours: Number(data.workInfo.averageWeeklyHours),
          }],
          preferredWorkingZones: [{
            name: data.workInfo.preferredZoneName,
            coordinates: {
              latitude: Number(data.personalInfo.address?.coordinates?.latitude),
              longitude: Number(data.personalInfo.address?.coordinates?.longitude),
              radius: 5,
            },
          }],
          typicalWorkingHours: data.workInfo.typicalWorkingHours,
        },
        financialInfo: {
          upiId: data.financialInfo.upiId,
          bankAccount: {
            ...data.financialInfo.bankAccount,
          },
          weeklyIncomeRange: {
            min: Number(data.financialInfo.weeklyIncomeRange.min),
            max: Number(data.financialInfo.weeklyIncomeRange.max),
          },
        },
      };

      await registerUser(payload);
      navigate('/dashboard');
    } catch (error) {
      // Error is handled in AuthContext
    }
  };

  return (
    <div className="min-h-screen bg-transparent py-12 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl">
        <div className="brand-shell px-6 py-8 text-center">
          <img src={brandLogo} alt="FixMyPay" className="mx-auto h-32 w-auto" />
          <h2 className="mt-6 text-3xl font-extrabold text-gray-900">Join FixMyPay</h2>
          <p className="mt-2 text-sm text-gray-600">
            Register with your real worker, address, and payout details so the admin dashboard shows actual profile data.
          </p>
        </div>

        <form className="brand-shell mt-6 space-y-8 px-6 py-7" onSubmit={handleSubmit(onSubmit)}>
          <Section title="Personal Information">
            <Field label="First Name" error={errors.personalInfo?.firstName?.message}>
              <input
                {...register('personalInfo.firstName', { required: 'First name is required' })}
                type="text"
                className={inputClass(errors.personalInfo?.firstName)}
                placeholder="Enter your first name"
              />
            </Field>
            <Field label="Last Name" error={errors.personalInfo?.lastName?.message}>
              <input
                {...register('personalInfo.lastName', { required: 'Last name is required' })}
                type="text"
                className={inputClass(errors.personalInfo?.lastName)}
                placeholder="Enter your last name"
              />
            </Field>
            <Field label="Email Address" error={errors.personalInfo?.email?.message}>
              <input
                {...register('personalInfo.email', {
                  required: 'Email is required',
                  pattern: {
                    value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                    message: 'Invalid email address',
                  },
                })}
                type="email"
                className={inputClass(errors.personalInfo?.email)}
                placeholder="Enter your email"
              />
            </Field>
            <Field label="Phone Number" error={errors.personalInfo?.phone?.message}>
              <input
                {...register('personalInfo.phone', { required: 'Phone number is required' })}
                type="tel"
                className={inputClass(errors.personalInfo?.phone)}
                placeholder="10-digit mobile number"
              />
            </Field>
            <Field label="Date of Birth" error={errors.personalInfo?.dateOfBirth?.message}>
              <input
                {...register('personalInfo.dateOfBirth', { required: 'Date of birth is required' })}
                type="date"
                className={inputClass(errors.personalInfo?.dateOfBirth)}
              />
            </Field>
            <Field label="Aadhaar Number" error={errors.personalInfo?.aadhaarNumber?.message}>
              <input
                {...register('personalInfo.aadhaarNumber', { required: 'Aadhaar number is required' })}
                type="text"
                className={inputClass(errors.personalInfo?.aadhaarNumber)}
                placeholder="12-digit Aadhaar number"
              />
            </Field>
          </Section>

          <Section title="Address and Location">
            <Field label="Street Address" error={errors.personalInfo?.address?.street?.message}>
              <input
                {...register('personalInfo.address.street', { required: 'Street address is required' })}
                type="text"
                className={inputClass(errors.personalInfo?.address?.street)}
                placeholder="House number and street"
              />
            </Field>
            <Field label="City" error={errors.personalInfo?.address?.city?.message}>
              <input
                {...register('personalInfo.address.city', { required: 'City is required' })}
                type="text"
                className={inputClass(errors.personalInfo?.address?.city)}
                placeholder="City"
              />
            </Field>
            <Field label="State" error={errors.personalInfo?.address?.state?.message}>
              <input
                {...register('personalInfo.address.state', { required: 'State is required' })}
                type="text"
                className={inputClass(errors.personalInfo?.address?.state)}
                placeholder="State"
              />
            </Field>
            <Field label="Pincode" error={errors.personalInfo?.address?.pincode?.message}>
              <input
                {...register('personalInfo.address.pincode', { required: 'Pincode is required' })}
                type="text"
                className={inputClass(errors.personalInfo?.address?.pincode)}
                placeholder="6-digit pincode"
              />
            </Field>
            <Field label="Latitude" error={errors.personalInfo?.address?.coordinates?.latitude?.message}>
              <input
                {...register('personalInfo.address.coordinates.latitude', { required: 'Latitude is required' })}
                type="number"
                step="any"
                className={inputClass(errors.personalInfo?.address?.coordinates?.latitude)}
                placeholder="Latitude"
              />
            </Field>
            <Field label="Longitude" error={errors.personalInfo?.address?.coordinates?.longitude?.message}>
              <input
                {...register('personalInfo.address.coordinates.longitude', { required: 'Longitude is required' })}
                type="number"
                step="any"
                className={inputClass(errors.personalInfo?.address?.coordinates?.longitude)}
                placeholder="Longitude"
              />
            </Field>
          </Section>

          <Section title="Work Profile">
            <Field label="Amazon Flex Worker ID" error={errors.workInfo?.platformWorkerId?.message}>
              <input
                {...register('workInfo.platformWorkerId', { required: 'Platform worker ID is required' })}
                type="text"
                className={inputClass(errors.workInfo?.platformWorkerId)}
                placeholder="Amazon Flex worker ID"
              />
            </Field>
            <Field label="Preferred Working Region" error={errors.workInfo?.preferredZoneName?.message}>
              <input
                {...register('workInfo.preferredZoneName', { required: 'Preferred working region is required' })}
                type="text"
                className={inputClass(errors.workInfo?.preferredZoneName)}
                placeholder="Preferred zone"
              />
            </Field>
            <Field label="Average Daily Earnings" error={errors.workInfo?.averageDailyEarnings?.message}>
              <input
                {...register('workInfo.averageDailyEarnings', { required: 'Average daily earnings are required' })}
                type="number"
                className={inputClass(errors.workInfo?.averageDailyEarnings)}
                placeholder="Daily earnings"
              />
            </Field>
            <Field label="Average Weekly Hours" error={errors.workInfo?.averageWeeklyHours?.message}>
              <input
                {...register('workInfo.averageWeeklyHours', { required: 'Average weekly hours are required' })}
                type="number"
                className={inputClass(errors.workInfo?.averageWeeklyHours)}
                placeholder="Weekly hours"
              />
            </Field>
            <Field label="Working Start Time" error={errors.workInfo?.typicalWorkingHours?.start?.message}>
              <input
                {...register('workInfo.typicalWorkingHours.start', { required: 'Start time is required' })}
                type="time"
                className={inputClass(errors.workInfo?.typicalWorkingHours?.start)}
              />
            </Field>
            <Field label="Working End Time" error={errors.workInfo?.typicalWorkingHours?.end?.message}>
              <input
                {...register('workInfo.typicalWorkingHours.end', { required: 'End time is required' })}
                type="time"
                className={inputClass(errors.workInfo?.typicalWorkingHours?.end)}
              />
            </Field>
          </Section>

          <Section title="Payout and Bank Details">
            <Field label="UPI ID" error={errors.financialInfo?.upiId?.message}>
              <input
                {...register('financialInfo.upiId', { required: 'UPI ID is required' })}
                type="text"
                className={inputClass(errors.financialInfo?.upiId)}
                placeholder="yourupi@bank"
              />
            </Field>
            <Field label="Bank Account Number" error={errors.financialInfo?.bankAccount?.accountNumber?.message}>
              <input
                {...register('financialInfo.bankAccount.accountNumber', { required: 'Bank account number is required' })}
                type="text"
                className={inputClass(errors.financialInfo?.bankAccount?.accountNumber)}
                placeholder="Account number"
              />
            </Field>
            <Field label="IFSC Code" error={errors.financialInfo?.bankAccount?.ifscCode?.message}>
              <input
                {...register('financialInfo.bankAccount.ifscCode', { required: 'IFSC code is required' })}
                type="text"
                className={inputClass(errors.financialInfo?.bankAccount?.ifscCode)}
                placeholder="IFSC code"
              />
            </Field>
            <Field label="Account Holder Name" error={errors.financialInfo?.bankAccount?.accountHolderName?.message}>
              <input
                {...register('financialInfo.bankAccount.accountHolderName', { required: 'Account holder name is required' })}
                type="text"
                className={inputClass(errors.financialInfo?.bankAccount?.accountHolderName)}
                placeholder="Account holder name"
              />
            </Field>
            <Field label="Minimum Weekly Income" error={errors.financialInfo?.weeklyIncomeRange?.min?.message}>
              <input
                {...register('financialInfo.weeklyIncomeRange.min', { required: 'Minimum weekly income is required' })}
                type="number"
                className={inputClass(errors.financialInfo?.weeklyIncomeRange?.min)}
                placeholder="Minimum income"
              />
            </Field>
            <Field label="Maximum Weekly Income" error={errors.financialInfo?.weeklyIncomeRange?.max?.message}>
              <input
                {...register('financialInfo.weeklyIncomeRange.max', { required: 'Maximum weekly income is required' })}
                type="number"
                className={inputClass(errors.financialInfo?.weeklyIncomeRange?.max)}
                placeholder="Maximum income"
              />
            </Field>
          </Section>

          <Section title="Security">
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <Field label="Password" error={errors.security?.password?.message}>
                <div className="relative">
                  <input
                    {...register('security.password', {
                      required: 'Password is required',
                      minLength: {
                        value: 8,
                        message: 'Password must be at least 8 characters',
                      },
                    })}
                    type={showPassword ? 'text' : 'password'}
                    className={`${inputClass(errors.security?.password)} pr-10`}
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
              </Field>
            </div>
          </Section>

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
  );
};

const Section = ({ title, children }) => (
  <div>
    <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
    <div className="mt-4 grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
      {children}
    </div>
  </div>
);

const Field = ({ label, error, children }) => (
  <div>
    <label className="block text-sm font-medium text-gray-700">{label}</label>
    <div className="mt-1">{children}</div>
    {error ? <p className="mt-1 text-sm text-red-600">{error}</p> : null}
  </div>
);

const inputClass = (error) => `block w-full rounded-xl border px-3 py-2 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-primary-500 sm:text-sm ${
  error ? 'border-red-300' : 'border-gray-300'
}`;

export default Register;
