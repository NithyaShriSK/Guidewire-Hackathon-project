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
  pollution: null,
  traffic: null,
  rainfallStatus: null,
  pollutionStatus: null,
  trafficStatus: null,
  triggeredClaims: [],
  focus: 'rainfall',
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

      const [claimsResponse, claimAnalyticsResponse, monitoringResponse, profileResponse, premiumResponse] = await Promise.all([
        claimAPI.getWorkerClaims({ limit: 5 }),
        claimAPI.getClaimAnalytics(),
        monitoringAPI.getMonitoringStatus(),
        workerAPI.getProfile(),
        workerAPI.getPremiumStatus(),
      ]);

      const claims = claimsResponse.data.data.claims;
      const claimAnalytics = claimAnalyticsResponse.data.data;
      const profile = profileResponse.data.data;
      const premium = premiumResponse.data.data;

      setStats({
        activePolicies: premium.weeklyCoverageLimit || 0,
        totalClaims: claimAnalytics.totalClaims || 0,
        approvedClaims: claimAnalytics.approvedClaims || 0,
        totalPayout: claimAnalytics.totalPayoutAmount || 0,
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

  const handleThreatCheck = async (focus = 'rainfall') => {
    try {
      setThreatStatus((prev) => ({ ...prev, loading: true, focus }));
      const coords = await syncCurrentLocation();
      const response = await monitoringAPI.checkCurrentLocationThreat(coords);
      const data = response.data.data;

      setThreatStatus({
        loading: false,
        hasChecked: true,
        location: data.location,
        weather: data.weather,
        pollution: data.pollution,
        traffic: data.traffic,
        rainfallStatus: data.rainfallStatus,
        pollutionStatus: data.pollutionStatus,
        trafficStatus: data.trafficStatus,
        triggeredClaims: data.triggeredClaims || [],
        focus,
      });

      if (data.triggeredClaims?.length) {
        toast.success('Threat threshold breached. Automatic payout flow triggered.');
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
      <div className="overflow-hidden rounded-3xl bg-gradient-to-r from-primary-700 via-primary-600 to-success-600 p-6 text-white shadow-[0_24px_50px_-30px_rgba(20,71,177,0.95)]">
        <h1 className="text-2xl font-bold">
          Worker Control Panel for {user?.personalInfo?.firstName}
        </h1>
        <p className="mt-2 max-w-3xl text-primary-50/90">
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
        <div className="card p-6">
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
                  ? 'bg-success-100 text-success-800 hover:bg-success-200'
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
                className="btn-primary disabled:cursor-not-allowed disabled:opacity-70"
              >
                <MapPinIcon className="mr-2 h-4 w-4" />
                {locationSyncing ? 'Syncing location...' : 'Use My Current Location'}
              </button>
              <button
                onClick={() => handleThreatCheck('rainfall')}
                disabled={threatStatus.loading || locationSyncing}
                className="btn-secondary disabled:cursor-not-allowed disabled:opacity-70"
              >
                <CloudIcon className="mr-2 h-4 w-4" />
                {threatStatus.loading ? 'Checking rainfall risk...' : 'Check Rainfall Threat'}
              </button>
              <button
                onClick={() => handleThreatCheck('traffic')}
                disabled={threatStatus.loading || locationSyncing}
                className="btn-secondary disabled:cursor-not-allowed disabled:opacity-70"
              >
                <ArrowTrendingUpIcon className="mr-2 h-4 w-4" />
                {threatStatus.loading ? 'Checking traffic risk...' : 'Check Traffic Threat'}
              </button>
              <button
                onClick={() => handleThreatCheck('pollution')}
                disabled={threatStatus.loading || locationSyncing}
                className="btn-secondary disabled:cursor-not-allowed disabled:opacity-70"
              >
                <ExclamationTriangleIcon className="mr-2 h-4 w-4" />
                {threatStatus.loading ? 'Checking pollution risk...' : 'Check Pollution Threat'}
              </button>
            </div>
          </div>
        </div>

        <div className="card p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="text-lg font-medium text-gray-900">Threat Trigger Status</h3>
              <p className="text-sm text-gray-600 mt-1">
                The payout engine compares rainfall, traffic, and pollution against your active parametric thresholds.
              </p>
            </div>
            {threatStatus.hasChecked ? <ThreatPill threatStatus={threatStatus} /> : null}
          </div>

          {!threatStatus.hasChecked ? (
            <div className="mt-8 rounded-lg border border-dashed border-gray-300 p-6 text-center text-sm text-gray-500">
              Run a threat check to see whether the current location is in a payout-triggering rainfall, traffic, or pollution zone.
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
                  label="Traffic Congestion"
                  value={threatStatus.traffic?.congestionLevel !== null && threatStatus.traffic?.congestionLevel !== undefined
                    ? `${threatStatus.traffic.congestionLevel}/10`
                    : 'Unavailable'}
                  tone={threatStatus.trafficStatus?.exceeded ? 'danger' : 'default'}
                />
                <InfoTile
                  label="Current AQI"
                  value={threatStatus.pollution?.aqi !== null && threatStatus.pollution?.aqi !== undefined
                    ? `${threatStatus.pollution.aqi}`
                    : 'Unavailable'}
                  tone={threatStatus.pollutionStatus?.exceeded ? 'danger' : 'default'}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <InfoTile
                  label="Rainfall Threshold"
                  value={threatStatus.rainfallStatus?.threshold !== null && threatStatus.rainfallStatus?.threshold !== undefined
                    ? `${threatStatus.rainfallStatus.threshold} mm/hr`
                    : 'No active weather cover'}
                />
                <InfoTile
                  label="Traffic Threshold"
                  value={threatStatus.trafficStatus?.congestionThreshold !== null && threatStatus.trafficStatus?.congestionThreshold !== undefined
                    ? `${threatStatus.trafficStatus.congestionThreshold}/10`
                    : 'No active traffic cover'}
                />
                <InfoTile
                  label="AQI Threshold"
                  value={threatStatus.pollutionStatus?.threshold !== null && threatStatus.pollutionStatus?.threshold !== undefined
                    ? `${threatStatus.pollutionStatus.threshold}`
                    : 'No active pollution cover'}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <InfoTile
                  label="Auto Trigger"
                  value={threatStatus.triggeredClaims.length ? 'Payout initiated' : 'Standby'}
                  tone={threatStatus.triggeredClaims.length ? 'success' : 'default'}
                />
                <InfoTile
                  label="Traffic Speed"
                  value={threatStatus.traffic?.averageSpeed !== null && threatStatus.traffic?.averageSpeed !== undefined
                    ? `${threatStatus.traffic.averageSpeed} km/hr`
                    : 'Unavailable'}
                  tone={threatStatus.trafficStatus?.exceeded ? 'danger' : 'default'}
                />
                <InfoTile
                  label="Focus"
                  value={formatThreatLabel(threatStatus.focus)}
                  tone="default"
                />
              </div>

              <div className="rounded-lg bg-slate-50 p-4">
                <p className="text-sm font-medium text-slate-900">{getThreatNarrative(threatStatus)}</p>
                <p className="mt-1 text-sm text-slate-600">
                  {threatStatus.location?.name || 'Live location'} at {formatCoordinates(threatStatus.location)}
                </p>
                <ThreatGapText threatStatus={threatStatus} />
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
          label="Earnings Protected"
          value={`Rs ${stats.totalPayout.toLocaleString()}`}
          tone="default"
        />
        <InfoTile
          label="Active Weekly Coverage"
          value={premiumStatus?.canClaimInsurance ? 'Active' : 'Inactive'}
          tone={premiumStatus?.canClaimInsurance ? 'success' : 'danger'}
        />
        <InfoTile
          label="Weekly Coverage Limit"
          value={`Rs ${premiumStatus?.weeklyCoverageLimit || 0}`}
          tone="default"
        />
      </div>

      <div className="card">
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
                  className="btn-primary"
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
                    claim.status.current === 'approved' || claim.status.current === 'paid' ? 'bg-success-100 text-success-800' :
                    claim.status.current === 'rejected' ? 'bg-red-100 text-red-800' :
                    'bg-warning-100 text-warning-800'
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
    blue: 'text-primary-700',
    green: 'text-success-700',
    yellow: 'text-warning-700',
    purple: 'text-success-700',
  };

  const bgColorClasses = {
    blue: 'bg-primary-100',
    green: 'bg-success-100',
    yellow: 'bg-warning-100',
    purple: 'bg-success-100',
  };

  return (
    <div className="card p-6">
      <div className="flex items-center">
        <div className={`p-3 rounded-lg ${bgColorClasses[color]}`}>
          <Icon className={`h-6 w-6 ${colorClasses[color]}`} />
        </div>
        <div className="ml-4 flex-1">
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <p className="text-2xl font-semibold text-gray-900">{value}</p>
        </div>
        {trend === 'up' ? <ArrowTrendingUpIcon className="h-5 w-5 text-success-500" /> : null}
        {trend === 'down' ? <ArrowTrendingDownIcon className="h-5 w-5 text-red-500" /> : null}
      </div>
    </div>
  );
};

const InfoTile = ({ label, value, tone = 'default' }) => {
  const toneClasses = {
    default: 'border-gray-200 bg-white text-gray-900',
    success: 'border-success-200 bg-success-50 text-success-900',
    danger: 'border-red-200 bg-red-50 text-red-900',
  };

  return (
    <div className={`rounded-2xl border p-4 ${toneClasses[tone]}`}>
      <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</p>
      <p className="mt-2 text-lg font-semibold">{value}</p>
    </div>
  );
};

const ThreatPill = ({ threatStatus }) => {
  const anyExceeded = threatStatus.rainfallStatus?.exceeded || threatStatus.pollutionStatus?.exceeded || threatStatus.trafficStatus?.exceeded;

  return anyExceeded ? (
    <span className="inline-flex rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-800">
      Threshold exceeded
    </span>
  ) : (
    <span className="inline-flex rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800">
      Within limit
    </span>
  );
};

const ThreatGapText = ({ threatStatus }) => {
  if (threatStatus.focus === 'traffic') {
    if (threatStatus.trafficStatus?.exceeded) return null;
    if (threatStatus.trafficStatus?.congestionShortfall !== null && threatStatus.trafficStatus?.congestionShortfall !== undefined) {
      return (
        <p className="mt-1 text-sm text-slate-600">
          Needs {threatStatus.trafficStatus.congestionShortfall.toFixed(1)} more congestion points or slower traffic to trigger payout automation.
        </p>
      );
    }
    return null;
  }

  if (threatStatus.focus === 'pollution') {
    if (threatStatus.pollutionStatus?.exceeded) return null;
    if (threatStatus.pollutionStatus?.shortfall !== null && threatStatus.pollutionStatus?.shortfall !== undefined) {
      return (
        <p className="mt-1 text-sm text-slate-600">
          Needs {threatStatus.pollutionStatus.shortfall.toFixed(0)} more AQI points to trigger payout automation.
        </p>
      );
    }
    return null;
  }

  if (threatStatus.rainfallStatus?.exceeded) return null;
  if (threatStatus.rainfallStatus?.shortfall !== null && threatStatus.rainfallStatus?.shortfall !== undefined) {
    return (
      <p className="mt-1 text-sm text-slate-600">
        Needs {threatStatus.rainfallStatus.shortfall.toFixed(1)} more mm/hr to trigger payout automation.
      </p>
    );
  }
  return null;
};

const getThreatNarrative = (threatStatus) => {
  if (threatStatus.focus === 'traffic') {
    return threatStatus.trafficStatus?.exceeded
      ? 'Traffic congestion is above the configured policy threshold for this location.'
      : 'Traffic is still below the configured policy trigger.';
  }

  if (threatStatus.focus === 'pollution') {
    return threatStatus.pollutionStatus?.exceeded
      ? 'Air quality is above the configured policy threshold for this location.'
      : 'Air quality is still below the configured policy trigger.';
  }

  return threatStatus.rainfallStatus?.exceeded
    ? 'Rainfall is above the configured policy threshold for this location.'
    : 'Rainfall is still below the configured policy trigger.';
};

const formatThreatLabel = (value) => {
  switch (value) {
    case 'traffic':
      return 'Traffic';
    case 'pollution':
      return 'Pollution';
    default:
      return 'Rainfall';
  }
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
