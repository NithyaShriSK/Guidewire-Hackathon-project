const { Claim, Worker, MonitoringData, ActivityLog, FraudLog } = require('../models');
const geolib = require('geolib');

class FraudDetectionService {
  constructor() {
    this.fraudPatterns = {
      gpsSpoofing: {
        maxSpeed: 200, // km/hr - impossible speed for delivery
        locationJump: 50000, // meters - 50km jump in short time
        timeWindow: 5 // minutes
      },
      multipleClaims: {
        maxClaimsPerHour: 3,
        maxClaimsPerDay: 10
      },
      apiMismatch: {
        consensusThreshold: 0.3 // Minimum consensus score
      },
      unusualPattern: {
        frequencyThreshold: 5, // Claims per week
        amountThreshold: 1000 // High claim amounts
      }
    };
  }

  // Analyze claim for fraud indicators
  async analyzeClaim(claim) {
    try {
      const fraudResult = {
        riskScore: 0,
        flags: [],
        manualReviewRequired: false
      };

      // GPS spoofing detection
      const gpsResult = await this.detectGPSSpoofing(claim);
      if (gpsResult.isSpoofing) {
        fraudResult.flags.push({
          type: 'gps_spoofing',
          severity: gpsResult.severity,
          description: gpsResult.description,
          score: gpsResult.score,
          timestamp: new Date()
        });
        fraudResult.riskScore += gpsResult.score;
      }

      // Multiple claims detection
      const multipleClaimsResult = await this.detectMultipleClaims(claim);
      if (multipleClaimsResult.isSuspicious) {
        fraudResult.flags.push({
          type: 'multiple_claims',
          severity: multipleClaimsResult.severity,
          description: multipleClaimsResult.description,
          score: multipleClaimsResult.score,
          timestamp: new Date()
        });
        fraudResult.riskScore += multipleClaimsResult.score;
      }

      // API mismatch detection
      const apiResult = await this.detectAPIMismatch(claim);
      if (apiResult.isMismatch) {
        fraudResult.flags.push({
          type: 'api_mismatch',
          severity: apiResult.severity,
          description: apiResult.description,
          score: apiResult.score,
          timestamp: new Date()
        });
        fraudResult.riskScore += apiResult.score;
      }

      // Unusual pattern detection
      const patternResult = await this.detectUnusualPattern(claim);
      if (patternResult.isUnusual) {
        fraudResult.flags.push({
          type: 'unusual_pattern',
          severity: patternResult.severity,
          description: patternResult.description,
          score: patternResult.score,
          timestamp: new Date()
        });
        fraudResult.riskScore += patternResult.score;
      }

      // Activity inconsistency detection
      const activityResult = await this.detectActivityInconsistency(claim);
      if (activityResult.isInconsistent) {
        fraudResult.flags.push({
          type: 'activity_inconsistency',
          severity: activityResult.severity,
          description: activityResult.description,
          score: activityResult.score,
          timestamp: new Date()
        });
        fraudResult.riskScore += activityResult.score;
      }

      // Cap risk score at 1.0
      fraudResult.riskScore = Math.min(1.0, fraudResult.riskScore);

      // Determine if manual review is required
      fraudResult.manualReviewRequired = 
        fraudResult.riskScore > 0.7 || 
        fraudResult.flags.some(flag => flag.severity === 'high');

      if (fraudResult.flags.length > 0) {
        await FraudLog.create({
          claimId: claim._id,
          workerId: claim.workerId,
          riskScore: fraudResult.riskScore,
          status: fraudResult.riskScore >= 0.7 ? 'blocked' : 'flagged',
          reason: fraudResult.flags.map(f => f.description).join(' | '),
          flags: fraudResult.flags
        });
      }

      return fraudResult;
    } catch (error) {
      console.error('Error analyzing claim for fraud:', error);
      return {
        riskScore: 0.5,
        flags: [],
        manualReviewRequired: true // Default to manual review on error
      };
    }
  }

  // Detect GPS spoofing
  async detectGPSSpoofing(claim) {
    try {
      const worker = await Worker.findById(claim.workerId);
      const claimLocation = claim.trigger.location;

      // Check previous claims for location patterns
      const previousClaims = await Claim.find({
        workerId: claim.workerId,
        'trigger.timestamp': {
          $gte: new Date(claim.trigger.timestamp.getTime() - 24 * 60 * 60 * 1000), // Last 24 hours
          $lt: claim.trigger.timestamp
        }
      }).sort({ 'trigger.timestamp': -1 });

      if (previousClaims.length === 0) {
        return { isSpoofing: false, score: 0 };
      }

      const lastClaim = previousClaims[0];
      const timeDiff = (claim.trigger.timestamp.getTime() - lastClaim.trigger.timestamp.getTime()) / (1000 * 60); // minutes
      const distance = geolib.getDistance(
        { latitude: lastClaim.trigger.location.latitude, longitude: lastClaim.trigger.location.longitude },
        { latitude: claimLocation.latitude, longitude: claimLocation.longitude }
      );

      // Calculate speed if time difference is small
      let speed = 0;
      if (timeDiff > 0) {
        speed = (distance / 1000) / (timeDiff / 60); // km/hr
      }

      // Check for impossible speed
      if (speed > this.fraudPatterns.gpsSpoofing.maxSpeed) {
        return {
          isSpoofing: true,
          severity: 'high',
          description: `Impossible movement detected: ${speed.toFixed(2)} km/hr between locations`,
          score: 0.8
        };
      }

      // Check for location jump
      if (distance > this.fraudPatterns.gpsSpoofing.locationJump && timeDiff < this.fraudPatterns.gpsSpoofing.timeWindow) {
        return {
          isSpoofing: true,
          severity: 'medium',
          description: `Suspicious location jump: ${distance} meters in ${timeDiff} minutes`,
          score: 0.6
        };
      }

      return { isSpoofing: false, score: 0 };
    } catch (error) {
      console.error('Error detecting GPS spoofing:', error);
      return { isSpoofing: false, score: 0 };
    }
  }

