import React, { useState, useEffect } from 'react';
import {
  MapPinIcon,
  CloudIcon,
  ExclamationTriangleIcon,
  TruckIcon,
  CheckCircleIcon,
  XCircleIcon,
  EyeIcon
} from '@heroicons/react/24/outline';
import { adminAPI } from '../../services/api';
import toast from 'react-hot-toast';
import WorkerDetailsModal from '../../components/Admin/WorkerDetailsModal';

const AdminGeographic = () => {
  const [regions, setRegions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedWorker, setSelectedWorker] = useState(null);
  const [showWorkerModal, setShowWorkerModal] = useState(false);

  useEffect(() => {
    fetchGeographicData();
    // Refresh every 30 seconds
    const interval = setInterval(fetchGeographicData, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchGeographicData = async () => {
    try {
      const response = await adminAPI.getGeographicOverview();
      setRegions(response.data.data);
    } catch (error) {
      console.error('Error fetching geographic data:', error);
      toast.error('Failed to fetch geographic data');
    } finally {
      setLoading(false);
    }
  };

  const handleViewWorkerDetails = async (worker) => {
    try {
      setSelectedWorker(worker);
      setShowWorkerModal(true);
    } catch (error) {
      toast.error('Failed to load worker details');
    }
  };

  const renderWeatherIcon = (weatherData) => {
    if (!weatherData) return null;
    if (weatherData.conditions?.includes('rain')) {
      return <CloudIcon className="h-6 w-6 text-blue-500" />;
    }
    return <CloudIcon className="h-6 w-6 text-gray-400" />;
  };

  const getAQIStatus = (aqi) => {
    if (!aqi) return { color: 'gray', label: 'Unknown' };
    if (aqi < 50) return { color: 'green', label: 'Good' };
    if (aqi < 100) return { color: 'yellow', label: 'Moderate' };
    if (aqi < 200) return { color: 'orange', label: 'Poor' };
    return { color: 'red', label: 'Hazardous' };
  };

  const getTrafficStatus = (congestionLevel) => {
    if (!congestionLevel) return { color: 'gray', label: 'Unknown' };
    if (congestionLevel < 3) return { color: 'green', label: 'Light' };
    if (congestionLevel < 6) return { color: 'yellow', label: 'Moderate' };
    if (congestionLevel < 8) return { color: 'orange', label: 'Heavy' };
    return { color: 'red', label: 'Severe' };
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
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Geographic Overview</h1>
        <p className="text-gray-600">Monitor active workers and regional conditions</p>
      </div>

      {regions && regions.length > 0 ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {regions.map((region) => (
            <div key={region.name} className="card">
              <div className="card-header">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <MapPinIcon className="h-6 w-6 text-primary-600 mr-2" />
                    <h3 className="text-lg font-semibold text-gray-900">{region.name}</h3>
                  </div>
                  <span className="badge bg-blue-100 text-blue-800">
                    {region.totalWorkers} Workers
                  </span>
                </div>
              </div>

              <div className="card-content space-y-4">
                {/* Weather Data */}
                {region.weatherData && (
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <div className="flex items-center mb-2">
                      {renderWeatherIcon(region.weatherData)}
                      <span className="font-semibold text-gray-900 ml-2">Weather</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <span className="text-gray-600">Rainfall:</span>
                        <p className="font-medium">{region.weatherData.rainfall || 0} mm/hr</p>
                      </div>
                      <div>
                        <span className="text-gray-600">Wind Speed:</span>
                        <p className="font-medium">{region.weatherData.windSpeed || 0} km/hr</p>
                      </div>
                      <div>
                        <span className="text-gray-600">Conditions:</span>
                        <p className="font-medium">{region.weatherData.conditions || 'N/A'}</p>
                      </div>
                      <div>
                        <span className="text-gray-600">Temperature:</span>
                        <p className="font-medium">{region.weatherData.temperature || 'N/A'}°C</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Pollution Data */}
                {region.pollutionData && (
                  <div className="bg-yellow-50 p-4 rounded-lg">
                    <div className="flex items-center mb-2">
                      <ExclamationTriangleIcon className="h-6 w-6 text-yellow-600 mr-2" />
                      <span className="font-semibold text-gray-900">Air Quality</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <span className="text-gray-600">AQI:</span>
                        <p className={`font-medium text-${getAQIStatus(region.pollutionData.aqi).color}-600`}>
                          {region.pollutionData.aqi} - {getAQIStatus(region.pollutionData.aqi).label}
                        </p>
                      </div>
                      <div>
                        <span className="text-gray-600">PM2.5:</span>
                        <p className="font-medium">{region.pollutionData.pm25 || 0} µg/m³</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Traffic Data */}
                {region.trafficData && (
                  <div className="bg-red-50 p-4 rounded-lg">
                    <div className="flex items-center mb-2">
                      <TruckIcon className="h-6 w-6 text-red-600 mr-2" />
                      <span className="font-semibold text-gray-900">Traffic</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <span className="text-gray-600">Congestion:</span>
                        <p className={`font-medium text-${getTrafficStatus(region.trafficData.congestionLevel).color}-600`}>
                          {region.trafficData.congestionLevel}/10 - {getTrafficStatus(region.trafficData.congestionLevel).label}
                        </p>
                      </div>
                      <div>
                        <span className="text-gray-600">Avg Speed:</span>
                        <p className="font-medium">{region.trafficData.averageSpeed || 0} km/hr</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Active Workers */}
                <div className="border-t pt-4">
                  <h4 className="font-semibold text-gray-900 mb-3">Active Workers</h4>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {region.activeWorkers && region.activeWorkers.length > 0 ? (
                      region.activeWorkers.map((worker) => (
                        <div key={worker.id} className="flex items-center justify-between bg-gray-50 p-3 rounded">
                          <div className="flex-1">
                            <p className="font-medium text-gray-900">{worker.name}</p>
                            <p className="text-sm text-gray-600">{worker.email}</p>
                            <div className="flex items-center mt-1 space-x-2">
                              {worker.premiumPaid ? (
                                <div className="flex items-center text-green-600 text-xs">
                                  <CheckCircleIcon className="h-4 w-4 mr-1" />
                                  Premium Paid
                                </div>
                              ) : (
                                <div className="flex items-center text-red-600 text-xs">
                                  <XCircleIcon className="h-4 w-4 mr-1" />
                                  Premium Due
                                </div>
                              )}
                              <span className="text-xs text-gray-500">
                                Last active: {new Date(worker.lastActive).toLocaleTimeString()}
                              </span>
                            </div>
                          </div>
                          <button
                            onClick={() => handleViewWorkerDetails(worker)}
                            className="ml-2 p-2 hover:bg-gray-200 rounded transition"
                            title="View details"
                          >
                            <EyeIcon className="h-5 w-5 text-primary-600" />
                          </button>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-gray-500">No active workers</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-gray-50 rounded-lg p-8 text-center">
          <p className="text-gray-600">No active workers in any region</p>
        </div>
      )}

      {/* Worker Details Modal */}
      {showWorkerModal && (
        <WorkerDetailsModal
          worker={selectedWorker}
          onClose={() => {
            setShowWorkerModal(false);
            setSelectedWorker(null);
          }}
        />
      )}
    </div>
  );
};

export default AdminGeographic;
