const { Claim, Worker, MonitoringData, ActivityLog, FraudLog } = require('../models');
const geolib = require('geolib');
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');
const { promisify } = require('util');

const execFileAsync = promisify(execFile);

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

  getFraudModelPaths() {
    return {
      scriptPath: path.join(__dirname, '..', 'ml', 'fraud_model.py'),
      modelPath: path.join(__dirname, '..', 'ml', 'fraud_model.joblib')
    };
  }

  async predictWithPythonModel(featureVector) {
    const { scriptPath, modelPath } = this.getFraudModelPaths();

    if (!fs.existsSync(scriptPath)) {
      throw new Error('Fraud ML script not found');
    }

    const pythonBinary = process.env.PYTHON_BIN || (process.platform === 'win32' ? 'python' : 'python3');
    const payload = JSON.stringify({
      distance_km: Number(featureVector.distance_km ?? featureVector.distanceKm ?? 0),
      time_minutes: Number(featureVector.time_minutes ?? featureVector.timeMinutes ?? 0),
      avg_speed_kmph: Number(featureVector.avg_speed_kmph ?? featureVector.avgSpeedKmph ?? 0),
      claims_last_week: Number(featureVector.claims_last_week ?? featureVector.claimsLastWeek ?? 0),
      weather_match: Number(featureVector.weather_match ?? featureVector.weatherMatch ?? 0)
    });

    const { stdout } = await execFileAsync(pythonBinary, [
      scriptPath,
      '--predict',
      '--input',
      payload,
      '--model',
      modelPath
    ], {
      maxBuffer: 1024 * 1024 * 10,
      env: {
        ...process.env,
        FRAUD_DATASET_PATH: process.env.FRAUD_DATASET_PATH || ''
      }
    });

    return JSON.parse(stdout.trim());
  }

  // Analyze claim for fraud indicators
  async analyzeClaim(claim) {
    try {
      const fraudResult = {
        riskScore: 0,
        flags: [],
        manualReviewRequired: false
      };

      let mlPrediction = null;
      try {
        const mlFeatures = await this.buildMLFeatureVectorFromClaim(claim);
        mlPrediction = await this.predictWithPythonModel(mlFeatures);
      } catch (error) {
        console.warn('Fraud ML prediction failed, falling back to rule-based scoring:', error.message);
      }

      if (mlPrediction) {
        const mlRiskScore = Number(mlPrediction.fraudScore ?? 0);
        fraudResult.riskScore = Math.max(0, Math.min(1, mlRiskScore));
        fraudResult.flags.push({
          type: 'ml_prediction',
          severity: this.getSeverityFromScore(mlRiskScore),
          description: mlPrediction.reason || `ML model predicted ${mlPrediction.riskLevel || 'risk'} fraud likelihood`,
          score: fraudResult.riskScore,
          timestamp: new Date()
        });
      }

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

      if (!mlPrediction) {
        // Cap risk score at 1.0 only for pure rule-based fallback path.
        fraudResult.riskScore = Math.min(1.0, fraudResult.riskScore);
      }

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

  getSeverityFromScore(score) {
    if (score >= 0.7) {
      return 'high';
    }

    if (score >= 0.4) {
      return 'medium';
    }

    return 'low';
  }

  async buildMLFeatureVectorFromClaim(claim) {
    const claimTime = new Date(claim.trigger.timestamp);
    const oneWeekAgo = new Date(claimTime.getTime() - 7 * 24 * 60 * 60 * 1000);

    const previousClaim = await Claim.findOne({
      workerId: claim.workerId,
      'trigger.timestamp': { $lt: claimTime }
    }).sort({ 'trigger.timestamp': -1 });

    let distanceKm = 0;
    let timeMinutes = 60;
    let avgSpeedKmph = 0;

    if (previousClaim?.trigger?.location && claim.trigger?.location) {
      const distanceMeters = geolib.getDistance(
        { latitude: previousClaim.trigger.location.latitude, longitude: previousClaim.trigger.location.longitude },
        { latitude: claim.trigger.location.latitude, longitude: claim.trigger.location.longitude }
      );
      distanceKm = distanceMeters / 1000;
      timeMinutes = Math.max(1, (claimTime.getTime() - new Date(previousClaim.trigger.timestamp).getTime()) / (1000 * 60));
      avgSpeedKmph = (distanceKm / timeMinutes) * 60;
    }

    const claimsLastWeek = await Claim.countDocuments({
      workerId: claim.workerId,
      'trigger.timestamp': { $gte: oneWeekAgo, $lte: claimTime }
    });

    const weatherMatch = claim.validation?.apiSources?.some((source) => source.matchesTrigger)
      || (claim.validation?.consensusScore ?? 0) >= this.fraudPatterns.apiMismatch.consensusThreshold
      ? 1
      : 0;

    return {
      distance_km: Number(distanceKm.toFixed(3)),
      time_minutes: Number(timeMinutes.toFixed(2)),
      avg_speed_kmph: Number(avgSpeedKmph.toFixed(2)),
      claims_last_week: claimsLastWeek,
      weather_match: weatherMatch
    };
  }

  normalizeRiskLevel(score) {
    if (score >= 0.7) {
      return 'HIGH';
    }

    if (score >= 0.4) {
      return 'MEDIUM';
    }

    return 'LOW';
  }

  buildScenarioProfile(scenario, worker) {
    const safeWorker = worker || null;
    const workerClaimsLastWeek = safeWorker?.riskProfile?.historicalClaims?.totalClaims
      ? Math.min(10, safeWorker.riskProfile.historicalClaims.totalClaims)
      : 0;
    const workerCity = safeWorker?.personalInfo?.address?.city || safeWorker?.locationTracking?.workingRegion || 'Unknown';

    const scenarioMap = {
      gps_spoofing: {
        inputData: {
          distanceJump: '25 km in 5 mins',
          expectedSpeed: '300 km/h',
          weather: 'Clear',
          claimReason: 'Heavy Rain',
          claimsLastWeek: Math.max(4, workerClaimsLastWeek),
          weatherMatch: 0,
          claimTimingAnomaly: 1,
          locationHistoryConsistency: 0.1,
          avgSpeedKmph: 300,
          distanceKm: 25,
          timeMinutes: 5,
          claimHour: 2
        },
        explanation: [
          'Unrealistic travel speed detected',
          'GPS jump is inconsistent with normal worker movement',
          'Weather mismatch with the claim reason',
          'Pattern matches known fraud behavior'
        ]
      },
      fake_weather_claim: {
        inputData: {
          distanceJump: '2 km in 50 mins',
          expectedSpeed: '2.4 km/h',
          weather: 'Clear',
          claimReason: 'Heavy Rain',
          claimsLastWeek: Math.max(2, workerClaimsLastWeek),
          weatherMatch: 0,
          claimTimingAnomaly: 0,
          locationHistoryConsistency: 0.7,
          avgSpeedKmph: 2.4,
          distanceKm: 2,
          timeMinutes: 50,
          claimHour: 14
        },
        explanation: [
          'Claimed rain event does not match weather data',
          'Movement pattern looks normal, but trigger conditions do not match',
          'Potential false claim based on weather mismatch'
        ]
      },
      frequent_claim_abuse: {
        inputData: {
          distanceJump: '1 km in 40 mins',
          expectedSpeed: '1.5 km/h',
          weather: 'Rain',
          claimReason: 'Routine disruption',
          claimsLastWeek: Math.max(7, workerClaimsLastWeek + 4),
          weatherMatch: 1,
          claimTimingAnomaly: 1,
          locationHistoryConsistency: 0.8,
          avgSpeedKmph: 1.5,
          distanceKm: 1,
          timeMinutes: 40,
          claimHour: 19
        },
        explanation: [
          'Too many claims in a short period',
          'Repeated filing pattern increases abuse risk',
          'Claim timing looks suspicious for the worker history'
        ]
      },
      normal_case: {
        inputData: {
          distanceJump: '1.2 km in 35 mins',
          expectedSpeed: '2 km/h',
          weather: 'Rain',
          claimReason: 'Heavy Rain',
          claimsLastWeek: Math.min(1, workerClaimsLastWeek),
          weatherMatch: 1,
          claimTimingAnomaly: 0,
          locationHistoryConsistency: 0.95,
          avgSpeedKmph: 2,
          distanceKm: 1.2,
          timeMinutes: 35,
          claimHour: 16
        },
        explanation: [
          'Location history is consistent',
          'Weather matches the claim reason',
          'Claim frequency is within normal range'
        ]
      }
    };

    const selectedScenario = scenarioMap[scenario] || scenarioMap.normal_case;
    const featureVector = {
      distanceKm: selectedScenario.inputData.distanceKm,
      timeMinutes: selectedScenario.inputData.timeMinutes,
      avgSpeedKmph: selectedScenario.inputData.avgSpeedKmph,
      claimsLastWeek: selectedScenario.inputData.claimsLastWeek,
      weatherMatch: selectedScenario.inputData.weatherMatch,
      claimTimingAnomaly: selectedScenario.inputData.claimTimingAnomaly,
      locationHistoryConsistency: selectedScenario.inputData.locationHistoryConsistency,
      workerCity,
      claimHour: selectedScenario.inputData.claimHour
    };

    return {
      scenario: scenarioMap[scenario] ? scenario : 'normal_case',
      inputData: selectedScenario.inputData,
      explanation: selectedScenario.explanation,
      featureVector,
      decisionFlow: [
        'Received claim',
        'Fetched worker history',
        'Computed movement speed',
        'Compared weather data',
        'Generated feature vector',
        'ML model predicted fraud probability',
        'Assigned risk level'
      ]
    };
  }

  scoreFraudFeatures(featureVector) {
    const speedRisk = Math.min(1, Math.max(0, (Number(featureVector.avgSpeedKmph || 0) - 60) / 180));
    const jumpRisk = Math.min(1, Math.max(0, (Number(featureVector.distanceKm || 0) - 3) / 20));
    const historyRisk = Math.min(1, Math.max(0, 1 - Number(featureVector.locationHistoryConsistency ?? 0.5)));
    const weatherRisk = Number(featureVector.weatherMatch) === 1 ? 0 : 0.35;
    const frequencyRisk = Math.min(1, Math.max(0, (Number(featureVector.claimsLastWeek || 0) - 2) / 6));
    const timingRisk = Number(featureVector.claimTimingAnomaly) === 1 ? 0.25 : 0;

    const fraudScore = Math.min(
      1,
      (speedRisk * 0.3) +
      (jumpRisk * 0.2) +
      (historyRisk * 0.2) +
      (weatherRisk * 0.15) +
      (frequencyRisk * 0.1) +
      (timingRisk * 0.05)
    );

    const reasonParts = [];
    if (speedRisk >= 0.5) reasonParts.push('Unrealistic travel speed');
    if (jumpRisk >= 0.5) reasonParts.push('Large GPS location jump');
    if (weatherRisk >= 0.2) reasonParts.push('Weather mismatch');
    if (frequencyRisk >= 0.4) reasonParts.push('High claim frequency');
    if (timingRisk >= 0.2) reasonParts.push('Abnormal claim timing');
    if (historyRisk >= 0.4) reasonParts.push('Weak location history consistency');

    return {
      fraudScore: Number(fraudScore.toFixed(2)),
      riskLevel: this.normalizeRiskLevel(fraudScore),
      confidence: Number((0.7 + (Math.abs(fraudScore - 0.5) * 0.4)).toFixed(2)),
      reason: reasonParts.length > 0 ? reasonParts.join(' + ') : 'No significant fraud indicators detected',
      featureContributions: {
        speedRisk: Number(speedRisk.toFixed(2)),
        jumpRisk: Number(jumpRisk.toFixed(2)),
        historyRisk: Number(historyRisk.toFixed(2)),
        weatherRisk: Number(weatherRisk.toFixed(2)),
        frequencyRisk: Number(frequencyRisk.toFixed(2)),
        timingRisk: Number(timingRisk.toFixed(2))
      }
    };
  }

  async simulateFraudScenario({ scenario, workerId }) {
    const worker = mongoose.Types.ObjectId.isValid(workerId)
      ? await Worker.findById(workerId).lean()
      : null;

    const profile = this.buildScenarioProfile(scenario, worker);
    let modelOutput;
    let modelSource = 'rule-fallback';

    try {
      modelOutput = await this.predictWithPythonModel(profile.featureVector);
      modelSource = 'python-ml';
    } catch (error) {
      console.warn('Fraud ML model unavailable, using fallback scorer:', error.message);
      modelOutput = this.scoreFraudFeatures(profile.featureVector);
    }

    const normalizedModelOutput = {
      fraudScore: Number(modelOutput.fraudScore ?? modelOutput.fraud_score ?? 0),
      riskLevel: String(modelOutput.riskLevel ?? modelOutput.risk_level ?? this.normalizeRiskLevel(modelOutput.fraudScore ?? 0)).toUpperCase(),
      confidence: Number(modelOutput.confidence ?? 0.75),
      reason: modelOutput.reason || 'Fraud pattern detected',
      modelSource: modelOutput.modelSource || modelSource,
      modelName: modelOutput.modelName || null
    };

    return {
      scenario: profile.scenario,
      inputData: profile.inputData,
      modelOutput: {
        fraudScore: normalizedModelOutput.fraudScore,
        riskLevel: normalizedModelOutput.riskLevel,
        confidence: normalizedModelOutput.confidence,
        reason: normalizedModelOutput.reason,
        modelSource: normalizedModelOutput.modelSource,
        modelName: normalizedModelOutput.modelName
      },
      explanation: profile.explanation,
      decisionFlow: profile.decisionFlow,
      featureVector: profile.featureVector,
      triggeredFeatures: modelOutput.featureContributions || null,
      worker: worker
        ? {
            id: worker._id,
            name: `${worker.personalInfo?.firstName || ''} ${worker.personalInfo?.lastName || ''}`.trim(),
            city: worker.personalInfo?.address?.city || worker.locationTracking?.workingRegion || null,
            historicalClaims: worker.riskProfile?.historicalClaims || null
          }
        : {
            id: workerId || 'demo-worker',
            name: 'Demo Worker',
            city: 'Demo City',
            historicalClaims: null
          }
    };
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
