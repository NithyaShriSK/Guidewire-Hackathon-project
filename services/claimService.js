const { Claim, Policy, Worker, MonitoringData } = require('../models');
const fraudDetectionService = require('./fraudDetectionService');
const payoutService = require('./payoutService');
const { v4: uuidv4 } = require('uuid');

class ClaimService {
  // Create automated claim from monitoring trigger
  async createAutomatedClaim(policyId, triggerData) {
    try {
      const policy = await Policy.findById(policyId).populate('workerId');
      if (!policy) {
        throw new Error('Policy not found');
      }

      if (policy.status.current !== 'active') {
        console.log(`Policy ${policyId} is not active, skipping claim creation`);
        return null;
      }

      const worker = policy.workerId;
      const hasActivePremium = Boolean(worker?.premium?.currentWeekPaid) && worker?.status?.subscriptionStatus === 'active';
      if (!hasActivePremium) {
        console.log(`Worker ${worker?._id} has no active weekly premium, skipping automated payout claim`);
        return null;
      }

      // Check if there's already a recent claim for the same trigger
      const recentClaim = await Claim.findOne({
        policyId,
        'trigger.type': triggerData.type,
        'trigger.timestamp': {
          $gte: new Date(Date.now() - 2 * 60 * 60 * 1000) // Last 2 hours
        },
        'status.current': { $in: ['initiated', 'validating', 'approved'] }
      });

      if (recentClaim) {
        console.log(`Recent claim already exists for policy ${policyId}, skipping`);
        return recentClaim;
      }

      // Get validation data from multiple sources
      const validationData = await this.getValidationData(triggerData);
      
      // Calculate financial loss
      const financialLoss = await this.calculateFinancialLoss(policy, triggerData);

      // Create claim
      const claim = new Claim({
        policyId,
        workerId: policy.workerId._id,
        trigger: {
          type: triggerData.type,
          timestamp: new Date(),
          location: triggerData.location,
          detectedValues: triggerData.detectedValues,
          thresholds: triggerData.thresholds
        },
        validation: validationData,
        financial: financialLoss,
        status: {
          current: 'initiated',
          initiatedAt: new Date()
        },
        fraud: {
          riskScore: 0,
          flags: [],
          manualReviewRequired: false
        },
        audit: {
          source: triggerData.simulationMode ? 'simulation' : 'automated',
          decisionLogic: {
            triggeredBy: 'parametric_threshold',
            confidenceLevel: validationData.consensusScore || 0.8,
            automatedDecision: 'initiated'
          }
        }
      });

      await claim.save();

      // Start validation process
      await this.validateClaim(claim._id);

      return claim;
    } catch (error) {
      console.error('Error creating automated claim:', error);
      return null;
    }
  }

