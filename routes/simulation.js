const express = require('express');
const router = express.Router();
const { authenticateWorker, authenticateAdmin } = require('../middleware/auth');
const monitoringService = require('../services/monitoringService');
const claimService = require('../services/claimService');
const { Worker, Policy, MonitoringData, ActivityLog, Claim } = require('../models');

async function ensureDemoReadyWorker(worker) {
  worker.locationTracking = worker.locationTracking || {};
  worker.premium = worker.premium || {};
  worker.status = worker.status || {};
  worker.workInfo = worker.workInfo || {};
  worker.financialInfo = worker.financialInfo || {};
  worker.financialInfo.bankAccount = worker.financialInfo.bankAccount || {};
  worker.financialInfo.weeklyIncomeRange = worker.financialInfo.weeklyIncomeRange || {};

  const coverageZone = {
    name: worker.locationTracking?.workingRegion || worker.personalInfo?.address?.city || 'Primary Delivery Zone',
    coordinates: {
      latitude: worker.locationTracking?.currentLocation?.latitude ?? worker.personalInfo.address.coordinates.latitude,
      longitude: worker.locationTracking?.currentLocation?.longitude ?? worker.personalInfo.address.coordinates.longitude,
      radius: 5
    }
  };

  worker.status.accountStatus = 'active';
  worker.status.subscriptionStatus = 'active';
  worker.premium.weeklyAmount = worker.premium.weeklyAmount || 20;
  worker.premium.currentWeekPaid = true;
  worker.premium.lastPaymentDate = worker.premium.lastPaymentDate || new Date();
  worker.premium.nextPaymentDue = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  worker.financialInfo.upiId = worker.financialInfo.upiId || 'demoamazonflex@okaxis';
  worker.financialInfo.bankAccount.accountNumber = worker.financialInfo.bankAccount.accountNumber || '123456789012';
  worker.financialInfo.bankAccount.ifscCode = worker.financialInfo.bankAccount.ifscCode || 'SBIN0001234';
  worker.financialInfo.bankAccount.accountHolderName = worker.financialInfo.bankAccount.accountHolderName || `${worker.personalInfo.firstName} ${worker.personalInfo.lastName}`;
  worker.financialInfo.weeklyIncomeRange.min = worker.financialInfo.weeklyIncomeRange.min || 2500;
  worker.financialInfo.weeklyIncomeRange.max = worker.financialInfo.weeklyIncomeRange.max || 5000;
  worker.workInfo.typicalWorkingHours = worker.workInfo.typicalWorkingHours || { start: '08:00', end: '20:00' };
  worker.locationTracking.currentLocation = {
    latitude: coverageZone.coordinates.latitude,
    longitude: coverageZone.coordinates.longitude,
    address: worker.locationTracking?.currentLocation?.address || worker.personalInfo?.address?.street || 'Demo location',
    city: worker.locationTracking?.currentLocation?.city || worker.personalInfo?.address?.city || 'Demo City',
    state: worker.locationTracking?.currentLocation?.state || worker.personalInfo?.address?.state || 'Demo State',
    lastUpdated: new Date()
  };
  worker.locationTracking.workingRegion = worker.locationTracking.workingRegion || coverageZone.name;
  worker.locationTracking.isActive = true;
  await worker.save();

  await ActivityLog.create({
    workerId: worker._id,
    platform: 'Amazon Flex',
    eventType: 'scan',
    isWorking: true,
    location: {
      latitude: coverageZone.coordinates.latitude,
      longitude: coverageZone.coordinates.longitude
    },
    metadata: {
      source: 'simulation_prep',
      capturedAt: new Date()
    }
  });

  let activePolicies = await Policy.findActive(worker._id);
  if (activePolicies.length > 1) {
    const [currentPolicy, ...olderPolicies] = activePolicies.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    await Policy.updateMany(
      { _id: { $in: olderPolicies.map((policy) => policy._id) } },
      { $set: { 'status.current': 'inactive', 'monitoring.isActive': false, 'metadata.updatedAt': new Date() } }
    );
    return currentPolicy;
  }
  if (activePolicies.length > 0) {
    return activePolicies[0];
  }

  const demoPolicy = await Policy.create({
    workerId: worker._id,
    policyNumber: `GS-DEMO-${Date.now()}`,
    policyType: 'weekly',
    coverage: {
      coveredRisks: [
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
      ],
      maxPayoutPerClaim: 500,
      maxPayoutPerWeek: 2000,
      deductible: 0,
      coverageHours: worker.workInfo?.typicalWorkingHours || { start: '08:00', end: '20:00' },
      coverageZones: [coverageZone]
    },
    premium: {
      baseAmount: 20,
      riskAdjustedAmount: 20,
      finalAmount: 20,
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
    },
    fraudDetection: {
      riskScore: 0.2,
      lastAssessment: new Date()
    },
    metadata: {
      createdAt: new Date(),
      updatedAt: new Date(),
      termsAcceptedAt: new Date()
    }
  });

  return demoPolicy;
}

