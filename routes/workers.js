const express = require('express');
const router = express.Router();
const { Worker, Policy, ActivityLog } = require('../models');
const { authenticateWorker, authenticateAdmin, authorize } = require('../middleware/auth');
const riskAssessmentService = require('../services/riskAssessmentService');

const PREMIUM_TIERS = {
  basic: {
    label: 'Basic',
    baseWeeklyAmount: 20,
    weeklyCoverageLimit: 2000,
    maxPayoutPerClaim: 500
  },
  medium: {
    label: 'Medium',
    baseWeeklyAmount: 35,
    weeklyCoverageLimit: 3500,
    maxPayoutPerClaim: 850
  },
  high: {
    label: 'High',
    baseWeeklyAmount: 50,
    weeklyCoverageLimit: 5000,
    maxPayoutPerClaim: 1200
  }
};

const CITY_RISK_OVERRIDES = {
  mumbai: { weather: 0.22, pollution: 0.09, traffic: 0.18 },
  chennai: { weather: 0.2, pollution: 0.08, traffic: 0.14 },
  delhi: { weather: 0.08, pollution: 0.24, traffic: 0.19 },
  bangalore: { weather: 0.1, pollution: 0.1, traffic: 0.2 },
  bengaluru: { weather: 0.1, pollution: 0.1, traffic: 0.2 },
  hyderabad: { weather: 0.09, pollution: 0.1, traffic: 0.16 },
  kolkata: { weather: 0.16, pollution: 0.14, traffic: 0.14 },
  pune: { weather: 0.08, pollution: 0.09, traffic: 0.15 }
};

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function roundToNearestFive(value) {
  return Math.max(5, Math.round(value / 5) * 5);
}

function computeDynamicPricing(worker) {
  const city = (worker.personalInfo?.address?.city || worker.locationTracking?.workingRegion || '').trim().toLowerCase();
  const cityRisk = CITY_RISK_OVERRIDES[city] || { weather: 0.1, pollution: 0.08, traffic: 0.12 };
  const hours = worker.workInfo?.platforms?.[0]?.averageWeeklyHours || 40;
  const earnings = worker.workInfo?.platforms?.[0]?.averageDailyEarnings || worker.financialInfo?.weeklyIncomeRange?.max / 5 || 500;
  const zoneCount = Math.max(1, worker.workInfo?.preferredWorkingZones?.length || 1);
  const baseRiskScore = clamp(worker.riskProfile?.baseRiskScore ?? 0.5, 0, 1);
  const locationRiskFactors = worker.riskProfile?.locationRiskFactors || {};

  const weatherRisk = clamp(cityRisk.weather + (locationRiskFactors.floodRisk || 0) * 0.35, 0, 0.35);
  const pollutionRisk = clamp(cityRisk.pollution + (locationRiskFactors.pollutionRisk || 0) * 0.35, 0, 0.3);
  const trafficRisk = clamp(cityRisk.traffic + (locationRiskFactors.trafficRisk || 0) * 0.35, 0, 0.3);
  const incomeLoad = clamp((earnings - 500) / 2500, 0, 0.22);
  const workIntensity = clamp((hours - 35) / 45, 0, 0.18);
  const zoneSpread = clamp((zoneCount - 1) * 0.03, 0, 0.12);
  const workerRisk = clamp(baseRiskScore * 0.18, 0, 0.18);

  const totalRiskLoad = clamp(
    weatherRisk + pollutionRisk + trafficRisk + incomeLoad + workIntensity + zoneSpread + workerRisk,
    0,
    0.85
  );
  const riskMultiplier = 1 + totalRiskLoad;

  const reasons = [
    { label: 'Weather exposure', impact: weatherRisk },
    { label: 'Pollution exposure', impact: pollutionRisk },
    { label: 'Traffic exposure', impact: trafficRisk },
    { label: 'Income dependence', impact: incomeLoad },
    { label: 'Work intensity', impact: workIntensity },
    { label: 'Zone spread', impact: zoneSpread },
    { label: 'Worker risk score', impact: workerRisk }
  ]
    .filter((item) => item.impact > 0.01)
    .sort((a, b) => b.impact - a.impact)
    .slice(0, 4)
    .map((item) => ({
      label: item.label,
      impactPercent: Math.round(item.impact * 100)
    }));

  return {
    city: worker.personalInfo?.address?.city || worker.locationTracking?.workingRegion || 'Primary zone',
    riskMultiplier: Number(riskMultiplier.toFixed(2)),
    riskLoadPercent: Math.round(totalRiskLoad * 100),
    drivers: reasons,
    scorecard: {
      weatherRisk: Math.round(weatherRisk * 100),
      pollutionRisk: Math.round(pollutionRisk * 100),
      trafficRisk: Math.round(trafficRisk * 100),
      incomeLoad: Math.round(incomeLoad * 100),
      workIntensity: Math.round(workIntensity * 100)
    }
  };
}

