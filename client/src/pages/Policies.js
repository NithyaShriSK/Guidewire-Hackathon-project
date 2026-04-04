import React, { useEffect, useState } from 'react';
import {
  CheckCircleIcon,
  ClockIcon,
  PlusIcon,
  ShieldCheckIcon,
  XCircleIcon,
} from '@heroicons/react/24/outline';
import { policyAPI } from '../services/api';
import toast from 'react-hot-toast';

const recommendedPolicy = {
  coverage: {
    coveredRisks: [
      {
        type: 'extreme_weather',
        isActive: true,
        thresholds: {
          weather: {
            rainfall: 15,
            windSpeed: 50,
            temperature: 42,
          },
        },
      },
      {
        type: 'high_pollution',
        isActive: true,
        thresholds: {
          pollution: {
            aqi: 400,
            pm25: 250,
          },
        },
      },
      {
        type: 'traffic_congestion',
        isActive: true,
        thresholds: {
          traffic: {
            congestionLevel: 8,
            averageSpeed: 5,
          },
        },
      },
    ],
    maxPayoutPerClaim: 500,
    maxPayoutPerWeek: 2000,
  },
  premium: {
    baseAmount: 20,
    paymentFrequency: 'weekly',
  },
};

const Policies = () => {
  const [policies, setPolicies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    fetchPolicies();
  }, []);

  const fetchPolicies = async () => {
    try {
      const response = await policyAPI.getWorkerPolicies();
      setPolicies(response.data.data.policies);
    } catch (error) {
      toast.error('Failed to fetch policies');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateRecommendedPolicy = async () => {
    try {
      setCreating(true);
      const response = await policyAPI.createPolicy(recommendedPolicy);
      const createdPolicy = response.data.data.policy;
      await policyAPI.activatePolicy(createdPolicy._id);
      toast.success('Weekly income shield created and activated');
      fetchPolicies();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to create recommended policy');
    } finally {
      setCreating(false);
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'active':
        return <CheckCircleIcon className="h-5 w-5 text-green-600" />;
      case 'pending':
        return <ClockIcon className="h-5 w-5 text-yellow-600" />;
      case 'expired':
      case 'inactive':
        return <XCircleIcon className="h-5 w-5 text-red-600" />;
      default:
        return <ClockIcon className="h-5 w-5 text-gray-600" />;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'expired':
      case 'inactive':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
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
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Income Shield Policies</h1>
          <p className="text-gray-600">
            Weekly parametric protection for Amazon Flex-style block earnings, built around rainfall, AQI, heat, and traffic disruptions.
          </p>
        </div>
        <button onClick={handleCreateRecommendedPolicy} disabled={creating} className="btn-primary">
          <PlusIcon className="h-5 w-5 mr-2" />
          {creating ? 'Creating...' : 'Add Recommended Weekly Shield'}
        </button>
      </div>

      <div className="rounded-xl bg-slate-900 p-6 text-white">
        <h3 className="text-lg font-semibold">Recommended FixMyPay Plan</h3>
        <p className="mt-2 text-sm text-slate-200">
          Rs 20/week micro-premium, rainfall trigger above 15 mm/hr, instant automated payout for income loss, and fraud-aware validation for payout safety.
        </p>
        <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div className="rounded-lg bg-white/10 p-4">Extreme weather trigger: rainfall, wind, heat</div>
          <div className="rounded-lg bg-white/10 p-4">Environmental trigger: AQI and PM2.5 spikes</div>
          <div className="rounded-lg bg-white/10 p-4">Mobility trigger: heavy traffic and route disruption</div>
        </div>
      </div>

      {policies.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg shadow">
          <ShieldCheckIcon className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">No income shield active yet</h3>
          <p className="mt-1 text-sm text-gray-500">
            Create the recommended weekly shield to make your automatic payout demo and live monitoring ready.
          </p>
          <div className="mt-6">
            <button onClick={handleCreateRecommendedPolicy} disabled={creating} className="btn-primary">
              <PlusIcon className="h-5 w-5 mr-2" />
              {creating ? 'Creating...' : 'Create Recommended Policy'}
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6">
          {policies.map((policy) => (
            <div key={policy._id} className="card">
              <div className="card-header">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    {getStatusIcon(policy.status.current)}
                    <h3 className="ml-2 text-lg font-medium text-gray-900">
                      Policy #{policy.policyNumber}
                    </h3>
                  </div>
                  <span className={`badge ${getStatusColor(policy.status.current)}`}>
                    {policy.status.current}
                  </span>
                </div>
              </div>
              <div className="card-content">
                <div className="space-y-4">
                  <div>
                    <h4 className="text-sm font-medium text-gray-900">Coverage Details</h4>
                    <div className="mt-2 space-y-1">
                      <p className="text-sm text-gray-600">
                        Max Payout per Claim: <span className="font-medium">Rs {policy.coverage.maxPayoutPerClaim}</span>
                      </p>
                      <p className="text-sm text-gray-600">
                        Max Payout per Week: <span className="font-medium">Rs {policy.coverage.maxPayoutPerWeek}</span>
                      </p>
                      <p className="text-sm text-gray-600">
                        Premium: <span className="font-medium">Rs {policy.premium.finalAmount}/week</span>
                      </p>
                    </div>
                  </div>

                  <div>
                    <h4 className="text-sm font-medium text-gray-900">Covered Risks</h4>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {policy.coverage.coveredRisks.map((risk, index) => (
                        <span key={index} className={`badge ${risk.isActive ? 'badge-success' : 'badge-warning'}`}>
                          {risk.type.replace('_', ' ')}
                        </span>
                      ))}
                    </div>
                  </div>

                  {policy.status.expiresAt ? (
                    <div>
                      <h4 className="text-sm font-medium text-gray-900">Validity</h4>
                      <p className="mt-1 text-sm text-gray-600">
                        Expires: {new Date(policy.status.expiresAt).toLocaleDateString()}
                      </p>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Policies;
