const { Policy, Worker } = require('../models');
const riskAssessmentService = require('../services/riskAssessmentService');
const { v4: uuidv4 } = require('uuid');

// Create new policy for worker
const createPolicy = async (req, res) => {
  try {
    const { coverage, premium } = req.body;
    const workerId = req.worker._id;

    // Get worker data for risk assessment
    const worker = await Worker.findById(workerId);
    if (!worker) {
      return res.status(404).json({
        success: false,
        message: 'Worker not found'
      });
    }

    // Calculate risk score
    const riskAssessment = await riskAssessmentService.calculateBaseRiskScore(worker);
    
    // Calculate dynamic premium
    const premiumCalculation = riskAssessmentService.calculateDynamicPremium(
      premium.baseAmount || 20,
      riskAssessment.riskScore,
      worker
    );

    // Create policy
    const policy = new Policy({
      workerId,
      policyNumber: `GS-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`,
      coverage: {
        ...coverage,
        coverageZones: worker.workInfo.preferredWorkingZones.map(zone => ({
          name: zone.name,
          coordinates: zone.coordinates,
          radius: zone.radius || 5
        })),
        coverageHours: worker.workInfo.typicalWorkingHours
      },
      premium: {
        baseAmount: premiumCalculation.basePremium,
        riskAdjustedAmount: premiumCalculation.riskAdjustedPremium,
        finalAmount: premiumCalculation.finalPremium,
        paymentFrequency: premium.paymentFrequency || 'weekly',
        nextPaymentDue: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
        discounts: premiumCalculation.totalDiscount > 0 ? [{
          type: 'no_claims',
          percentage: premiumCalculation.totalDiscount,
          validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
        }] : []
      },
      status: {
        current: 'pending',
        activatedAt: null,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 1 week validity
      },
      monitoring: {
        isActive: true,
        monitoringZones: worker.workInfo.preferredWorkingZones.map(zone => ({
          coordinates: zone.coordinates,
          radius: zone.radius || 5,
          priority: 'medium'
        }))
      },
      fraudDetection: {
        riskScore: riskAssessment.riskScore,
        lastAssessment: new Date()
      }
    });

    await policy.save();

    // Update worker risk profile
    await riskAssessmentService.updateWorkerRiskProfile(workerId, {
      riskScore: riskAssessment.riskScore,
      locationRiskFactors: riskAssessment.riskFactors
    });

    res.status(201).json({
      success: true,
      message: 'Policy created successfully',
      data: {
        policy,
        riskAssessment,
        premiumCalculation
      }
    });
  } catch (error) {
    console.error('Create policy error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create policy'
    });
  }
};

