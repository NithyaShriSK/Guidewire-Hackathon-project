import React from 'react';
import { useAuth } from '../contexts/AuthContext';

const Profile = () => {
  const { user } = useAuth();

  const profileRows = [
    { label: 'Name', value: `${user?.personalInfo?.firstName || ''} ${user?.personalInfo?.lastName || ''}`.trim() || 'Not available' },
    { label: 'Email', value: user?.personalInfo?.email || 'Not available' },
    { label: 'Phone', value: user?.personalInfo?.phone || 'Not available' },
    { label: 'Account Status', value: user?.status?.accountStatus || 'active' },
    { label: 'Subscription', value: user?.status?.subscriptionStatus || 'inactive' },
    { label: 'Working Region', value: user?.locationTracking?.workingRegion || user?.personalInfo?.address?.city || 'Not available' },
  ];

  return (
    <div className="space-y-6">
      <div className="overflow-hidden rounded-3xl bg-gradient-to-r from-primary-800 via-primary-700 to-success-600 p-6 text-white shadow-[0_24px_50px_-30px_rgba(20,71,177,0.95)]">
        <h1 className="text-2xl font-bold">Worker Profile</h1>
        <p className="mt-2 max-w-3xl text-primary-50/90">
          Review the worker account details currently being used for monitoring, premium eligibility, and payout readiness.
        </p>
      </div>

      <div className="card">
        <div className="card-header">
          <h2 className="text-lg font-semibold text-gray-900">Account Snapshot</h2>
        </div>
        <div className="card-content grid grid-cols-1 gap-4 md:grid-cols-2">
          {profileRows.map((row) => (
            <div key={row.label} className="rounded-2xl border border-gray-200 bg-white p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{row.label}</p>
              <p className="mt-2 text-base font-semibold text-gray-900">{row.value}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Profile;
