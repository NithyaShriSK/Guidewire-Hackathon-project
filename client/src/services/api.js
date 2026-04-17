import axios from 'axios';

// Create axios instance
const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'http://localhost:5000/api',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle errors
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    if (error.response?.status === 401) {
      // Token expired or invalid
      localStorage.removeItem('token');
      localStorage.removeItem('userType');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Auth API
export const authAPI = {
  loginWorker: (email, password) => api.post('/auth/worker/login', { email, password }),
  loginAdmin: (email, password) => api.post('/auth/admin/login', { email, password }),
  registerWorker: (userData) => api.post('/auth/worker/register', userData),
  registerAdmin: (userData) => api.post('/auth/admin/register', userData),
  getCurrentProfile: () => api.get('/auth/profile'),
  updateWorkInfo: (workInfo) => api.put('/auth/worker/work-info', workInfo),
  updateFinancialInfo: (financialInfo) => api.put('/auth/worker/financial-info', financialInfo),
  completeOnboarding: () => api.post('/auth/worker/complete-onboarding'),
};

// Worker API
export const workerAPI = {
  getProfile: () => api.get('/workers/profile'),
  updateProfile: (profileData) => api.put('/workers/profile', profileData),
  updateLocation: (locationData) => api.put('/workers/location', locationData),
  getPremiumStatus: () => api.get('/workers/premium/status'),
  payWeeklyPremium: (paymentData) => api.post('/workers/premium/pay-weekly', paymentData),
  recordActivityScan: (scanData) => api.post('/workers/activity/scan', scanData),
};

// Policy API
export const policyAPI = {
  createPolicy: (policyData) => api.post('/policies', policyData),
  getWorkerPolicies: (params) => api.get('/policies', { params }),
  getPolicyById: (policyId) => api.get(`/policies/${policyId}`),
  updatePolicy: (policyId, policyData) => api.put(`/policies/${policyId}`, policyData),
  activatePolicy: (policyId) => api.post(`/policies/${policyId}/activate`),
  cancelPolicy: (policyId) => api.post(`/policies/${policyId}/cancel`),
  getPolicyAnalytics: () => api.get('/policies/analytics'),
  getAllPolicies: (params) => api.get('/policies/admin/all', { params }),
};

// Claims API
export const claimAPI = {
  getWorkerClaims: (params) => api.get('/claims', { params }),
  getClaimById: (claimId) => api.get(`/claims/${claimId}`),
  createManualClaim: (claimData) => api.post('/claims', claimData),
  retryPayout: (claimId) => api.post(`/claims/${claimId}/retry-payout`),
  getClaimAnalytics: () => api.get('/claims/analytics'),
  getAllClaims: (params) => api.get('/claims/admin/all', { params }),
  getClaimsForReview: (params) => api.get('/claims/admin/review', { params }),
  reviewClaim: (claimId, reviewData) => api.post(`/claims/admin/${claimId}/review`, reviewData),
  getFraudStatistics: (params) => api.get('/claims/admin/fraud/statistics', { params }),
  analyzeWorker: (workerId) => api.get(`/claims/admin/worker/${workerId}/analyze`),
  getPayoutStatistics: (params) => api.get('/claims/admin/payout/statistics', { params }),
  processBatchPayouts: (claimIds) => api.post('/claims/admin/payout/batch', { claimIds }),
  processRefund: (claimId, refundData) => api.post(`/claims/admin/${claimId}/refund`, refundData),
  getPayoutStatus: (transactionId) => api.get(`/claims/payout/${transactionId}/status`),
};

// Monitoring API
export const monitoringAPI = {
  getCurrentData: (type) => api.get(`/monitoring/current/${type}`),
  startMonitoring: () => api.post('/monitoring/start'),
  stopMonitoring: () => api.post('/monitoring/stop'),
  getMonitoringStatus: () => api.get('/monitoring/status'),
  checkCurrentLocationThreat: (locationData) => api.post('/monitoring/check-current-location', locationData),
  startAllMonitoring: () => api.post('/monitoring/admin/start-all'),
  getLocationData: (type, lat, lng) => api.get(`/monitoring/admin/location/${type}/${lat}/${lng}`),
};

// Admin API
export const adminAPI = {
  getProfile: () => api.get('/admin/profile'),
  updateProfile: (profileData) => api.put('/admin/profile', profileData),
  getDashboardStats: () => api.get('/admin/dashboard/stats'),
  getPredictions: () => api.get('/admin/predictions'),
  getAllWorkers: (params) => api.get('/workers/admin/all', { params }),
  getWorkerById: (workerId) => api.get(`/workers/admin/${workerId}`),
  updateWorkerStatus: (workerId, statusData) => api.put(`/workers/admin/${workerId}/status`, statusData),
  getAllAdmins: (params) => api.get('/admin/all', { params }),
  createAdmin: (adminData) => api.post('/admin', adminData),
  getGeographicOverview: () => api.get('/admin/geographic-overview'),
  getWorkerDetails: (workerId) => api.get(`/admin/worker-details/${workerId}`),
};

// Simulation API
export const simulationAPI = {
  simulateWeather: (simulationData) => api.post('/simulation/weather', simulationData),
  simulatePollution: (simulationData) => api.post('/simulation/pollution', simulationData),
  simulateTraffic: (simulationData) => api.post('/simulation/traffic', simulationData),
  simulateClaim: (claimData) => api.post('/simulation/claim', claimData),
  simulateFraud: (fraudData) => api.post('/simulation/fraud', fraudData),
  getScenarios: () => api.get('/simulation/scenarios'),
  runSimulation: (simulationData) => api.post('/simulation/run', simulationData),
  clearSimulationData: () => api.delete('/simulation/clear'),
};

export default api;
