import React, { useEffect, useState } from 'react';
import { EyeIcon, UsersIcon } from '@heroicons/react/24/outline';
import { adminAPI } from '../../services/api';
import WorkerDetailsModal from '../../components/Admin/WorkerDetailsModal';
import toast from 'react-hot-toast';

const AdminWorkers = () => {
  const [workers, setWorkers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedWorker, setSelectedWorker] = useState(null);

  useEffect(() => {
    fetchWorkers();
  }, []);

  const fetchWorkers = async () => {
    try {
      setLoading(true);
      const response = await adminAPI.getAllWorkers({ limit: 100 });
      setWorkers(response.data.data.workers || []);
    } catch (error) {
      toast.error('Failed to fetch workers');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-slate-900 to-cyan-700 rounded-2xl p-6 text-white">
        <h1 className="text-2xl font-bold">Workers Panel</h1>
        <p className="mt-2 text-cyan-100">
          Clear view of every worker, weekly plan, live location status, and claim eligibility.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <SummaryCard label="Total Workers" value={workers.length} />
        <SummaryCard label="Coverage Active" value={workers.filter((worker) => worker.premium?.currentWeekPaid).length} />
        <SummaryCard label="Monitoring Ready" value={workers.filter((worker) => worker.locationTracking?.isActive).length} />
      </div>

      <div className="card">
        <div className="card-header">
          <h3 className="text-lg font-semibold text-gray-900">Worker Directory</h3>
        </div>
        <div className="card-content">
          {workers.length === 0 ? (
            <div className="text-center py-8">
              <UsersIcon className="mx-auto h-12 w-12 text-gray-400" />
              <p className="mt-3 text-sm text-gray-500">No workers found.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    {['Worker', 'Contact', 'Plan', 'Premium', 'Location', 'Action'].map((header) => (
                      <th key={header} className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {workers.map((worker) => (
                    <tr key={worker._id}>
                      <td className="px-6 py-4">
                        <p className="font-medium text-gray-900">{worker.personalInfo.firstName} {worker.personalInfo.lastName}</p>
                        <p className="text-sm text-gray-500">{worker.status.accountStatus}</p>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        <p>{worker.personalInfo.email}</p>
                        <p>{worker.personalInfo.phone}</p>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        <p>{worker.premium?.planType || 'basic'}</p>
                        <p>Limit Rs {worker.premium?.weeklyCoverageLimit || 2000}</p>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        <p>Rs {worker.premium?.weeklyAmount || 0}/week</p>
                        <p>{worker.premium?.currentWeekPaid ? 'Paid this week' : 'Pending'}</p>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {typeof worker.locationTracking?.currentLocation?.latitude === 'number' ? (
                          <>
                            <p>{worker.locationTracking.currentLocation.city || 'Live GPS'}</p>
                            <p>{worker.locationTracking.currentLocation.latitude.toFixed(4)}, {worker.locationTracking.currentLocation.longitude.toFixed(4)}</p>
                          </>
                        ) : (
                          <p>Not synced</p>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <button onClick={() => setSelectedWorker({ id: worker._id })} className="btn-outline">
                          <EyeIcon className="h-4 w-4 mr-2" />
                          View
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {selectedWorker ? <WorkerDetailsModal worker={selectedWorker} onClose={() => setSelectedWorker(null)} /> : null}
    </div>
  );
};

const SummaryCard = ({ label, value }) => (
  <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
    <p className="text-sm text-gray-500">{label}</p>
    <p className="mt-2 text-2xl font-bold text-gray-900">{value}</p>
  </div>
);

export default AdminWorkers;
