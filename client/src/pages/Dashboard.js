import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowPathIcon,
  ArrowTrendingDownIcon,
  ArrowTrendingUpIcon,
  CheckCircleIcon,
  ClockIcon,
  CloudIcon,
  CurrencyRupeeIcon,
  ExclamationTriangleIcon,
  MapPinIcon,
  ShieldCheckIcon,
} from '@heroicons/react/24/outline';
import { useAuth } from '../contexts/AuthContext';
import { claimAPI, monitoringAPI, workerAPI } from '../services/api';
import toast from 'react-hot-toast';

const defaultThreatStatus = {
  loading: false,
  hasChecked: false,
  location: null,
  weather: null,
  rainfallStatus: null,
  triggeredClaims: [],
};

const Dashboard = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState({
    activePolicies: 0,
    totalClaims: 0,
    approvedClaims: 0,
    totalPayout: 0,
  });
  const [recentClaims, setRecentClaims] = useState([]);
  const [monitoringStatus, setMonitoringStatus] = useState(false);
  const [loading, setLoading] = useState(true);
  const [locationSyncing, setLocationSyncing] = useState(false);
  const [currentLocation, setCurrentLocation] = useState(null);
  const [threatStatus, setThreatStatus] = useState(defaultThreatStatus);
  const [premiumStatus, setPremiumStatus] = useState(null);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);

      const [claimsResponse, monitoringResponse, profileResponse, premiumResponse] = await Promise.all([
        claimAPI.getWorkerClaims({ limit: 5 }),
        monitoringAPI.getMonitoringStatus(),
        workerAPI.getProfile(),
        workerAPI.getPremiumStatus(),
      ]);

      const claims = claimsResponse.data.data.claims;
      const profile = profileResponse.data.data;
      const premium = premiumResponse.data.data;

      const approvedClaims = claims.filter((claim) => claim.status.current === 'approved' || claim.status.current === 'paid').length;
      const totalPayout = claims
        .filter((claim) => claim.status.current === 'approved' || claim.status.current === 'paid')
        .reduce((sum, claim) => sum + (claim.financial.payoutAmount || 0), 0);

      setStats({
        activePolicies: premium.weeklyCoverageLimit || 0,
        totalClaims: claims.length,
        approvedClaims,
        totalPayout,
      });

      setRecentClaims(claims);
      setMonitoringStatus(monitoringResponse.data.data.isMonitoring);
      setCurrentLocation(profile.locationTracking?.currentLocation || null);
      setPremiumStatus(premium);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const getBrowserLocation = () => new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation is not supported in this browser'));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
      },
      () => reject(new Error('Location permission is required to monitor rainfall risk')),
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000,
      }
    );
  });

  const syncCurrentLocation = async () => {
    try {
      setLocationSyncing(true);
      const coords = await getBrowserLocation();
      const payload = {
        ...coords,
        address: 'Live device location',
        city: 'Live GPS',
        state: 'Detected by browser',
        workingRegion: 'Live monitoring zone',
        isActive: true,
      };

      await workerAPI.updateLocation(payload);
      setCurrentLocation({
        ...payload,
        lastUpdated: new Date().toISOString(),
      });

      toast.success('Current location synced for monitoring');
      return coords;
    } catch (error) {
      const message = error.response?.data?.message || error.message || 'Failed to access your current location';
      toast.error(message);
      throw error;
    } finally {
      setLocationSyncing(false);
    }
  };

  const handleThreatCheck = async () => {
    try {
      setThreatStatus((prev) => ({ ...prev, loading: true }));
      const coords = await syncCurrentLocation();
      const response = await monitoringAPI.checkCurrentLocationThreat(coords);
      const data = response.data.data;

      setThreatStatus({
        loading: false,
        hasChecked: true,
        location: data.location,
        weather: data.weather,
        rainfallStatus: data.rainfallStatus,
        triggeredClaims: data.triggeredClaims || [],
      });

      if (data.triggeredClaims?.length) {
        toast.success('Rainfall threshold breached. Automatic payout flow triggered.');
        fetchDashboardData();
      } else {
        toast.success('Location checked. No payout trigger right now.');
      }
    } catch (error) {
      setThreatStatus((prev) => ({ ...prev, loading: false }));
    }
  };

  const toggleMonitoring = async () => {
    try {
      if (monitoringStatus) {
        await monitoringAPI.stopMonitoring();
        setMonitoringStatus(false);
        toast.success('Monitoring stopped');
        return;
      }

      await syncCurrentLocation();
      await monitoringAPI.startMonitoring();
      setMonitoringStatus(true);
      toast.success('Live parametric monitoring started');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to toggle monitoring');
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
      <div className="bg-gradient-to-r from-primary-600 to-sky-700 rounded-lg p-6 text-white">
        <h1 className="text-2xl font-bold">
          Worker Control Panel for {user?.personalInfo?.firstName}
        </h1>
        <p className="mt-2 text-primary-100">
          Keep monitoring on, track your weekly coverage plan, and watch automatic payouts trigger when disruption thresholds are breached.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard title="Weekly Cover Limit" value={`Rs ${stats.activePolicies.toLocaleString()}`} icon={ShieldCheckIcon} color="blue" trend="up" />
        <StatCard title="Total Claims" value={stats.totalClaims} icon={ExclamationTriangleIcon} color="yellow" trend={stats.totalClaims > 0 ? 'up' : 'neutral'} />
        <StatCard title="Approved Claims" value={stats.approvedClaims} icon={CheckCircleIcon} color="green" trend="up" />
        <StatCard title="Total Payout" value={`Rs ${stats.totalPayout.toLocaleString()}`} icon={CurrencyRupeeIcon} color="purple" trend="up" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="text-lg font-medium text-gray-900">Live Location Monitoring</h3>
              <p className="text-sm text-gray-600 mt-1">
                Use the worker&apos;s current GPS position for rainfall-triggered claim detection.
              </p>
            </div>
            <button
              onClick={toggleMonitoring}
              className={`px-4 py-2 rounded-md font-medium transition-colors ${
                monitoringStatus
                  ? 'bg-green-100 text-green-800 hover:bg-green-200'
                  : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
              }`}
            >
              {monitoringStatus ? 'Monitoring On' : 'Start Monitoring'}
            </button>
          </div>

          <div className="mt-5 rounded-lg border border-gray-200 p-4">
            <div className="flex items-center gap-3">
              <MapPinIcon className="h-5 w-5 text-primary-600" />
              <div>
                <p className="text-sm font-medium text-gray-900">Current tracked position</p>
                <p className="text-sm text-gray-600">
                  {formatLocation(currentLocation)}
                </p>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-3">
              <button
                onClick={syncCurrentLocation}
                disabled={locationSyncing}
                className="inline-flex items-center rounded-md bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-70"
              >
                <MapPinIcon className="mr-2 h-4 w-4" />
                {locationSyncing ? 'Syncing location...' : 'Use My Current Location'}
              </button>
              <button
                onClick={handleThreatCheck}
                disabled={threatStatus.loading || locationSyncing}
                className="inline-flex items-center rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
              >
                <CloudIcon className="mr-2 h-4 w-4" />
                {threatStatus.loading ? 'Checking rainfall risk...' : 'Check Rainfall Threat'}
              </button>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="text-lg font-medium text-gray-900">Rainfall Trigger Status</h3>
              <p className="text-sm text-gray-600 mt-1">
                The payout engine compares live rainfall against your active parametric threshold.
              </p>
            </div>
            {threatStatus.hasChecked ? (
              threatStatus.rainfallStatus?.exceeded ? (
                <span className="inline-flex rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-800">
                  Threshold exceeded
                </span>
              ) : (
                <span className="inline-flex rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800">
                  Within limit
                </span>
              )
            ) : null}
          </div>

          {!threatStatus.hasChecked ? (
            <div className="mt-8 rounded-lg border border-dashed border-gray-300 p-6 text-center text-sm text-gray-500">
              Run a rainfall check to see whether the current location is in a payout-triggering threat zone.
            </div>
          ) : (
            <div className="mt-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <InfoTile
                  label="Current Rainfall"
                  value={`${threatStatus.weather?.rainfall ?? 0} mm/hr`}
                  tone={threatStatus.rainfallStatus?.exceeded ? 'danger' : 'default'}
                />
                <InfoTile
                  label="Threshold"
                  value={threatStatus.rainfallStatus?.threshold !== null && threatStatus.rainfallStatus?.threshold !== undefined
                    ? `${threatStatus.rainfallStatus.threshold} mm/hr`
                    : 'No active weather cover'}
                />
                <InfoTile
                  label="Auto Trigger"
                  value={threatStatus.triggeredClaims.length ? 'Payout initiated' : 'Standby'}
                  tone={threatStatus.triggeredClaims.length ? 'success' : 'default'}
                />
              </div>

              <div className="rounded-lg bg-slate-50 p-4">
                <p className="text-sm font-medium text-slate-900">
                  {threatStatus.rainfallStatus?.exceeded
                    ? 'Rainfall is above the configured policy threshold for this location.'
                    : 'Rainfall is still below the configured policy trigger.'}
                </p>
                <p className="mt-1 text-sm text-slate-600">
                  {threatStatus.location?.name || 'Live location'} at {formatCoordinates(threatStatus.location)}
                </p>
                {threatStatus.rainfallStatus?.shortfall !== null && threatStatus.rainfallStatus?.shortfall !== undefined && !threatStatus.rainfallStatus?.exceeded ? (
                  <p className="mt-1 text-sm text-slate-600">
                    Needs {threatStatus.rainfallStatus.shortfall.toFixed(1)} more mm/hr to trigger payout automation.
                  </p>
                ) : null}
              </div>

              {threatStatus.triggeredClaims.length > 0 ? (
                <div className="rounded-lg border border-green-200 bg-green-50 p-4">
                  <p className="text-sm font-semibold text-green-900">Automatic payout flow triggered</p>
                  {threatStatus.triggeredClaims.map((claim) => (
                    <p key={claim.claimId} className="mt-1 text-sm text-green-800">
                      {claim.policyNumber}: claim created for Rs {claim.payoutAmount}
                    </p>
                  ))}
                </div>
              ) : null}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <InfoTile
          label="Current Plan"
          value={premiumStatus?.planType ? premiumStatus.planType.toUpperCase() : 'BASIC'}
          tone="default"
        />
        <InfoTile
          label="Weekly Premium"
          value={`Rs ${premiumStatus?.weeklyAmount || 0}`}
          tone="default"
        />
        <InfoTile
          label="Coverage Status"
          value={premiumStatus?.canClaimInsurance ? 'Active' : 'Payment Needed'}
          tone={premiumStatus?.canClaimInsurance ? 'success' : 'danger'}
        />
      </div>

      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium text-gray-900">Recent Claims</h3>
            <Link to="/claims" className="text-sm text-primary-600 hover:text-primary-500 font-medium">
              View all
            </Link>
          </div>
        </div>
        <div className="divide-y divide-gray-200">
          {recentClaims.length === 0 ? (
            <div className="px-6 py-8 text-center text-gray-500">
              <ExclamationTriangleIcon className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">No claims yet</h3>
              <p className="mt-1 text-sm text-gray-500">
                Enable monitoring and keep your weekly premium active to start automatic parametric protection.
              </p>
              <div className="mt-6">
                <button
                  onClick={handleThreatCheck}
                  className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700"
                >
                  <ArrowPathIcon className="mr-2 h-4 w-4" />
                  Run Rainfall Check
                </button>
              </div>
            </div>
          ) : (
            recentClaims.map((claim) => (
              <div key={claim._id} className="px-6 py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className={`p-2 rounded-full ${
                      claim.status.current === 'approved' || claim.status.current === 'paid' ? 'bg-green-100' :
                      claim.status.current === 'rejected' ? 'bg-red-100' :
                      'bg-yellow-100'
                    }`}>
                      {claim.status.current === 'approved' || claim.status.current === 'paid' ? (
                        <CheckCircleIcon className="h-5 w-5 text-green-600" />
                      ) : claim.status.current === 'rejected' ? (
                        <ExclamationTriangleIcon className="h-5 w-5 text-red-600" />
                      ) : (
                        <ClockIcon className="h-5 w-5 text-yellow-600" />
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {claim.trigger.type.replace('_', ' ').toUpperCase()}
                      </p>
                      <p className="text-sm text-gray-500">
                        Rs {claim.financial.payoutAmount} • {new Date(claim.trigger.timestamp).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                    claim.status.current === 'approved' || claim.status.current === 'paid' ? 'bg-green-100 text-green-800' :
                    claim.status.current === 'rejected' ? 'bg-red-100 text-red-800' :
                    'bg-yellow-100 text-yellow-800'
                  }`}>
                    {claim.status.current}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

const StatCard = ({ title, value, icon: Icon, color, trend }) => {
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
        </div>
        {trend === 'up' ? <ArrowTrendingUpIcon className="h-5 w-5 text-green-500" /> : null}
        {trend === 'down' ? <ArrowTrendingDownIcon className="h-5 w-5 text-red-500" /> : null}
      </div>
    </div>
  );
};

const InfoTile = ({ label, value, tone = 'default' }) => {
  const toneClasses = {
    default: 'border-gray-200 bg-white text-gray-900',
    success: 'border-green-200 bg-green-50 text-green-900',
    danger: 'border-red-200 bg-red-50 text-red-900',
  };

  return (
    <div className={`rounded-lg border p-4 ${toneClasses[tone]}`}>
      <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</p>
      <p className="mt-2 text-lg font-semibold">{value}</p>
    </div>
  );
};

const formatLocation = (location) => {
  if (!location || typeof location.latitude !== 'number' || typeof location.longitude !== 'number') {
    return 'No live location synced yet';
  }

  return `${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)}`;
};

const formatCoordinates = (location) => {
  if (!location || typeof location.latitude !== 'number' || typeof location.longitude !== 'number') {
    return 'coordinates unavailable';
  }

  return `${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)}`;
};

export default Dashboard;