  // Detect multiple claims
  async detectMultipleClaims(claim) {
    try {
      const oneHourAgo = new Date(claim.trigger.timestamp.getTime() - 60 * 60 * 1000);
      const oneDayAgo = new Date(claim.trigger.timestamp.getTime() - 24 * 60 * 60 * 1000);

      const claimsInLastHour = await Claim.countDocuments({
        workerId: claim.workerId,
        'trigger.timestamp': { $gte: oneHourAgo }
      });

      const claimsInLastDay = await Claim.countDocuments({
        workerId: claim.workerId,
        'trigger.timestamp': { $gte: oneDayAgo }
      });

      // Check hourly threshold
      if (claimsInLastHour > this.fraudPatterns.multipleClaims.maxClaimsPerHour) {
        return {
          isSuspicious: true,
          severity: 'high',
          description: `Too many claims in last hour: ${claimsInLastHour}`,
          score: 0.7
        };
      }

      // Check daily threshold
      if (claimsInLastDay > this.fraudPatterns.multipleClaims.maxClaimsPerDay) {
        return {
          isSuspicious: true,
          severity: 'medium',
          description: `Too many claims in last day: ${claimsInLastDay}`,
          score: 0.5
        };
      }

      return { isSuspicious: false, score: 0 };
    } catch (error) {
      console.error('Error detecting multiple claims:', error);
      return { isSuspicious: false, score: 0 };
    }
  }

  // Detect API mismatch
  async detectAPIMismatch(claim) {
    try {
      const consensusScore = claim.validation.consensusScore || 0;

      if (consensusScore < this.fraudPatterns.apiMismatch.consensusThreshold) {
        return {
          isMismatch: true,
          severity: 'medium',
          description: `Low consensus score: ${consensusScore}. APIs don't agree on conditions.`,
          score: 0.4
        };
      }

      // Check if trigger data matches API data
      const apiSources = claim.validation.apiSources || [];
      const matchingSources = apiSources.filter(source => source.matchesTrigger);
      
      if (apiSources.length > 0 && matchingSources.length === 0) {
        return {
          isMismatch: true,
          severity: 'high',
          description: 'Trigger data doesn\'t match any API source',
          score: 0.6
        };
      }

      return { isMismatch: false, score: 0 };
    } catch (error) {
      console.error('Error detecting API mismatch:', error);
      return { isMismatch: false, score: 0 };
    }
  }

  // Detect unusual patterns
  async detectUnusualPattern(claim) {
    try {
      const oneWeekAgo = new Date(claim.trigger.timestamp.getTime() - 7 * 24 * 60 * 60 * 1000);

      const recentClaims = await Claim.find({
        workerId: claim.workerId,
        'trigger.timestamp': { $gte: oneWeekAgo }
      });

      const claimFrequency = recentClaims.length;
      const averageClaimAmount = recentClaims.reduce((sum, c) => sum + c.financial.payoutAmount, 0) / recentClaims.length;

      // Check frequency
      if (claimFrequency > this.fraudPatterns.unusualPattern.frequencyThreshold) {
        return {
          isUnusual: true,
          severity: 'medium',
          description: `High claim frequency: ${claimFrequency} claims in last week`,
          score: 0.3
        };
      }

      // Check claim amount
      if (claim.financial.payoutAmount > this.fraudPatterns.unusualPattern.amountThreshold) {
        return {
          isUnusual: true,
          severity: 'low',
          description: `High claim amount: ₹${claim.financial.payoutAmount}`,
          score: 0.2
        };
      }

      // Check for pattern of same trigger type
      const sameTypeClaims = recentClaims.filter(c => c.trigger.type === claim.trigger.type);
      if (sameTypeClaims.length > 3) {
        return {
          isUnusual: true,
          severity: 'medium',
          description: `Repeated claims for same trigger type: ${claim.trigger.type}`,
          score: 0.3
        };
      }

      return { isUnusual: false, score: 0 };
    } catch (error) {
      console.error('Error detecting unusual patterns:', error);
      return { isUnusual: false, score: 0 };
    }
  }