  // Get validation data from multiple sources
  async getValidationData(triggerData) {
    try {
      const validationData = {
        apiSources: [],
        consensusScore: 0,
        gpsValidation: {
          isLocationValid: true,
          distanceFromTrigger: 0
        },
        activityValidation: {
          isActivityConsistent: true
        }
      };

      // Get data from multiple APIs for consensus
      const { latitude, longitude } = triggerData.location;
      
      // Weather validation
      if (triggerData.type === 'extreme_weather') {
        const weatherData = await MonitoringData.findLatestForLocation('weather', triggerData.location, 60);
        if (weatherData && weatherData.length > 0) {
          validationData.apiSources.push({
            name: 'openweather',
            data: weatherData[0].data.weather,
            timestamp: weatherData[0].metadata.timestamp,
            matchesTrigger: this.checkWeatherMatch(triggerData.detectedValues.weather, weatherData[0].data.weather, triggerData.thresholds.weather),
            confidence: 0.9
          });
        }
      }

      // Pollution validation
      if (triggerData.type === 'high_pollution') {
        const pollutionData = await MonitoringData.findLatestForLocation('pollution', triggerData.location, 60);
        if (pollutionData && pollutionData.length > 0) {
          validationData.apiSources.push({
            name: 'openaq',
            data: pollutionData[0].data.pollution,
            timestamp: pollutionData[0].metadata.timestamp,
            matchesTrigger: this.checkPollutionMatch(triggerData.detectedValues.pollution, pollutionData[0].data.pollution, triggerData.thresholds.pollution),
            confidence: 0.8
          });
        }
      }

      // Traffic validation
      if (triggerData.type === 'traffic_congestion') {
        const trafficData = await MonitoringData.findLatestForLocation('traffic', triggerData.location, 30);
        if (trafficData && trafficData.length > 0) {
          validationData.apiSources.push({
            name: 'google',
            data: trafficData[0].data.traffic,
            timestamp: trafficData[0].metadata.timestamp,
            matchesTrigger: this.checkTrafficMatch(triggerData.detectedValues.traffic, trafficData[0].data.traffic, triggerData.thresholds.traffic),
            confidence: 0.85
          });
        }
      }

      // Calculate consensus score
      if (validationData.apiSources.length > 0) {
        const matchingSources = validationData.apiSources.filter(source => source.matchesTrigger);
        validationData.consensusScore = matchingSources.length / validationData.apiSources.length;
      } else if (triggerData.type === 'extreme_weather' && triggerData.detectedValues?.weather) {
        validationData.apiSources.push({
          name: 'live_monitoring_event',
          data: triggerData.detectedValues.weather,
          timestamp: new Date(),
          matchesTrigger: true,
          confidence: 0.85
        });
        validationData.consensusScore = 1;
      }

      return validationData;
    } catch (error) {
      console.error('Error getting validation data:', error);
      return {
        apiSources: [],
        consensusScore: 0,
        gpsValidation: { isLocationValid: true, distanceFromTrigger: 0 },
        activityValidation: { isActivityConsistent: true }
      };
    }
  }

