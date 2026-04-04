import React, { useState, useEffect } from 'react';
import { ExclamationTriangleIcon, ClockIcon, CheckCircleIcon, XCircleIcon, LockClosedIcon } from '@heroicons/react/24/outline';
import { claimAPI, workerAPI } from '../services/api';
import toast from 'react-hot-toast';
import { Link } from 'react-router-dom';

const Claims = () => {
  const [claims, setClaims] = useState([]);
  const [analytics, setAnalytics] = useState({});
  const [loading, setLoading] = useState(true);
  const [premiumStatus, setPremiumStatus] = useState(null);
  const [premiumLoading, setPremiumLoading] = useState(true);

  useEffect(() => {
    fetchClaims();
    fetchAnalytics();
    fetchPremiumStatus();
  }, []);

  const fetchPremiumStatus = async () => {
    try {
      const response = await workerAPI.getPremiumStatus();
      setPremiumStatus(response.data.data);
    } catch (error) {
      console.error('Error fetching premium status:', error);
    } finally {
      setPremiumLoading(false);
    }
  };

  const fetchClaims = async () => {
    try {
      const response = await claimAPI.getWorkerClaims();
      setClaims(response.data.data.claims);
    } catch (error) {
      toast.error('Failed to fetch claims');
    } finally {
      setLoading(false);
    }
  };

  const fetchAnalytics = async () => {
    try {
      const response = await claimAPI.getClaimAnalytics();
      setAnalytics(response.data.data);
    } catch (error) {
      console.error('Failed to fetch analytics:', error);
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'approved':
        return <CheckCircleIcon className="h-5 w-5 text-green-600" />;
      case 'rejected':
        return <XCircleIcon className="h-5 w-5 text-red-600" />;
      case 'paid':
        return <CheckCircleIcon className="h-5 w-5 text-green-600" />;
      default:
        return <ClockIcon className="h-5 w-5 text-yellow-600" />;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'approved':
        return 'bg-green-100 text-green-800';
      case 'rejected':
        return 'bg-red-100 text-red-800';
      case 'paid':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-yellow-100 text-yellow-800';
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
      {/* Premium Payment Alert */}
      {!premiumLoading && premiumStatus && !premiumStatus.currentWeekPaid && (
        <div className="flex items-start p-4 bg-red-50 border-l-4 border-red-600 rounded-lg">
          <LockClosedIcon className="h-6 w-6 text-red-600 mr-3 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h3 className="font-semibold text-red-900">Premium Payment Required</h3>
            <p className="text-sm text-red-800 mt-1">
              Your insurance coverage is disabled until this week's premium is paid. 
              You cannot file new claims until payment is received.
            </p>
            <Link
              to="/weekly-premium"
              className="inline-block mt-2 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition text-sm font-medium"
            >
              Pay Now
            </Link>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Claims</h1>
          <p className="text-gray-600">Claims are auto-triggered by monitoring events and paid instantly after AI checks.</p>
        </div>
        <div className="inline-flex items-center px-4 py-2 rounded-lg bg-blue-100 text-blue-800 text-sm font-medium">
          <ExclamationTriangleIcon className="h-5 w-5 mr-2" />
          Automation Only
        </div>
      </div>

      {/* Analytics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="card">
          <div className="card-content">
            <div className="flex items-center">
              <div className="p-3 rounded-lg bg-blue-100">
                <ExclamationTriangleIcon className="h-6 w-6 text-blue-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Claims</p>
                <p className="text-2xl font-semibold text-gray-900">{analytics.totalClaims || 0}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-content">
            <div className="flex items-center">
              <div className="p-3 rounded-lg bg-green-100">
                <CheckCircleIcon className="h-6 w-6 text-green-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Approved</p>
                <p className="text-2xl font-semibold text-gray-900">{analytics.approvedClaims || 0}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-content">
            <div className="flex items-center">
              <div className="p-3 rounded-lg bg-red-100">
                <XCircleIcon className="h-6 w-6 text-red-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Rejected</p>
                <p className="text-2xl font-semibold text-gray-900">{analytics.rejectedClaims || 0}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-content">
            <div className="flex items-center">
              <div className="p-3 rounded-lg bg-purple-100">
                <span className="text-2xl font-bold text-purple-600">₹</span>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Payout</p>
                <p className="text-2xl font-semibold text-gray-900">
                  ₹{analytics.totalPayoutAmount?.toLocaleString() || 0}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Claims List */}
      {claims.length === 0 ? (
        <div className="text-center py-12">
          <ExclamationTriangleIcon className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">No claims yet</h3>
          <p className="mt-1 text-sm text-gray-500">
            Claims will appear here automatically after validated weather, AQI, heat, or traffic disruption events.
          </p>
        </div>
      ) : (
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Recent Claims</h3>
          </div>
          <div className="card-content">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Claim ID
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Type
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Amount
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {claims.map((claim) => (
                    <tr key={claim._id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {claim.claimNumber}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {claim.trigger.type.replace('_', ' ').toUpperCase()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        ₹{claim.financial.payoutAmount}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          {getStatusIcon(claim.status.current)}
                          <span className={`ml-2 inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(claim.status.current)}`}>
                            {claim.status.current}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(claim.trigger.timestamp).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <button className="text-primary-600 hover:text-primary-900">
                          View Details
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Claims;