  // Detect activity inconsistency
  async detectActivityInconsistency(claim) {
    try {
      const worker = await Worker.findById(claim.workerId);
      const claimTime = claim.trigger.timestamp;

      // Activity anchoring: worker must have scan/heartbeat events near disruption time.
      const activityWindowStart = new Date(claimTime.getTime() - 90 * 60 * 1000);
      const recentActivityCount = await ActivityLog.countDocuments({
        workerId: claim.workerId,
        createdAt: { $gte: activityWindowStart, $lte: claimTime },
        isWorking: true
      });

      if (recentActivityCount === 0) {
        return {
          isInconsistent: true,
          severity: 'high',
          description: 'No activity scans near disruption time (activity anchoring failed)',
          score: 0.75
        };
      }

      const workingHours = worker.workInfo.typicalWorkingHours;
      const claimHour = claimTime.getHours();
      const startHour = parseInt(workingHours.start.split(':')[0]);
      const endHour = parseInt(workingHours.end.split(':')[0]);

      // If claim is outside working hours, it's suspicious
      if (claimHour < startHour || claimHour > endHour) {
        return {
          isInconsistent: true,
          severity: 'medium',
          description: `Claim filed outside working hours: ${claimHour}:00`,
          score: 0.3
        };
      }

      // Simulate platform activity check
      // In real implementation, this would check actual delivery platform data
      const isSimulatedWorking = Math.random() > 0.2; // 80% chance worker was actually working
      
      if (!isSimulatedWorking) {
        return {
          isInconsistent: true,
          severity: 'high',
          description: 'Platform activity shows worker was not delivering during claimed disruption',
          score: 0.7
        };
      }

      return { isInconsistent: false, score: 0 };
    } catch (error) {
      console.error('Error detecting activity inconsistency:', error);
      return { isInconsistent: false, score: 0 };
    }
  }

  // Analyze worker for fraud patterns
  async analyzeWorker(workerId) {
    try {
      const worker = await Worker.findById(workerId);
      const claims = await Claim.find({ workerId });

      const analysis = {
        totalClaims: claims.length,
        approvedClaims: claims.filter(c => c.status.current === 'approved').length,
        rejectedClaims: claims.filter(c => c.status.current === 'rejected').length,
        averageRiskScore: 0,
        fraudFlags: [],
        riskLevel: 'Low'
      };

      if (claims.length > 0) {
        analysis.averageRiskScore = claims.reduce((sum, c) => sum + (c.fraud.riskScore || 0), 0) / claims.length;
      }

      // Check for patterns
      if (analysis.rejectedClaims / analysis.totalClaims > 0.5) {
        analysis.fraudFlags.push('High rejection rate');
      }

      if (analysis.averageRiskScore > 0.7) {
        analysis.fraudFlags.push('High average risk score');
      }

      if (analysis.totalClaims > 20) {
        analysis.fraudFlags.push('Excessive claims');
      }

      // Determine risk level
      if (analysis.averageRiskScore > 0.8 || analysis.fraudFlags.length > 2) {
        analysis.riskLevel = 'High';
      } else if (analysis.averageRiskScore > 0.5 || analysis.fraudFlags.length > 0) {
        analysis.riskLevel = 'Medium';
      }

      return analysis;
    } catch (error) {
      console.error('Error analyzing worker:', error);
      return {
        totalClaims: 0,
        approvedClaims: 0,
        rejectedClaims: 0,
        averageRiskScore: 0,
        fraudFlags: [],
        riskLevel: 'Unknown'
      };
    }
  }

  // Get fraud statistics
  async getFraudStatistics(timeRange = '30d') {
    try {
      let startDate;
      const now = new Date();

      switch (timeRange) {
        case '7d':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case '30d':
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        case '90d':
          startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
          break;
        default:
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      }

      const totalClaims = await Claim.countDocuments({
        'metadata.createdAt': { $gte: startDate }
      });

      const fraudClaims = await Claim.countDocuments({
        'metadata.createdAt': { $gte: startDate },
        'fraud.riskScore': { $gte: 0.7 }
      });

      const manualReviewClaims = await Claim.countDocuments({
        'metadata.createdAt': { $gte: startDate },
        'fraud.manualReviewRequired': true
      });

      const fraudByType = await Claim.aggregate([
        {
          $match: {
            'metadata.createdAt': { $gte: startDate },
            'fraud.flags': { $exists: true, $ne: [] }
          }
        },
        {
          $unwind: '$fraud.flags'
        },
        {
          $group: {
            _id: '$fraud.flags.type',
            count: { $sum: 1 }
          }
        }
      ]);

      return {
        totalClaims,
        fraudClaims,
        manualReviewClaims,
        fraudRate: ((fraudClaims / totalClaims) * 100).toFixed(2),
        manualReviewRate: ((manualReviewClaims / totalClaims) * 100).toFixed(2),
        fraudByType: fraudByType.reduce((acc, item) => {
          acc[item._id] = item.count;
          return acc;
        }, {})
      };
    } catch (error) {
      console.error('Error getting fraud statistics:', error);
      return {
        totalClaims: 0,
        fraudClaims: 0,
        manualReviewClaims: 0,
        fraudRate: '0',
        manualReviewRate: '0',
        fraudByType: {}
      };
    }
  }
}

module.exports = new FraudDetectionService();
