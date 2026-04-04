const express = require('express');
const router = express.Router();
const { Admin } = require('../models');
const { authenticateAdmin, authorize } = require('../middleware/auth');

// Get admin profile
router.get('/profile', authenticateAdmin, async (req, res) => {
  try {
    const admin = await Admin.findById(req.admin._id).select('-security.password');
    
    res.json({
      success: true,
      data: admin
    });
  } catch (error) {
    console.error('Get admin profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch profile'
    });
  }
});

// Update admin profile
router.put('/profile', authenticateAdmin, async (req, res) => {
  try {
    const updates = req.body;
    const adminId = req.admin._id;

    // Only allow certain fields to be updated
    const allowedUpdates = [
      'personalInfo.firstName',
      'personalInfo.lastName',
      'personalInfo.phone',
      'preferences'
    ];

    const updateObj = {};
    Object.keys(updates).forEach(key => {
      if (allowedUpdates.includes(key)) {
        updateObj[key] = updates[key];
      }
    });

    const admin = await Admin.findByIdAndUpdate(
      adminId,
      { $set: updateObj, 'metadata.updatedAt': new Date() },
      { new: true, runValidators: true }
    ).select('-security.password');

    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: admin
    });
  } catch (error) {
    console.error('Update admin profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update profile'
    });
  }
});

// Get dashboard statistics
router.get('/dashboard/stats', authenticateAdmin, async (req, res) => {
  try {
    const { Worker, Policy, Claim } = require('../models');

    const stats = {
      totalWorkers: await Worker.countDocuments(),
      activeWorkers: await Worker.countDocuments({ 'status.subscriptionStatus': 'active' }),
      totalPolicies: await Policy.countDocuments(),
      activePolicies: await Policy.countDocuments({ 'status.current': 'active' }),
      totalClaims: await Claim.countDocuments(),
      pendingClaims: await Claim.countDocuments({ 'status.current': 'initiated' }),
      approvedClaims: await Claim.countDocuments({ 'status.current': { $in: ['approved', 'paid'] } }),
      rejectedClaims: await Claim.countDocuments({ 'status.current': 'rejected' }),
      totalPayoutAmount: await Claim.aggregate([
        { $match: { 'financial.payoutStatus': 'completed' } },
        { $group: { _id: null, total: { $sum: '$financial.payoutAmount' } } }
      ]).then(result => result[0]?.total || 0)
    };

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Get dashboard stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch dashboard statistics'
    });
  }
});

