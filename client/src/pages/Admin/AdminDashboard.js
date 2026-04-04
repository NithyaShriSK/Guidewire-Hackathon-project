import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  CurrencyDollarIcon,
  ExclamationTriangleIcon,
  EyeIcon,
  PlayIcon,
  ShieldCheckIcon,
  UsersIcon,
} from '@heroicons/react/24/outline';
import { adminAPI, claimAPI, simulationAPI } from '../../services/api';
import WorkerDetailsModal from '../../components/Admin/WorkerDetailsModal';
import toast from 'react-hot-toast';

const AdminDashboard = () => {
  const [stats, setStats] = useState({
    totalWorkers: 0,
    activeWorkers: 0,
    totalPolicies: 0,
    activePolicies: 0,
    totalClaims: 0,
    pendingClaims: 0,
    approvedClaims: 0,
    rejectedClaims: 0,
    totalPayoutAmount: 0,
  });
  const [fraudStats, setFraudStats] = useState({
    totalClaims: 0,
    fraudClaims: 0,
    fraudRate: '0',
    manualReviewRate: '0',
  });
  const [payoutStats, setPayoutStats] = useState({
    totalPayouts: 0,
    successRate: '0',
    totalAmount: 0,
    averagePayoutAmount: 0,
  });
  const [workers, setWorkers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [simulationRunning, setSimulationRunning] = useState(false);
  const [selectedWorker, setSelectedWorker] = useState(null);
  const [latestSimulation, setLatestSimulation] = useState(null);
  const [simulationPair, setSimulationPair] = useState({ noPayout: null, payout: null });

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);

      const [dashboardResponse, fraudResponse, payoutResponse, workersResponse] = await Promise.all([
        adminAPI.getDashboardStats(),
        claimAPI.getFraudStatistics({ timeRange: '30d' }),
        claimAPI.getPayoutStatistics({ timeRange: '30d' }),
        adminAPI.getAllWorkers({ limit: 8 }),
      ]);

      setStats(dashboardResponse.data.data);
      setFraudStats(fraudResponse.data.data);
      setPayoutStats(payoutResponse.data.data);
      setWorkers(workersResponse.data.data.workers || []);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const runSimulation = async (scenarioId) => {
    try {
      setSimulationRunning(true);

      const activeWorker = workers.find((worker) => worker.status?.accountStatus === 'active') || workers[0];
      if (!activeWorker) {
        toast.error('No workers available for simulation');
        return;
      }

      const response = await simulationAPI.runSimulation({
        scenarioId,
        workerId: activeWorker._id,
      });

      setLatestSimulation(response.data.data);
      setSimulationPair((prev) => ({
        ...prev,
        [scenarioId === 'light_rain_no_payout' ? 'noPayout' : 'payout']: response.data.data
      }));
      toast.success('Trigger simulation completed');
      fetchDashboardData();
    } catch (error) {
      console.error('Simulation error:', error);
      toast.error(error.response?.data?.message || 'Failed to run simulation');
    } finally {
      setSimulationRunning(false);
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
      <div className="bg-gradient-to-r from-slate-900 to-cyan-700 rounded-lg p-6 text-white">
        <h1 className="text-2xl font-bold">Admin Dashboard</h1>
        <p className="mt-2 text-cyan-100">
          Monitor every worker, simulate parametric triggers, and show how automated payout flows work from event to claim to money movement.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <AdminStatCard title="Total Workers" value={stats.totalWorkers.toLocaleString()} subtitle={`${stats.activeWorkers} active`} icon={UsersIcon} color="blue" />
        <AdminStatCard title="Active Policies" value={stats.activePolicies.toLocaleString()} subtitle={`${stats.totalPolicies} total`} icon={ShieldCheckIcon} color="green" />
        <AdminStatCard title="Total Claims" value={stats.totalClaims.toLocaleString()} subtitle={`${stats.pendingClaims} pending`} icon={ExclamationTriangleIcon} color="yellow" />
        <AdminStatCard title="Total Payout" value={`Rs ${stats.totalPayoutAmount.toLocaleString()}`} subtitle={`${stats.approvedClaims} approved`} icon={CurrencyDollarIcon} color="purple" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Risk and Payout Health</h3>
          <div className="space-y-4">
            <MetricRow label="Fraud Rate" value={`${fraudStats.fraudRate}%`} tone={parseFloat(fraudStats.fraudRate) > 5 ? 'danger' : 'success'} />
            <MetricRow label="Manual Review Rate" value={`${fraudStats.manualReviewRate}%`} tone="warning" />
            <MetricRow label="Payout Success Rate" value={`${payoutStats.successRate}%`} tone={parseFloat(payoutStats.successRate) > 95 ? 'success' : 'warning'} />
            <MetricRow label="Average Payout" value={`Rs ${payoutStats.averagePayoutAmount || 0}`} tone="default" />
          </div>
          <div className="pt-4 mt-4 border-t">
            <Link to="/admin/claims" className="inline-flex items-center text-sm text-primary-600 hover:text-primary-500">
              Open claims review →
            </Link>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="text-lg font-medium text-gray-900">Trigger Simulation Demo</h3>
              <p className="text-sm text-gray-600 mt-1">
                Run both below-threshold and above-threshold demos to show why one case does not pay out and the other does.
              </p>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-3">
            <button
              onClick={() => runSimulation('light_rain_no_payout')}
              disabled={simulationRunning}
              className="inline-flex items-center rounded-md bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-70"
            >
              <PlayIcon className="mr-2 h-4 w-4" />
              {simulationRunning ? 'Running...' : 'Run No-Payout Demo'}
            </button>
            <button
              onClick={() => runSimulation('heavy_rain')}
              disabled={simulationRunning}
              className="inline-flex items-center rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-70"
            >
              <PlayIcon className="mr-2 h-4 w-4" />
              {simulationRunning ? 'Running...' : 'Run Payout Demo'}
            </button>
          </div>

          {latestSimulation ? (
            <div className="mt-5 space-y-4">
              <div className="rounded-lg bg-slate-50 p-4">
                <p className="text-sm font-semibold text-slate-900">
                  {latestSimulation.triggerSummary.metric}: {latestSimulation.triggerSummary.observed} {latestSimulation.triggerSummary.unit}
                </p>
                <p className="text-sm text-slate-600 mt-1">
                  Threshold: {latestSimulation.triggerSummary.threshold ?? 'Not configured'} {latestSimulation.triggerSummary.unit}
                </p>
                <p className="text-sm text-slate-600 mt-1">
                  Worker: {latestSimulation.worker.name} • Policy: {latestSimulation.policy.policyNumber}
                </p>
                <p className="text-sm font-medium mt-2 text-slate-800">
                  Outcome: {latestSimulation.outcome?.label}
                </p>
              </div>
              <div className="space-y-3">
                {latestSimulation.timeline.map((step) => (
                  <div key={step.title} className="rounded-lg border border-gray-200 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-medium text-gray-900">{step.title}</p>
                      <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${statusPill(step.status)}`}>
                        {step.status}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 mt-2">{step.detail}</p>
                  </div>
                ))}
              </div>
              {latestSimulation.claim ? (
                <div className="rounded-lg border border-green-200 bg-green-50 p-4">
                  <p className="text-sm font-semibold text-green-900">
                    Claim {latestSimulation.claim.claimNumber} • payout status {latestSimulation.claim.financial.payoutStatus}
                  </p>
                  <p className="text-sm text-green-800 mt-1">
                    Amount: Rs {latestSimulation.claim.financial.payoutAmount}
                  </p>
                </div>
              ) : (
                <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-900">
                  The simulation completed, but no qualifying claim was created for this worker.
                </div>
              )}
            </div>
          ) : (
            <div className="mt-5 rounded-lg border border-dashed border-gray-300 p-6 text-sm text-gray-500">
              Run the demo to generate a presentation-friendly trigger timeline.
            </div>
          )}
          {(simulationPair.noPayout || simulationPair.payout) ? (
            <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-4">
              {[simulationPair.noPayout, simulationPair.payout].filter(Boolean).map((item) => (
                <div key={item.scenario} className="rounded-lg border border-gray-200 p-4">
                  <p className="font-medium text-gray-900">{item.scenario.replaceAll('_', ' ')}</p>
                  <p className="text-sm text-gray-600 mt-2">
                    {item.triggerSummary.metric}: {item.triggerSummary.observed} {item.triggerSummary.unit}
                  </p>
                  <p className="text-sm text-gray-600">
                    Threshold: {item.triggerSummary.threshold ?? 'N/A'} {item.triggerSummary.unit}
                  </p>
                  <p className={`mt-3 inline-flex rounded-full px-3 py-1 text-xs font-semibold ${comparePill(item.outcome?.label)}`}>
                    {item.outcome?.label}
                  </p>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-medium text-gray-900">Worker Directory</h3>
            <p className="text-sm text-gray-600 mt-1">All core user details are available here, with a full drill-down per worker.</p>
          </div>
          <Link to="/admin/workers" className="text-sm text-primary-600 hover:text-primary-500 font-medium">
            Open workers page
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                {['Worker', 'Contact', 'Subscription', 'Live Location', 'Premium', 'Actions'].map((header) => (
                  <th key={header} className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {workers.map((worker) => (
                <tr key={worker._id}>
                  <td className="px-6 py-4">
                    <p className="font-medium text-gray-900">
                      {worker.personalInfo.firstName} {worker.personalInfo.lastName}
                    </p>
                    <p className="text-sm text-gray-500">{worker.personalInfo.address?.city}, {worker.personalInfo.address?.state}</p>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    <p>{worker.personalInfo.email}</p>
                    <p>{worker.personalInfo.phone}</p>
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <p className="text-gray-900">{worker.status.subscriptionStatus}</p>
                    <p className="text-gray-500">Account: {worker.status.accountStatus}</p>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {worker.locationTracking?.currentLocation?.latitude ? (
                      <>
                        <p>{worker.locationTracking.currentLocation.latitude.toFixed(4)}, {worker.locationTracking.currentLocation.longitude.toFixed(4)}</p>
                        <p>{worker.locationTracking.currentLocation.city || 'Live GPS'}</p>
                      </>
                    ) : (
                      <p>Not synced</p>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    <p>{worker.premium?.currentWeekPaid ? 'Paid this week' : 'Payment due'}</p>
                    <p>Rs {worker.premium?.weeklyAmount || 0}</p>
                  </td>
                  <td className="px-6 py-4">
                    <button
                      onClick={() => setSelectedWorker({ id: worker._id })}
                      className="inline-flex items-center rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                    >
                      <EyeIcon className="mr-2 h-4 w-4" />
                      View full details
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {selectedWorker ? (
        <WorkerDetailsModal worker={selectedWorker} onClose={() => setSelectedWorker(null)} />
      ) : null}
    </div>
  );
};

const AdminStatCard = ({ title, value, subtitle, icon: Icon, color }) => {
  const colorClasses = {
    blue: 'bg-blue-500',
    green: 'bg-green-500',
    yellow: 'bg-yellow-500',
    purple: 'bg-violet-500',
  };

  const bgColorClasses = {
    blue: 'bg-blue-100',
    green: 'bg-green-100',
    yellow: 'bg-yellow-100',
    purple: 'bg-violet-100',
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center">
        <div className={`p-3 rounded-lg ${bgColorClasses[color]}`}>
          <Icon className={`h-6 w-6 ${colorClasses[color]} text-white`} />
        </div>
        <div className="ml-4 flex-1">
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <p className="text-2xl font-semibold text-gray-900">{value}</p>
          <p className="text-sm text-gray-500">{subtitle}</p>
        </div>
      </div>
    </div>
  );
};

const MetricRow = ({ label, value, tone }) => {
  const tones = {
    default: 'text-slate-900',
    success: 'text-green-600',
    warning: 'text-yellow-600',
    danger: 'text-red-600',
  };

  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-gray-600">{label}</span>
      <span className={`text-lg font-semibold ${tones[tone]}`}>{value}</span>
    </div>
  );
};

const statusPill = (status) => {
  if (status === 'completed') return 'bg-green-100 text-green-800';
  if (status === 'in_progress') return 'bg-yellow-100 text-yellow-800';
  return 'bg-gray-100 text-gray-800';
};

const comparePill = (label) => {
  if (label === 'Payout Occurred') return 'bg-green-100 text-green-800';
  if (label === 'No Payout') return 'bg-slate-100 text-slate-800';
  return 'bg-yellow-100 text-yellow-800';
};

export default AdminDashboard;
