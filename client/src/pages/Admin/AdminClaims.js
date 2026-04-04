import React, { useEffect, useState } from 'react';
import { claimAPI } from '../../services/api';
import toast from 'react-hot-toast';

const AdminClaims = () => {
  const [claims, setClaims] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchClaims = async () => {
      try {
        const response = await claimAPI.getAllClaims({ limit: 20 });
        setClaims(response.data.data.claims || []);
      } catch (error) {
        toast.error('Failed to load claims');
      } finally {
        setLoading(false);
      }
    };

    fetchClaims();
  }, []);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="overflow-hidden rounded-3xl bg-gradient-to-r from-primary-800 via-primary-700 to-success-600 p-6 text-white shadow-[0_24px_50px_-30px_rgba(20,71,177,0.95)]">
        <h1 className="text-2xl font-bold">Claims Management</h1>
        <p className="mt-2 max-w-3xl text-primary-50/90">
          Review recent automated claims, payout progress, and claim status from the admin panel.
        </p>
      </div>

      <div className="card">
        <div className="card-header">
          <h2 className="text-lg font-semibold text-gray-900">Recent Claims</h2>
        </div>
        <div className="card-content">
          {claims.length === 0 ? (
            <p className="text-sm text-gray-500">No claims have been created yet.</p>
          ) : (
            <div className="space-y-3">
              {claims.map((claim) => (
                <div key={claim._id} className="flex items-center justify-between rounded-2xl border border-gray-200 bg-white p-4">
                  <div>
                    <p className="font-semibold text-gray-900">{claim.claimNumber || 'Claim'}</p>
                    <p className="mt-1 text-sm text-gray-600">
                      {claim.trigger?.type?.replaceAll('_', ' ') || 'Trigger unavailable'}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-gray-900">Rs {claim.financial?.payoutAmount || 0}</p>
                    <p className="mt-1 text-sm text-gray-600">{claim.status?.current || 'unknown'}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminClaims;
