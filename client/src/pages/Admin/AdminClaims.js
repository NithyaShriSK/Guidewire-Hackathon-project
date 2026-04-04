import React from 'react';
import { ExclamationTriangleIcon } from '@heroicons/react/24/outline';

const AdminClaims = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Claims Management</h1>
        <p className="text-gray-600">Review and process insurance claims</p>
      </div>

      <div className="card">
        <div className="card-content">
          <div className="text-center py-8">
            <ExclamationTriangleIcon className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">Claims Management</h3>
            <p className="mt-1 text-sm text-gray-500">
              Claims management features coming soon.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminClaims;