async function ensurePaidSimulationClaim({ claim, policy, worker, triggerType, location, simulationData, triggerThresholds }) {
  const computedFinancial = await claimService.calculateFinancialLoss(policy, {
    type: triggerType,
    detectedValues: triggerType === 'extreme_weather' ? { weather: simulationData } :
      triggerType === 'high_pollution' ? { pollution: simulationData } :
      { traffic: simulationData }
  });

  if (claim) {
    claim.status.current = 'paid';
    claim.status.approvedAt = claim.status.approvedAt || new Date();
    claim.status.paidAt = new Date();
    claim.financial.payoutAmount = computedFinancial.payoutAmount;
    claim.financial.estimatedLoss = computedFinancial.estimatedLoss;
    claim.financial.payoutStatus = 'completed';
    claim.financial.payoutTransactionId = claim.financial.payoutTransactionId || `SIM-PAYOUT-${Date.now()}`;
    claim.financial.payoutProcessedAt = new Date();
    claim.audit.decisionLogic.automatedDecision = 'approved';
    await claim.save();
    return claim;
  }

  const simulationClaim = await Claim.create({
    claimNumber: `SIM-CLM-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
    policyId: policy._id,
    workerId: worker._id,
    trigger: {
      type: triggerType,
      timestamp: new Date(),
      location,
      detectedValues: triggerType === 'extreme_weather' ? { weather: simulationData } :
        triggerType === 'high_pollution' ? { pollution: simulationData } :
        { traffic: simulationData },
      thresholds: triggerThresholds
    },
    validation: {
      apiSources: [{
        name: 'simulation_engine',
        data: simulationData,
        timestamp: new Date(),
        matchesTrigger: true,
        confidence: 1
      }],
      consensusScore: 1,
      gpsValidation: {
        isLocationValid: true,
        distanceFromTrigger: 0
      },
      activityValidation: {
        isActivityConsistent: true
      }
    },
    financial: {
      ...computedFinancial,
      payoutStatus: 'completed',
      payoutTransactionId: `SIM-PAYOUT-${Date.now()}`,
      payoutProcessedAt: new Date()
    },
    status: {
      current: 'paid',
      initiatedAt: new Date(),
      validatedAt: new Date(),
      approvedAt: new Date(),
      paidAt: new Date()
    },
    fraud: {
      riskScore: 0.05,
      flags: [],
      manualReviewRequired: false
    },
    audit: {
      decisionLogic: {
        triggeredBy: 'simulation_override',
        confidenceLevel: 1,
        automatedDecision: 'approved',
        humanOverride: false
      }
    },
    metadata: {
      source: 'api'
    }
  });

  await Policy.findByIdAndUpdate(policy._id, {
    $inc: {
      'claims.totalClaims': 1,
      'claims.approvedClaims': 1,
      'claims.totalPayoutAmount': simulationClaim.financial.payoutAmount
    },
    $set: {
      'claims.lastClaimDate': new Date()
    }
  });

  return simulationClaim;
}

// Simulate weather event
router.post('/weather', authenticateAdmin, async (req, res) => {
  try {
    const { location, weatherData } = req.body;
    
    const simulatedData = {
      source: {
        type: 'weather',
        provider: 'simulation',
        apiEndpoint: '/simulation',
        region: {
          coordinates: location,
          city: 'Simulated City'
        }
      },
      data: {
        weather: {
          temperature: weatherData.temperature || 25,
          humidity: weatherData.humidity || 70,
          pressure: weatherData.pressure || 1013,
          windSpeed: weatherData.windSpeed || 10,
          windDirection: weatherData.windDirection || 180,
          rainfall: weatherData.rainfall || 0,
          visibility: weatherData.visibility || 10,
          conditions: weatherData.conditions || 'rain',
          cloudCover: weatherData.cloudCover || 80
        }
      },
      metadata: {
        timestamp: new Date(),
        dataQuality: {
          completeness: 1.0,
          accuracy: 1.0,
          timeliness: 1.0,
          confidence: 1.0
        }
      }
    };

    const monitoringData = new MonitoringData(simulatedData);
    await monitoringData.save();

    res.json({
      success: true,
      message: 'Weather simulation created successfully',
      data: monitoringData
    });
  } catch (error) {
    console.error('Simulate weather error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to simulate weather event'
    });
  }
});

// Simulate pollution event
router.post('/pollution', authenticateAdmin, async (req, res) => {
  try {
    const { location, pollutionData } = req.body;
    
    const simulatedData = {
      source: {
        type: 'pollution',
        provider: 'simulation',
        apiEndpoint: '/simulation',
        region: {
          coordinates: location,
          city: 'Simulated City'
        }
      },
      data: {
        pollution: {
          aqi: pollutionData.aqi || 300,
          pm25: pollutionData.pm25 || 150,
          pm10: pollutionData.pm10 || 200,
          no2: pollutionData.no2 || 80,
          so2: pollutionData.so2 || 60,
          co: pollutionData.co || 40,
          dominantPollutant: 'pm25',
          healthImplications: 'Unhealthy for sensitive groups',
          sensitiveGroups: 'People with respiratory diseases'
        }
      },
      metadata: {
        timestamp: new Date(),
        dataQuality: {
          completeness: 1.0,
          accuracy: 1.0,
          timeliness: 1.0,
          confidence: 1.0
        }
      }
    };

    const monitoringData = new MonitoringData(simulatedData);
    await monitoringData.save();

    res.json({
      success: true,
      message: 'Pollution simulation created successfully',
      data: monitoringData
    });
  } catch (error) {
    console.error('Simulate pollution error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to simulate pollution event'
    });
  }
});

// Simulate traffic event
router.post('/traffic', authenticateAdmin, async (req, res) => {
  try {
    const { location, trafficData } = req.body;
    
    const simulatedData = {
      source: {
        type: 'traffic',
        provider: 'simulation',
        apiEndpoint: '/simulation',
        region: {
          coordinates: location,
          city: 'Simulated City'
        }
      },
      data: {
        traffic: {
          congestionLevel: trafficData.congestionLevel || 8,
          averageSpeed: trafficData.averageSpeed || 5,
          trafficVolume: 'high',
          incidents: [],
          publicTransportStatus: {
            buses: 'delayed',
            metro: 'normal',
            trains: 'normal'
          }
        }
      },
      metadata: {
        timestamp: new Date(),
        dataQuality: {
          completeness: 1.0,
          accuracy: 1.0,
          timeliness: 1.0,
          confidence: 1.0
        }
      }
    };

    const monitoringData = new MonitoringData(simulatedData);
    await monitoringData.save();

    res.json({
      success: true,
      message: 'Traffic simulation created successfully',
      data: monitoringData
    });
  } catch (error) {
    console.error('Simulate traffic error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to simulate traffic event'
    });
  }
});

// Trigger claim simulation
router.post('/claim', authenticateAdmin, async (req, res) => {
  try {
    const { policyId, triggerData } = req.body;
    
    const claim = await claimService.createAutomatedClaim(policyId, triggerData);

    if (!claim) {
      return res.status(400).json({
        success: false,
        message: 'Failed to create simulated claim'
      });
    }

    res.json({
      success: true,
      message: 'Claim simulation created successfully',
      data: claim
    });
  } catch (error) {
    console.error('Simulate claim error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to simulate claim'
    });
  }
});

// Get simulation scenarios
router.get('/scenarios', authenticateAdmin, async (req, res) => {
  try {
    const scenarios = [
      {
        id: 'light_rain_no_payout',
        name: 'Light Rain - No Payout',
        description: 'Simulates rainfall below the policy trigger threshold',
        narrative: 'Rain is detected, but it stays below the parametric threshold, so no claim and no payout are created.',
        weather: {
          rainfall: 8,
          windSpeed: 14,
          conditions: 'light rain'
        },
        thresholds: {
          rainfall: 15,
          windSpeed: 50
        }
      },
      {
        id: 'heavy_rain',
        name: 'Heavy Rain',
        description: 'Simulates heavy rainfall conditions',
        narrative: 'Rainfall crosses the parametric threshold, the engine validates the event, creates a claim, and attempts instant payout.',
        weather: {
          rainfall: 25,
          windSpeed: 30,
          conditions: 'heavy rain'
        },
        thresholds: {
          rainfall: 15,
          windSpeed: 50
        }
      },
      {
        id: 'extreme_pollution',
        name: 'Extreme Pollution',
        description: 'Simulates hazardous air quality',
        narrative: 'Air quality spikes above cover limits, the policy trigger fires, and the claim proceeds through automated validation.',
        pollution: {
          aqi: 450,
          pm25: 300,
          pm10: 400
        },
        thresholds: {
          aqi: 400,
          pm25: 250
        }
      },
      {
        id: 'severe_traffic',
        name: 'Severe Traffic',
        description: 'Simulates extreme traffic congestion',
        narrative: 'Traffic congestion exceeds policy thresholds and the worker becomes eligible for an automated disruption payout.',
        traffic: {
          congestionLevel: 9,
          averageSpeed: 3
        },
        thresholds: {
          congestionLevel: 8,
          averageSpeed: 5
        }
      }
    ];

    res.json({
      success: true,
      data: scenarios
    });
  } catch (error) {
    console.error('Get simulation scenarios error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch simulation scenarios'
    });
  }
});

// Run complete simulation
router.post('/run', authenticateAdmin, async (req, res) => {
  try {
    const { scenarioId, workerId } = req.body;
    
    // Get worker and active policy
    const worker = await Worker.findById(workerId);
    if (!worker) {
      return res.status(404).json({
        success: false,
        message: 'Worker not found'
      });
    }

    const policy = await ensureDemoReadyWorker(worker);
    const liveLocation = worker.locationTracking?.currentLocation;
    const location = typeof liveLocation?.latitude === 'number' && typeof liveLocation?.longitude === 'number'
      ? { latitude: liveLocation.latitude, longitude: liveLocation.longitude }
      : worker.personalInfo.address.coordinates;

    let simulationData;
    let triggerType;

    switch (scenarioId) {
      case 'light_rain_no_payout':
        simulationData = {
          temperature: 24,
          humidity: 78,
          windSpeed: 14,
          rainfall: 8,
          conditions: 'light rain',
          cloudCover: 55
        };
        triggerType = 'extreme_weather';
        break;

      case 'heavy_rain':
        simulationData = {
          temperature: 22,
          humidity: 85,
          windSpeed: 35,
          rainfall: 30,
          conditions: 'heavy rain',
          cloudCover: 90
        };
        triggerType = 'extreme_weather';
        break;
      
      case 'extreme_pollution':
        simulationData = {
          aqi: 450,
          pm25: 300,
          pm10: 400,
          no2: 90,
          dominantPollutant: 'pm25'
        };
        triggerType = 'high_pollution';
        break;
      
      case 'severe_traffic':
        simulationData = {
          congestionLevel: 9,
          averageSpeed: 3,
          trafficVolume: 'high'
        };
        triggerType = 'traffic_congestion';
        break;
      
      default:
        return res.status(400).json({
          success: false,
          message: 'Invalid scenario ID'
        });
    }

    // Create monitoring data
    const matchingRisk = policy.coverage.coveredRisks.find((risk) => risk.type === triggerType);
    const triggerThresholds = matchingRisk?.thresholds || {};

    const monitoringEntry = new MonitoringData({
      source: {
        type: triggerType === 'extreme_weather' ? 'weather' : triggerType === 'high_pollution' ? 'pollution' : 'traffic',
        provider: 'simulation',
        apiEndpoint: '/simulation',
        region: {
          coordinates: location,
          city: worker.locationTracking?.currentLocation?.city || worker.personalInfo?.address?.city || 'Simulated City',
          state: worker.locationTracking?.currentLocation?.state || worker.personalInfo?.address?.state || 'Simulation State',
          country: 'IN'
        }
      },
      data: triggerType === 'extreme_weather' ? { weather: simulationData } :
             triggerType === 'high_pollution' ? { pollution: simulationData } :
             { traffic: simulationData },
      metadata: {
        timestamp: new Date(),
        dataQuality: {
          completeness: 1.0,
          accuracy: 1.0,
          timeliness: 1.0,
          confidence: 1.0
        }
      }
    });

    await monitoringEntry.save();

    // Trigger claim
    const claim = await claimService.createAutomatedClaim(policy._id, {
      type: triggerType,
      location,
      detectedValues: triggerType === 'extreme_weather' ? { weather: simulationData } :
                      triggerType === 'high_pollution' ? { pollution: simulationData } :
                      { traffic: simulationData },
      thresholds: triggerThresholds,
      simulationMode: true
    });
    const thresholdBreached = triggerType === 'extreme_weather'
      ? simulationData.rainfall > (triggerThresholds.weather?.rainfall ?? Infinity)
      : triggerType === 'high_pollution'
        ? simulationData.aqi > (triggerThresholds.pollution?.aqi ?? Infinity)
        : (
            simulationData.congestionLevel > (triggerThresholds.traffic?.congestionLevel ?? Infinity) ||
            simulationData.averageSpeed < (triggerThresholds.traffic?.averageSpeed ?? -Infinity)
          );

    const finalizedClaimDocument = thresholdBreached
      ? await ensurePaidSimulationClaim({
          claim,
          policy,
          worker,
          triggerType,
          location,
          simulationData,
          triggerThresholds
        })
      : claim;

    const refreshedClaim = finalizedClaimDocument ? await Claim.findById(finalizedClaimDocument._id)
      .populate('workerId', 'personalInfo.firstName personalInfo.lastName personalInfo.email financialInfo.upiId')
      .populate('policyId', 'policyNumber coverage.maxPayoutPerClaim')
      .lean() : null;

    const payoutAttempted = Boolean(refreshedClaim);
    const payoutOccurred = refreshedClaim?.financial?.payoutStatus === 'completed';

    const timeline = [
      {
        title: 'Monitoring event generated',
        detail: `${scenarioId} data was injected for the selected worker location.`,
        status: 'completed'
      },
      {
        title: 'Policy threshold comparison',
        detail: thresholdBreached
          ? `Scenario values breached the configured threshold on ${policy.policyNumber}.`
          : `Scenario values stayed below the configured threshold on ${policy.policyNumber}.`,
        status: 'completed'
      },
      {
        title: 'Automated claim decision',
        detail: refreshedClaim
          ? `Claim ${refreshedClaim.claimNumber} moved to ${refreshedClaim.status.current}.`
          : 'No claim was generated because the trigger did not qualify.',
        status: refreshedClaim ? 'completed' : 'blocked'
      },
      {
        title: 'Payout result',
        detail: refreshedClaim
          ? `Payout status is ${refreshedClaim.financial.payoutStatus}.`
          : 'No payout attempt was made.',
        status: refreshedClaim?.financial?.payoutStatus === 'completed' ? 'completed' : refreshedClaim ? 'in_progress' : 'blocked'
      }
    ];

    const triggerSummary = triggerType === 'extreme_weather'
      ? {
          metric: 'Rainfall',
          observed: simulationData.rainfall,
          threshold: triggerThresholds.weather?.rainfall ?? null,
          unit: 'mm/hr'
        }
      : triggerType === 'high_pollution'
        ? {
            metric: 'AQI',
            observed: simulationData.aqi,
            threshold: triggerThresholds.pollution?.aqi ?? null,
            unit: 'AQI'
          }
        : {
            metric: 'Congestion',
            observed: simulationData.congestionLevel,
            threshold: triggerThresholds.traffic?.congestionLevel ?? null,
            unit: '/10'
          };

    res.json({
      success: true,
      message: 'Simulation completed successfully',
      data: {
        monitoringData: monitoringEntry,
        claim: refreshedClaim,
        scenario: scenarioId,
        worker: {
          id: worker._id,
          name: `${worker.personalInfo.firstName} ${worker.personalInfo.lastName}`,
          email: worker.personalInfo.email
        },
        policy: {
          id: policy._id,
          policyNumber: policy.policyNumber,
          status: policy.status.current,
          maxPayoutPerClaim: policy.coverage.maxPayoutPerClaim
        },
        triggerSummary,
        timeline,
        outcome: {
          thresholdBreached,
          payoutAttempted,
          payoutOccurred,
          label: payoutOccurred ? 'Payout Occurred' : payoutAttempted ? 'Claim Created - Payout Pending/Failed' : 'No Payout'
        }
      }
    });
  } catch (error) {
    console.error('Run simulation error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to run simulation'
    });
  }
});

// Clear simulation data
router.delete('/clear', authenticateAdmin, async (req, res) => {
  try {
    await MonitoringData.deleteMany({ 'source.provider': 'simulation' });
    
    res.json({
      success: true,
      message: 'Simulation data cleared successfully'
    });
  } catch (error) {
    console.error('Clear simulation data error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to clear simulation data'
    });
  }
});

module.exports = router;
