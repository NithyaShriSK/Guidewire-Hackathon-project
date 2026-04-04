import React from 'react';
import { CogIcon } from '@heroicons/react/24/outline';

const AdminSettings = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-600">Manage system settings and configurations</p>
      </div>

      <div className="card">
        <div className="card-content">
          <div className="text-center py-8">
            <CogIcon className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">Settings</h3>
            <p className="mt-1 text-sm text-gray-500">
              Settings management features coming soon.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminSettings;