function buildDynamicPremiumTiers(worker) {
  const pricing = computeDynamicPricing(worker);
  const availableTiers = Object.entries(PREMIUM_TIERS).reduce((acc, [tierKey, tier]) => {
    const dynamicAmount = roundToNearestFive(tier.baseWeeklyAmount * pricing.riskMultiplier);
    acc[tierKey] = {
      ...tier,
      weeklyAmount: dynamicAmount,
      baseWeeklyAmount: tier.baseWeeklyAmount,
      riskAdjustedAmount: dynamicAmount,
      pricingModel: {
        type: 'dynamic',
        riskMultiplier: pricing.riskMultiplier,
        riskLoadPercent: pricing.riskLoadPercent,
        city: pricing.city,
        drivers: pricing.drivers
      }
    };
    return acc;
  }, {});

  return {
    availableTiers,
    pricing
  };
}

async function ensureWorkerCoveragePolicy(worker, selectedTier) {
  await Policy.updateMany(
    { workerId: worker._id, 'status.current': 'active' },
    { $set: { 'status.current': 'inactive', 'monitoring.isActive': false, 'metadata.updatedAt': new Date() } }
  );

  const coverageZone = {
    name: worker.locationTracking?.workingRegion || worker.personalInfo?.address?.city || 'Primary Work Zone',
    coordinates: {
      latitude: worker.locationTracking?.currentLocation?.latitude ?? worker.personalInfo.address.coordinates.latitude,
      longitude: worker.locationTracking?.currentLocation?.longitude ?? worker.personalInfo.address.coordinates.longitude,
      radius: 5
    }
  };

  const coveredRisks = [
    {
      type: 'extreme_weather',
      isActive: true,
      thresholds: {
        weather: {
          rainfall: 15,
          windSpeed: 50,
          temperature: 42
        }
      }
    },
    {
      type: 'high_pollution',
      isActive: true,
      thresholds: {
        pollution: {
          aqi: 400,
          pm25: 250
        }
      }
    },
    {
      type: 'traffic_congestion',
      isActive: true,
      thresholds: {
        traffic: {
          congestionLevel: 8,
          averageSpeed: 5
        }
      }
    }
  ];

  let policy = await Policy.findOne({ workerId: worker._id }).sort({ createdAt: -1 });

  if (!policy) {
    policy = new Policy({
      workerId: worker._id,
      policyNumber: `FMP-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
      policyType: 'weekly',
      coverage: {
        coveredRisks,
        maxPayoutPerClaim: selectedTier.maxPayoutPerClaim,
        maxPayoutPerWeek: selectedTier.weeklyCoverageLimit,
        deductible: 0,
        coverageHours: worker.workInfo?.typicalWorkingHours || { start: '08:00', end: '20:00' },
        coverageZones: [coverageZone]
      },
      premium: {
        baseAmount: selectedTier.baseWeeklyAmount,
        riskAdjustedAmount: selectedTier.riskAdjustedAmount || selectedTier.weeklyAmount,
        finalAmount: selectedTier.weeklyAmount,
        paymentFrequency: 'weekly',
        nextPaymentDue: worker.premium.nextPaymentDue
      },
      status: {
        current: 'active',
        activatedAt: new Date(),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        lastPaymentAt: new Date()
      },
      monitoring: {
        isActive: true,
        lastMonitoredAt: new Date(),
        monitoringZones: [{
          coordinates: coverageZone.coordinates,
          radius: coverageZone.coordinates.radius,
          priority: 'high'
        }]
      }
    });
  } else {
    policy.coverage.coveredRisks = coveredRisks;
    policy.coverage.maxPayoutPerClaim = selectedTier.maxPayoutPerClaim;
    policy.coverage.maxPayoutPerWeek = selectedTier.weeklyCoverageLimit;
    policy.coverage.coverageHours = worker.workInfo?.typicalWorkingHours || policy.coverage.coverageHours;
    policy.coverage.coverageZones = [coverageZone];
    policy.premium.baseAmount = selectedTier.baseWeeklyAmount;
    policy.premium.riskAdjustedAmount = selectedTier.riskAdjustedAmount || selectedTier.weeklyAmount;
    policy.premium.finalAmount = selectedTier.weeklyAmount;
    policy.premium.nextPaymentDue = worker.premium.nextPaymentDue;
    policy.status.current = 'active';
    policy.status.activatedAt = policy.status.activatedAt || new Date();
    policy.status.expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    policy.status.lastPaymentAt = new Date();
    policy.monitoring.isActive = true;
    policy.monitoring.lastMonitoredAt = new Date();
    policy.monitoring.monitoringZones = [{
      coordinates: coverageZone.coordinates,
      radius: coverageZone.coordinates.radius,
      priority: 'high'
    }];
  }

  await policy.save();
  return policy;
}

// Get worker profile
router.get('/profile', authenticateWorker, async (req, res) => {
  try {
    const worker = await Worker.findById(req.worker._id).select('-security.password');
    
    res.json({
      success: true,
      data: worker
    });
  } catch (error) {
    console.error('Get worker profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch profile'
    });
  }
});

// Update worker profile
router.put('/profile', authenticateWorker, async (req, res) => {
  try {
    const updates = req.body;
    const workerId = req.worker._id;

    // Only allow certain fields to be updated
    const allowedUpdates = [
      'personalInfo.firstName',
      'personalInfo.lastName',
      'personalInfo.phone',
      'workInfo.platforms',
      'workInfo.preferredWorkingZones',
      'workInfo.typicalWorkingHours',
      'financialInfo.weeklyIncomeRange'
    ];

    const updateObj = {};
    Object.keys(updates).forEach(key => {
      if (allowedUpdates.includes(key)) {
        updateObj[key] = updates[key];
      }
    });

    const worker = await Worker.findByIdAndUpdate(
      workerId,
      { $set: updateObj, 'metadata.updatedAt': new Date() },
      { new: true, runValidators: true }
    ).select('-security.password');

    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: worker
    });
  } catch (error) {
    console.error('Update worker profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update profile'
    });
  }
});

// Admin: Get all workers
router.get('/admin/all', authenticateAdmin, authorize(['view_workers']), async (req, res) => {
  try {
    const { status, limit = 20, page = 1 } = req.query;

    const query = {};
    if (status) query['status.accountStatus'] = status;

    const workers = await Worker.find(query)
      .sort({ 'metadata.registeredAt': -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .select('-security.password');

    const total = await Worker.countDocuments(query);

    res.json({
      success: true,
      data: {
        workers,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    console.error('Get all workers error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch workers'
    });
  }
});

// Admin: Get worker by ID
router.get('/admin/:workerId', authenticateAdmin, authorize(['view_workers']), async (req, res) => {
  try {
    const { workerId } = req.params;

    const worker = await Worker.findById(workerId).select('-security.password');

    if (!worker) {
      return res.status(404).json({
        success: false,
        message: 'Worker not found'
      });
    }

    res.json({
      success: true,
      data: worker
    });
  } catch (error) {
    console.error('Get worker by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch worker'
    });
  }
});

// Admin: Update worker status
router.put('/admin/:workerId/status', authenticateAdmin, authorize(['edit_workers']), async (req, res) => {
  try {
    const { workerId } = req.params;
    const { accountStatus, subscriptionStatus } = req.body;

    const updateObj = {};
    if (accountStatus) updateObj['status.accountStatus'] = accountStatus;
    if (subscriptionStatus) updateObj['status.subscriptionStatus'] = subscriptionStatus;
    updateObj['metadata.updatedAt'] = new Date();

    const worker = await Worker.findByIdAndUpdate(
      workerId,
      { $set: updateObj },
      { new: true, runValidators: true }
    ).select('-security.password');

    if (!worker) {
      return res.status(404).json({
        success: false,
        message: 'Worker not found'
      });
    }

    res.json({
      success: true,
      message: 'Worker status updated successfully',
      data: worker
    });
  } catch (error) {
    console.error('Update worker status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update worker status'
    });
  }
});

// Worker: Update current location
router.put('/location', authenticateWorker, async (req, res) => {
  try {
    const { latitude, longitude, address, city, state, workingRegion, isActive } = req.body;
    const workerId = req.worker._id;

    const updateObj = {
      'locationTracking.currentLocation': {
        latitude,
        longitude,
        address,
        city,
        state,
        lastUpdated: new Date()
      },
      'metadata.lastActivityTime': new Date()
    };

    if (workingRegion) updateObj['locationTracking.workingRegion'] = workingRegion;
    if (typeof isActive === 'boolean') updateObj['locationTracking.isActive'] = isActive;

    const worker = await Worker.findByIdAndUpdate(
      workerId,
      { $set: updateObj },
      { new: true }
    ).select('-security.password');

    res.json({
      success: true,
      message: 'Location updated successfully',
      data: worker
    });
  } catch (error) {
    console.error('Update location error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update location'
    });
  }
});

// Worker: Check weekly premium status
router.get('/premium/status', authenticateWorker, async (req, res) => {
  try {
    const workerId = req.worker._id;
    const worker = await Worker.findById(workerId).select('premium status personalInfo workInfo financialInfo riskProfile locationTracking').lean();

    if (!worker) {
      return res.status(404).json({
        success: false,
        message: 'Worker not found'
      });
    }

    const today = new Date();
    const weekNumber = getISO8601WeekNumber(today);
    const isOverdue = worker.premium.nextPaymentDue && new Date(worker.premium.nextPaymentDue) < today;
    const canClaimInsurance = Boolean(worker.premium.currentWeekPaid) && worker.status.subscriptionStatus === 'active' && !isOverdue;
    const { availableTiers, pricing } = buildDynamicPremiumTiers(worker);
    const currentTier = availableTiers[worker.premium.planType || 'basic'] || availableTiers.basic;
    const riskPrediction = await riskAssessmentService.getWorkerRiskPrediction(worker);
    const premiumForecast = await riskAssessmentService.calculatePremiumWithForecast(
      worker.premium.weeklyAmount || currentTier.weeklyAmount,
      worker
    );
    
    res.json({
      success: true,
      data: {
        currentWeekPaid: worker.premium.currentWeekPaid,
        weekNumber,
        planType: worker.premium.planType || 'basic',
        weeklyAmount: worker.premium.weeklyAmount || currentTier.weeklyAmount,
        weeklyCoverageLimit: worker.premium.weeklyCoverageLimit || currentTier.weeklyCoverageLimit,
        termsAcceptedAt: worker.premium.termsAcceptedAt,
        nextPaymentDue: worker.premium.nextPaymentDue,
        lastPaymentDate: worker.premium.lastPaymentDate,
        missedPayments: worker.premium.missedPayments,
        totalPaid: worker.premium.totalPaid || 0,
        paymentHistory: worker.premium.paymentHistory || [],
        subscriptionStatus: worker.status.subscriptionStatus,
        canClaimInsurance,
        availableTiers,
        dynamicPricing: pricing,
        riskPrediction,
        premiumRecommendation: premiumForecast.premiumRecommendation,
        recommendedWeeklyAmount: premiumForecast.finalPremium,
        forecastMultiplier: premiumForecast.forecastMultiplier
      }
    });
  } catch (error) {
    console.error('Check premium status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check premium status'
    });
  }
});

// Worker: Pay weekly premium
router.post('/premium/pay-weekly', authenticateWorker, async (req, res) => {
  try {
    const workerId = req.worker._id;
    const { paymentMethod, transactionId, amount, planType = 'basic', acceptedTerms } = req.body;
    const worker = await Worker.findById(workerId);

    if (!worker) {
      return res.status(404).json({
        success: false,
        message: 'Worker not found'
      });
    }

    if (!acceptedTerms) {
      return res.status(400).json({
        success: false,
        message: 'Please accept the coverage terms before payment'
      });
    }

    const { availableTiers, pricing } = buildDynamicPremiumTiers(worker);
    const selectedTier = availableTiers[planType];
    if (!selectedTier) {
      return res.status(400).json({
        success: false,
        message: 'Invalid weekly premium tier selected'
      });
    }

    if (amount !== selectedTier.weeklyAmount) {
      return res.status(400).json({
        success: false,
        message: 'Payment amount does not match weekly premium'
      });
    }

    const today = new Date();
    const weekNumber = getISO8601WeekNumber(today);

    // Record payment
    worker.premium.paymentHistory.push({
      weekNumber,
      planType,
      amount,
      paymentDate: new Date(),
      status: 'paid',
      paymentMethod,
      transactionId,
      termsAcceptedAt: new Date()
    });

    // Update payment status and activate subscription coverage
    worker.premium.planType = planType;
    worker.premium.weeklyAmount = selectedTier.weeklyAmount;
    worker.premium.weeklyCoverageLimit = selectedTier.weeklyCoverageLimit;
    worker.premium.termsAcceptedAt = new Date();
    worker.premium.currentWeekPaid = true;
    worker.premium.lastPaymentDate = new Date();
    worker.premium.totalPaid += amount;
    worker.status.subscriptionStatus = 'active';

    // Set next payment due to next week
    const nextWeekDate = new Date(today);
    nextWeekDate.setDate(nextWeekDate.getDate() + 7);
    worker.premium.nextPaymentDue = nextWeekDate;

    await worker.save();
    await ensureWorkerCoveragePolicy(worker, selectedTier);

    await Policy.updateMany(
      { workerId: workerId, 'status.current': { $in: ['inactive', 'pending', 'active'] } },
      {
        $set: {
          'status.current': 'active',
          'status.activatedAt': new Date(),
          'status.lastPaymentAt': new Date(),
          'premium.baseAmount': selectedTier.baseWeeklyAmount,
          'premium.riskAdjustedAmount': selectedTier.riskAdjustedAmount || selectedTier.weeklyAmount,
          'premium.finalAmount': selectedTier.weeklyAmount,
          'coverage.maxPayoutPerWeek': selectedTier.weeklyCoverageLimit,
          'coverage.maxPayoutPerClaim': selectedTier.maxPayoutPerClaim,
          'metadata.updatedAt': new Date()
        }
      }
    );

    res.json({
      success: true,
      message: 'Weekly premium paid successfully',
      data: {
        transactionId,
        amount,
        planType,
        weeklyCoverageLimit: selectedTier.weeklyCoverageLimit,
        pricingModel: pricing,
        paymentDate: new Date(),
        nextPaymentDue: nextWeekDate,
        canClaimInsurance: true
      }
    });
  } catch (error) {
    console.error('Pay weekly premium error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to process premium payment'
    });
  }
});

// Worker: Activity anchoring scan (package scan/heartbeat)
router.post('/activity/scan', authenticateWorker, async (req, res) => {
  try {
    const workerId = req.worker._id;
    const { platform = 'unknown', eventType = 'scan', latitude, longitude, isWorking = true } = req.body;

    const activityLog = await ActivityLog.create({
      workerId,
      platform,
      eventType,
      isWorking,
      location: { latitude, longitude }
    });

    await Worker.findByIdAndUpdate(workerId, {
      $set: {
        'metadata.lastActivityTime': new Date(),
        'locationTracking.isActive': Boolean(isWorking)
      }
    });

    res.status(201).json({
      success: true,
      message: 'Activity scan recorded',
      data: activityLog
    });
  } catch (error) {
    console.error('Record activity scan error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to record activity scan'
    });
  }
});

// Helper function to get ISO 8601 week number
function getISO8601WeekNumber(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNum = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNum).padStart(2, '0')}`;
}

module.exports = router;