  // Check weather data match
  checkWeatherMatch(detectedValues, apiData, thresholds) {
    try {
      if (detectedValues.rainfall > thresholds.rainfall && apiData.rainfall > thresholds.rainfall * 0.8) {
        return true;
      }
      if (detectedValues.windSpeed > thresholds.windSpeed && apiData.windSpeed > thresholds.windSpeed * 0.8) {
        return true;
      }
      if (detectedValues.temperature > thresholds.temperature && apiData.temperature > thresholds.temperature * 0.9) {
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error checking weather match:', error);
      return false;
    }
  }

  // Check pollution data match
  checkPollutionMatch(detectedValues, apiData, thresholds) {
    try {
      if (detectedValues.aqi > thresholds.aqi && apiData.aqi > thresholds.aqi * 0.9) {
        return true;
      }
      if (detectedValues.pm25 > thresholds.pm25 && apiData.pm25 > thresholds.pm25 * 0.9) {
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error checking pollution match:', error);
      return false;
    }
  }

  // Check traffic data match
  checkTrafficMatch(detectedValues, apiData, thresholds) {
    try {
      if (detectedValues.congestionLevel > thresholds.congestionLevel && apiData.congestionLevel > thresholds.congestionLevel * 0.8) {
        return true;
      }
      if (detectedValues.averageSpeed < thresholds.averageSpeed && apiData.averageSpeed < thresholds.averageSpeed * 1.2) {
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error checking traffic match:', error);
      return false;
    }
  }

  // Calculate financial loss
  async calculateFinancialLoss(policy, triggerData) {
    try {
      const worker = await Worker.findById(policy.workerId._id);
      const hourlyRate = worker.financialInfo.weeklyIncomeRange.max / (5 * 8); // Assume 5 days, 8 hours per week
      
      // Estimate working hours lost based on trigger severity
      let hoursLost = 2; // Default 2 hours
      
      if (triggerData.type === 'extreme_weather') {
        const weather = triggerData.detectedValues.weather;
        if (weather.rainfall > 50) hoursLost = 8; // Heavy rain
        else if (weather.rainfall > 25) hoursLost = 4; // Moderate rain
        else if (weather.windSpeed > 60) hoursLost = 6; // High wind
      } else if (triggerData.type === 'high_pollution') {
        const pollution = triggerData.detectedValues.pollution;
        if (pollution.aqi > 500) hoursLost = 8; // Hazardous
        else if (pollution.aqi > 400) hoursLost = 4; // Very unhealthy
        else if (pollution.aqi > 300) hoursLost = 2; // Unhealthy
      } else if (triggerData.type === 'traffic_congestion') {
        const traffic = triggerData.detectedValues.traffic;
        if (traffic.congestionLevel > 9) hoursLost = 4; // Extreme congestion
        else if (traffic.congestionLevel > 7) hoursLost = 2; // Heavy congestion
      }

      const totalLoss = hoursLost * hourlyRate;
      
      // Apply policy limits
      const payoutAmount = Math.min(
        totalLoss,
        policy.coverage.maxPayoutPerClaim,
        policy.coverage.maxPayoutPerWeek - policy.claims.totalPayoutAmount
      );

      return {
        estimatedLoss: {
          workingHoursLost: hoursLost,
          hourlyRate: Math.round(hourlyRate),
          totalLoss: Math.round(totalLoss)
        },
        payoutAmount: Math.round(payoutAmount),
        payoutCurrency: 'INR',
        payoutMethod: 'upi',
        payoutStatus: 'pending'
      };
    } catch (error) {
      console.error('Error calculating financial loss:', error);
      return {
        estimatedLoss: {
          workingHoursLost: 2,
          hourlyRate: 100,
          totalLoss: 200
        },
        payoutAmount: 200,
        payoutCurrency: 'INR',
        payoutMethod: 'upi',
        payoutStatus: 'pending'
      };
    }
  }

  // Validate claim
  async validateClaim(claimId) {
    try {
      const claim = await Claim.findById(claimId).populate('policyId').populate('workerId');
      if (!claim) {
        throw new Error('Claim not found');
      }

      // Update status to validating
      claim.status.current = 'validating';
      claim.status.validatedAt = new Date();

      if (claim.audit?.source === 'simulation') {
        claim.fraud.riskScore = 0.1;
        claim.fraud.flags = [];
        claim.fraud.manualReviewRequired = false;
      } else {
        // Run fraud detection
        const fraudResult = await fraudDetectionService.analyzeClaim(claim);
        claim.fraud.riskScore = fraudResult.riskScore;
        claim.fraud.flags = fraudResult.flags;
        claim.fraud.manualReviewRequired = fraudResult.manualReviewRequired;
      }

      // Make decision based on validation and fraud analysis
      const consensusThreshold = 0.6; // Minimum consensus score
      const fraudThreshold = 0.7; // Maximum acceptable fraud score

      if (claim.validation.consensusScore >= consensusThreshold && 
          claim.fraud.riskScore < fraudThreshold) {
        // Approve claim
        claim.status.current = 'approved';
        claim.status.approvedAt = new Date();
        claim.audit.decisionLogic.automatedDecision = 'approved';
        
        // Update policy claims count
        await Policy.findByIdAndUpdate(claim.policyId._id, {
          $inc: {
            'claims.totalClaims': 1,
            'claims.approvedClaims': 1,
            'claims.totalPayoutAmount': claim.financial.payoutAmount
          },
          $set: {
            'claims.lastClaimDate': new Date()
          }
        });

        // Process payout
        await this.processPayout(claim._id);
        
      } else if (claim.fraud.riskScore >= fraudThreshold) {
        // Flag for manual review
        claim.status.current = 'under_review';
        claim.fraud.manualReviewRequired = true;
        claim.audit.decisionLogic.automatedDecision = 'manual_review';
        
        // Update policy claims count
        await Policy.findByIdAndUpdate(claim.policyId._id, {
          $inc: {
            'claims.totalClaims': 1,
            'claims.pendingClaims': 1
          }
        });
        
      } else {
        // Reject claim
        claim.status.current = 'rejected';
        claim.status.rejectedAt = new Date();
        claim.audit.decisionLogic.automatedDecision = 'rejected';
        
        // Update policy claims count
        await Policy.findByIdAndUpdate(claim.policyId._id, {
          $inc: {
            'claims.totalClaims': 1,
            'claims.rejectedClaims': 1
          }
        });
      }

      claim.metadata.updatedAt = new Date();
      await claim.save();

      return claim;
    } catch (error) {
      console.error('Error validating claim:', error);
      throw error;
    }
  }

  // Process payout
  async processPayout(claimId) {
    try {
      const claim = await Claim.findById(claimId).populate('workerId');
      if (!claim) {
        throw new Error('Claim not found');
      }

      // Process UPI payout
      const payoutResult = await payoutService.processUPIPayout({
        upiId: claim.workerId.financialInfo.upiId,
        amount: claim.financial.payoutAmount,
        claimId: claim.claimNumber,
        description: `GigShield Claim Payout - ${claim.trigger.type}`
      });

      if (payoutResult.success) {
        claim.financial.payoutStatus = 'completed';
        claim.financial.payoutTransactionId = payoutResult.transactionId;
        claim.financial.payoutProcessedAt = new Date();
        claim.status.current = 'paid';
        claim.status.paidAt = new Date();
      } else {
        claim.financial.payoutStatus = 'failed';
        claim.financial.payoutFailureReason = payoutResult.error;
      }

      await claim.save();
      return payoutResult;
    } catch (error) {
      console.error('Error processing payout:', error);
      throw error;
    }
  }

  // Get claim by ID
  async getClaimById(claimId, workerId = null) {
    try {
      const query = { _id: claimId };
      if (workerId) {
        query.workerId = workerId;
      }

      const claim = await Claim.findOne(query)
        .populate('policyId', 'policyNumber coverage premium')
        .populate('workerId', 'personalInfo.firstName personalInfo.lastName personalInfo.email');

      return claim;
    } catch (error) {
      console.error('Error getting claim by ID:', error);
      throw error;
    }
  }

  // Get worker claims
  async getWorkerClaims(workerId, options = {}) {
    try {
      const { status, limit = 10, page = 1 } = options;
      
      const query = { workerId };
      if (status) {
        query['status.current'] = status;
      }

      const claims = await Claim.find(query)
        .sort({ 'metadata.createdAt': -1 })
        .limit(limit * 1)
        .skip((page - 1) * limit)
        .populate('policyId', 'policyNumber');

      const total = await Claim.countDocuments(query);

      return {
        claims,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      };
    } catch (error) {
      console.error('Error getting worker claims:', error);
      throw error;
    }
  }

  // Manual claim review (admin)
  async reviewClaim(claimId, adminId, decision, notes = '') {
    try {
      const claim = await Claim.findById(claimId);
      if (!claim) {
        throw new Error('Claim not found');
      }

      claim.fraud.reviewedBy = adminId;
      claim.fraud.reviewNotes = notes;
      claim.fraud.reviewDecision = decision;

      if (decision === 'approve') {
        claim.status.current = 'approved';
        claim.status.approvedAt = new Date();
        await this.processPayout(claimId);
      } else if (decision === 'reject') {
        claim.status.current = 'rejected';
        claim.status.rejectedAt = new Date();
      }

      claim.metadata.updatedAt = new Date();
      await claim.save();

      return claim;
    } catch (error) {
      console.error('Error reviewing claim:', error);
      throw error;
    }
  }

  // Get claims requiring manual review
  async getClaimsForReview(options = {}) {
    try {
      const { limit = 20, page = 1 } = options;
      
      const claims = await Claim.find({
        'fraud.manualReviewRequired': true,
        'status.current': { $in: ['under_review', 'validating'] }
      })
        .sort({ 'metadata.createdAt': -1 })
        .limit(limit * 1)
        .skip((page - 1) * limit)
        .populate('policyId', 'policyNumber')
        .populate('workerId', 'personalInfo.firstName personalInfo.lastName personalInfo.email');

      const total = await Claim.countDocuments({
        'fraud.manualReviewRequired': true,
        'status.current': { $in: ['under_review', 'validating'] }
      });

      return {
        claims,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      };
    } catch (error) {
      console.error('Error getting claims for review:', error);
      throw error;
    }
  }
}

module.exports = new ClaimService();