// Get worker policies
const getWorkerPolicies = async (req, res) => {
  try {
    const workerId = req.worker._id;
    const { status, limit = 10, page = 1 } = req.query;

    const query = { workerId };
    if (status) {
      query['status.current'] = status;
    }

    const policies = await Policy.find(query)
      .sort({ 'metadata.createdAt': -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .populate('workerId', 'personalInfo.firstName personalInfo.lastName personalInfo.email');

    const total = await Policy.countDocuments(query);

    res.json({
      success: true,
      data: {
        policies,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    console.error('Get worker policies error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch policies'
    });
  }
};

// Get policy by ID
const getPolicyById = async (req, res) => {
  try {
    const { policyId } = req.params;
    const workerId = req.worker._id;

    const policy = await Policy.findOne({ _id: policyId, workerId })
      .populate('workerId', 'personalInfo.firstName personalInfo.lastName personalInfo.email');

    if (!policy) {
      return res.status(404).json({
        success: false,
        message: 'Policy not found'
      });
    }

    res.json({
      success: true,
      data: policy
    });
  } catch (error) {
    console.error('Get policy by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch policy'
    });
  }
};

// Update policy
const updatePolicy = async (req, res) => {
  try {
    const { policyId } = req.params;
    const workerId = req.worker._id;
    const updates = req.body;

    const policy = await Policy.findOne({ _id: policyId, workerId });
    if (!policy) {
      return res.status(404).json({
        success: false,
        message: 'Policy not found'
      });
    }

    // Only allow certain fields to be updated
    const allowedUpdates = ['coverage.coveredRisks', 'coverage.maxPayoutPerClaim', 'coverage.maxPayoutPerWeek'];
    const actualUpdates = {};

    Object.keys(updates).forEach(key => {
      if (allowedUpdates.includes(key)) {
        actualUpdates[key] = updates[key];
      }
    });

    Object.assign(policy, actualUpdates);
    policy.metadata.updatedAt = new Date();

    await policy.save();

    res.json({
      success: true,
      message: 'Policy updated successfully',
      data: policy
    });
  } catch (error) {
    console.error('Update policy error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update policy'
    });
  }
};

// Activate policy (after payment)
const activatePolicy = async (req, res) => {
  try {
    const { policyId } = req.params;
    const workerId = req.worker._id;

    const policy = await Policy.findOne({ _id: policyId, workerId });
    if (!policy) {
      return res.status(404).json({
        success: false,
        message: 'Policy not found'
      });
    }

    if (policy.status.current === 'active') {
      return res.status(400).json({
        success: false,
        message: 'Policy is already active'
      });
    }

    // Update policy status
    policy.status.current = 'active';
    policy.status.activatedAt = new Date();
    policy.status.expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 1 week from now
    policy.status.lastPaymentAt = new Date();
    policy.premium.nextPaymentDue = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    // Update worker subscription status
    const worker = await Worker.findById(workerId);
    worker.status.subscriptionStatus = 'active';
    await worker.save();

    await policy.save();

    res.json({
      success: true,
      message: 'Policy activated successfully',
      data: policy
    });
  } catch (error) {
    console.error('Activate policy error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to activate policy'
    });
  }
};

// Cancel policy
const cancelPolicy = async (req, res) => {
  try {
    const { policyId } = req.params;
    const workerId = req.worker._id;

    const policy = await Policy.findOne({ _id: policyId, workerId });
    if (!policy) {
      return res.status(404).json({
        success: false,
        message: 'Policy not found'
      });
    }

    if (policy.status.current === 'expired') {
      return res.status(400).json({
        success: false,
        message: 'Cannot cancel expired policy'
      });
    }

    policy.status.current = 'inactive';
    policy.monitoring.isActive = false;
    policy.metadata.updatedAt = new Date();

    await policy.save();

    res.json({
      success: true,
      message: 'Policy cancelled successfully',
      data: policy
    });
  } catch (error) {
    console.error('Cancel policy error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to cancel policy'
    });
  }
};

// Get policy analytics
const getPolicyAnalytics = async (req, res) => {
  try {
    const workerId = req.worker._id;

    const policies = await Policy.find({ workerId });
    const activePolicies = policies.filter(p => p.status.current === 'active');
    const expiredPolicies = policies.filter(p => p.status.current === 'expired');

    const totalPremiumPaid = policies.reduce((sum, p) => sum + p.premium.finalAmount, 0);
    const totalClaims = policies.reduce((sum, p) => sum + p.claims.totalClaims, 0);
    const totalPayouts = policies.reduce((sum, p) => sum + p.claims.totalPayoutAmount, 0);

    const analytics = {
      totalPolicies: policies.length,
      activePolicies: activePolicies.length,
      expiredPolicies: expiredPolicies.length,
      totalPremiumPaid,
      totalClaims,
      totalPayouts,
      averageClaimAmount: totalClaims > 0 ? totalPayouts / totalClaims : 0,
      roi: totalPremiumPaid > 0 ? ((totalPayouts / totalPremiumPaid) * 100).toFixed(2) : 0
    };

    res.json({
      success: true,
      data: analytics
    });
  } catch (error) {
    console.error('Get policy analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch policy analytics'
    });
  }
};

// Admin: Get all policies
const getAllPolicies = async (req, res) => {
  try {
    const { status, limit = 20, page = 1, workerId } = req.query;

    const query = {};
    if (status) query['status.current'] = status;
    if (workerId) query.workerId = workerId;

    const policies = await Policy.find(query)
      .sort({ 'metadata.createdAt': -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .populate('workerId', 'personalInfo.firstName personalInfo.lastName personalInfo.email');

    const total = await Policy.countDocuments(query);

    res.json({
      success: true,
      data: {
        policies,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    console.error('Get all policies error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch policies'
    });
  }
};

module.exports = {
  createPolicy,
  getWorkerPolicies,
  getPolicyById,
  updatePolicy,
  activatePolicy,
  cancelPolicy,
  getPolicyAnalytics,
  getAllPolicies
};