// Get all admins (super admin only)
router.get('/all', authenticateAdmin, authorize(['edit_admins']), async (req, res) => {
  try {
    const { limit = 20, page = 1 } = req.query;

    const admins = await Admin.find()
      .sort({ 'metadata.createdAt': -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .select('-security.password');

    const total = await Admin.countDocuments();

    res.json({
      success: true,
      data: {
        admins,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    console.error('Get all admins error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch admins'
    });
  }
});

// Get geographic overview with worker locations and weather data
router.get('/geographic-overview', authenticateAdmin, async (req, res) => {
  try {
    const { Worker, MonitoringData } = require('../models');
    
    // Get all active workers with location data
    const activeWorkers = await Worker.find(
      { 'status.accountStatus': 'active', 'locationTracking.isActive': true },
      {
        'personalInfo.firstName': 1,
        'personalInfo.lastName': 1,
        'personalInfo.email': 1,
        'personalInfo.phone': 1,
        'locationTracking': 1,
        'premium.currentWeekPaid': 1,
        'metadata.lastActivityTime': 1,
        'status.accountStatus': 1
      }
    ).lean();

    // Get latest monitoring data for each region
    const recentMonitoring = await MonitoringData.find(
      { 'metadata.timestamp': { $gte: new Date(Date.now() - 3600000) } } // Last 1 hour
    ).sort({ 'metadata.timestamp': -1 }).lean();

    // Organize data by region
    const regionData = {};
    
    activeWorkers.forEach(worker => {
      const city = worker.locationTracking?.city || 'Unknown';
      const region = worker.locationTracking?.workingRegion || city;
      
      if (!regionData[region]) {
        regionData[region] = {
          name: region,
          activeWorkers: [],
          weatherData: null,
          pollutionData: null,
          trafficData: null,
          totalWorkers: 0
        };
      }
      
      regionData[region].activeWorkers.push({
        id: worker._id,
        name: `${worker.personalInfo.firstName} ${worker.personalInfo.lastName}`,
        email: worker.personalInfo.email,
        phone: worker.personalInfo.phone,
        location: worker.locationTracking.currentLocation,
        premiumPaid: worker.premium.currentWeekPaid,
        lastActive: worker.metadata.lastActivityTime,
        status: worker.status.accountStatus
      });
      regionData[region].totalWorkers++;
    });

    // Add latest monitoring data to regions
    recentMonitoring.forEach(data => {
      const city = data.source?.region?.city || 'Unknown';
      if (regionData[city]) {
        if (data.data.weather) regionData[city].weatherData = data.data.weather;
        if (data.data.pollution) regionData[city].pollutionData = data.data.pollution;
        if (data.data.traffic) regionData[city].trafficData = data.data.traffic;
      }
    });

    res.json({
      success: true,
      data: Object.values(regionData)
    });
  } catch (error) {
    console.error('Get geographic overview error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch geographic overview'
    });
  }
});

// Get detailed worker information
router.get('/worker-details/:workerId', authenticateAdmin, async (req, res) => {
  try {
    const { Worker, Policy, MonitoringData } = require('../models');
    const { workerId } = req.params;

    const worker = await Worker.findById(workerId).select('-security.password').lean();
    if (!worker) {
      return res.status(404).json({
        success: false,
        message: 'Worker not found'
      });
    }

    const policies = await Policy.find({ workerId }).sort({ createdAt: -1 }).lean();
    const currentPolicy = policies.find((policy) => policy.status?.current === 'active') || policies[0] || null;
    const policySummary = {
      totalPolicies: policies.length,
      activePolicies: policies.filter((policy) => policy.status?.current === 'active').length,
      inactivePolicies: policies.filter((policy) => policy.status?.current !== 'active').length
    };

    const { Claim } = require('../models');
    const recentClaims = await Claim.find({ workerId })
      .sort({ 'metadata.createdAt': -1 })
      .limit(5)
      .populate('policyId', 'policyNumber')
      .lean();

    // Get latest monitoring data for worker's location
    const location = typeof worker.locationTracking?.currentLocation?.latitude === 'number' &&
      typeof worker.locationTracking?.currentLocation?.longitude === 'number'
      ? {
          latitude: worker.locationTracking.currentLocation.latitude,
          longitude: worker.locationTracking.currentLocation.longitude
        }
      : worker.personalInfo?.address?.coordinates;

    const latestMonitoring = location
      ? await MonitoringData.findLatestForLocation('weather', location, 180)
      : [];

    // Format premium payment history
    const premiumStatus = {
      weeklyAmount: worker.premium.weeklyAmount,
      currentWeekPaid: worker.premium.currentWeekPaid,
      lastPaymentDate: worker.premium.lastPaymentDate,
      nextPaymentDue: worker.premium.nextPaymentDue,
      totalPaid: worker.premium.totalPaid,
      missedPayments: worker.premium.missedPayments,
      paymentHistory: worker.premium.paymentHistory.slice(-4) // Last 4 weeks
    };

    res.json({
      success: true,
      data: {
        worker: {
          id: worker._id,
          name: `${worker.personalInfo.firstName} ${worker.personalInfo.lastName}`,
          email: worker.personalInfo.email,
          phone: worker.personalInfo.phone,
          personalInfo: worker.personalInfo,
          status: worker.status.accountStatus,
          subscriptionStatus: worker.status.subscriptionStatus,
          lastActive: worker.metadata.lastActivityTime,
          location: worker.locationTracking,
          riskProfile: worker.riskProfile,
          workInfo: worker.workInfo,
          financialInfo: worker.financialInfo,
          verification: worker.verification,
          premium: worker.premium,
          metadata: worker.metadata
        },
        currentPolicy,
        policySummary,
        policies,
        premiumStatus,
        recentClaims,
        currentWeather: latestMonitoring?.[0]?.data || null
      }
    });
  } catch (error) {
    console.error('Get worker details error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch worker details'
    });
  }
});

// Create admin (super admin only)
router.post('/', authenticateAdmin, authorize(['edit_admins']), async (req, res) => {
  try {
    const authController = require('../controllers/authController');
    const result = await authController.registerAdmin(req, res);
    return result;
  } catch (error) {
    console.error('Create admin error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create admin'
    });
  }
});

module.exports = router;
