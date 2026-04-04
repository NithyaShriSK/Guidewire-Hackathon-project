const claimService = require('../services/claimService');
const fraudDetectionService = require('../services/fraudDetectionService');
const payoutService = require('../services/payoutService');

// Get worker claims
const getWorkerClaims = async (req, res) => {
  try {
    const workerId = req.worker._id;
    const { status, limit = 10, page = 1 } = req.query;

    const result = await claimService.getWorkerClaims(workerId, { status, limit, page });

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Get worker claims error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch claims'
    });
  }
};

// Get claim by ID
const getClaimById = async (req, res) => {
  try {
    const { claimId } = req.params;
    const workerId = req.worker._id;

    const claim = await claimService.getClaimById(claimId, workerId);
    
    if (!claim) {
      return res.status(404).json({
        success: false,
        message: 'Claim not found'
      });
    }

    res.json({
      success: true,
      data: claim
    });
  } catch (error) {
    console.error('Get claim by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch claim'
    });
  }
};

// Create manual claim (worker initiated)
const createManualClaim = async (req, res) => {
  return res.status(403).json({
    success: false,
    message: 'Manual claims are disabled. GigShield uses automatic parametric triggering and instant payouts.'
  });
};

// Retry failed payout
const retryPayout = async (req, res) => {
  try {
    const { claimId } = req.params;
    const workerId = req.worker._id;

    const claim = await claimService.getClaimById(claimId, workerId);
    if (!claim) {
      return res.status(404).json({
        success: false,
        message: 'Claim not found'
      });
    }

    const result = await payoutService.retryFailedPayout(claimId);

    res.json({
      success: result.success,
      message: result.success ? 'Payout retry initiated' : 'Payout retry failed',
      data: result
    });
  } catch (error) {
    console.error('Retry payout error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retry payout'
    });
  }
};

// Get claim analytics
const getClaimAnalytics = async (req, res) => {
  try {
    const workerId = req.worker._id;

    const claims = await claimService.getWorkerClaims(workerId, { limit: 1000 });
    const claimList = claims.claims;

    const analytics = {
      totalClaims: claimList.length,
      approvedClaims: claimList.filter(c => ['approved', 'paid'].includes(c.status.current)).length,
      rejectedClaims: claimList.filter(c => c.status.current === 'rejected').length,
      pendingClaims: claimList.filter(c => ['initiated', 'validating', 'under_review'].includes(c.status.current)).length,
      totalPayoutAmount: claimList
        .filter(c => c.financial?.payoutStatus === 'completed')
        .reduce((sum, c) => sum + (c.financial.payoutAmount || 0), 0),
      averageProcessingTime: claimList.length > 0 
        ? claimList.reduce((sum, c) => sum + (c.status.processingTime || 0), 0) / claimList.length 
        : 0,
      claimsByType: claimList.reduce((acc, claim) => {
        acc[claim.trigger.type] = (acc[claim.trigger.type] || 0) + 1;
        return acc;
      }, {})
    };

    res.json({
      success: true,
      data: analytics
    });
  } catch (error) {
    console.error('Get claim analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch claim analytics'
    });
  }
};

// Admin: Get all claims
const getAllClaims = async (req, res) => {
  try {
    const { status, limit = 20, page = 1, workerId } = req.query;

    const Claim = require('../models').Claim;
    const query = {};
    if (status) query['status.current'] = status;
    if (workerId) query.workerId = workerId;

    const claims = await Claim.find(query)
      .sort({ 'metadata.createdAt': -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .populate('policyId', 'policyNumber')
      .populate('workerId', 'personalInfo.firstName personalInfo.lastName personalInfo.email');

    const total = await Claim.countDocuments(query);

    res.json({
      success: true,
      data: {
        claims,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    console.error('Get all claims error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch claims'
    });
  }
};

// Admin: Get claims for review
const getClaimsForReview = async (req, res) => {
  try {
    const { limit = 20, page = 1 } = req.query;

    const result = await claimService.getClaimsForReview({ limit, page });

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Get claims for review error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch claims for review'
    });
  }
};

// Admin: Review claim
const reviewClaim = async (req, res) => {
  try {
    const { claimId } = req.params;
    const { decision, notes } = req.body;
    const adminId = req.admin._id;

    const claim = await claimService.reviewClaim(claimId, adminId, decision, notes);

    res.json({
      success: true,
      message: `Claim ${decision}d successfully`,
      data: claim
    });
  } catch (error) {
    console.error('Review claim error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to review claim'
    });
  }
};

// Admin: Get fraud statistics
const getFraudStatistics = async (req, res) => {
  try {
    const { timeRange = '30d' } = req.query;

    const stats = await fraudDetectionService.getFraudStatistics(timeRange);

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Get fraud statistics error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch fraud statistics'
    });
  }
};

// Admin: Analyze worker
const analyzeWorker = async (req, res) => {
  try {
    const { workerId } = req.params;

    const analysis = await fraudDetectionService.analyzeWorker(workerId);

    res.json({
      success: true,
      data: analysis
    });
  } catch (error) {
    console.error('Analyze worker error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to analyze worker'
    });
  }
};

// Admin: Get payout statistics
const getPayoutStatistics = async (req, res) => {
  try {
    const { timeRange = '30d' } = req.query;

    const stats = await payoutService.getPayoutStatistics(timeRange);

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Get payout statistics error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch payout statistics'
    });
  }
};

// Admin: Process batch payouts
const processBatchPayouts = async (req, res) => {
  try {
    const { claimIds } = req.body;

    if (!claimIds || !Array.isArray(claimIds)) {
      return res.status(400).json({
        success: false,
        message: 'Claim IDs array is required'
      });
    }

    const results = await payoutService.processBatchPayouts(claimIds);

    res.json({
      success: true,
      message: 'Batch payout processing completed',
      data: results
    });
  } catch (error) {
    console.error('Process batch payouts error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to process batch payouts'
    });
  }
};

// Admin: Process refund
const processRefund = async (req, res) => {
  try {
    const { claimId } = req.params;
    const { reason } = req.body;

    const result = await payoutService.processRefund(claimId, reason);

    res.json({
      success: result.success,
      message: result.success ? 'Refund processed successfully' : 'Refund processing failed',
      data: result
    });
  } catch (error) {
    console.error('Process refund error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to process refund'
    });
  }
};

// Get payout status
const getPayoutStatus = async (req, res) => {
  try {
    const { transactionId } = req.params;

    const status = await payoutService.getPayoutStatus(transactionId);

    res.json({
      success: true,
      data: status
    });
  } catch (error) {
    console.error('Get payout status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get payout status'
    });
  }
};

module.exports = {
  getWorkerClaims,
  getClaimById,
  createManualClaim,
  retryPayout,
  getClaimAnalytics,
  getAllClaims,
  getClaimsForReview,
  reviewClaim,
  getFraudStatistics,
  analyzeWorker,
  getPayoutStatistics,
  processBatchPayouts,
  processRefund,
  getPayoutStatus
};
