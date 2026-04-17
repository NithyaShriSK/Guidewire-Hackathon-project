const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');
const { promisify } = require('util');
const { MonitoringData, Worker } = require('../models');
const { Matrix, solve } = require('ml-matrix');
const { LinearRegression } = require('ml-regression');
const ss = require('simple-statistics');

const execFileAsync = promisify(execFile);

class RiskAssessmentService {
  constructor() {
    this.riskFactors = {
      weather: {
        rainfall: { weight: 0.3, threshold: 15 },
        windSpeed: { weight: 0.2, threshold: 50 },
        temperature: { weight: 0.2, threshold: 45 },
        humidity: { weight: 0.1, threshold: 90 }
      },
      pollution: {
        aqi: { weight: 0.4, threshold: 400 },
        pm25: { weight: 0.3, threshold: 250 },
        pm10: { weight: 0.2, threshold: 350 },
        no2: { weight: 0.1, threshold: 200 }
      },
      traffic: {
        congestionLevel: { weight: 0.5, threshold: 8 },
        averageSpeed: { weight: 0.3, threshold: 5 },
        incidentRate: { weight: 0.2, threshold: 3 }
      },
      location: {
        floodRisk: { weight: 0.4 },
        pollutionRisk: { weight: 0.3 },
        trafficRisk: { weight: 0.2 },
        civilUnrestRisk: { weight: 0.1 }
      },
      historical: {
        claimFrequency: { weight: 0.4 },
        claimSeverity: { weight: 0.3 },
        fraudIndicators: { weight: 0.3 }
      }
    };

    this.mlPaths = {
      riskScript: path.join(__dirname, '..', 'ml', 'risk_model.py'),
      riskModel: path.join(__dirname, '..', 'ml', 'risk_model.joblib')
    };
  }

  getWorkerCoordinates(worker) {
    const currentLocation = worker?.locationTracking?.currentLocation;
    const addressCoordinates = worker?.personalInfo?.address?.coordinates;

    if (typeof currentLocation?.latitude === 'number' && typeof currentLocation?.longitude === 'number') {
      return {
        latitude: currentLocation.latitude,
        longitude: currentLocation.longitude
      };
    }

    if (typeof addressCoordinates?.latitude === 'number' && typeof addressCoordinates?.longitude === 'number') {
      return {
        latitude: addressCoordinates.latitude,
        longitude: addressCoordinates.longitude
      };
    }

    return null;
  }

  async getEnvironmentalSnapshot(worker) {
    const coordinates = this.getWorkerCoordinates(worker);
    const city = worker?.locationTracking?.workingRegion || worker?.personalInfo?.address?.city || 'Unknown';

    if (!coordinates) {
      return {
        city,
        weather: { rainfall: 0, windSpeed: 0, temperature: 28, humidity: 55 },
        pollution: { aqi: 60, pm25: 20, pm10: 40, no2: 15 },
        traffic: { congestionLevel: 3, averageSpeed: 25 }
      };
    }

    const [weatherData, pollutionData, trafficData] = await Promise.all([
      MonitoringData.findLatestForLocation('weather', coordinates, 24 * 60),
      MonitoringData.findLatestForLocation('pollution', coordinates, 24 * 60),
      MonitoringData.findLatestForLocation('traffic', coordinates, 60)
    ]);

    return {
      city,
      weather: weatherData?.[0]?.data?.weather || { rainfall: 0, windSpeed: 0, temperature: 28, humidity: 55 },
      pollution: pollutionData?.[0]?.data?.pollution || { aqi: 60, pm25: 20, pm10: 40, no2: 15 },
      traffic: trafficData?.[0]?.data?.traffic || { congestionLevel: 3, averageSpeed: 25 },
      coordinates
    };
  }

  buildRiskFeatureVector(worker, snapshot) {
    const city = (snapshot?.city || worker?.personalInfo?.address?.city || worker?.locationTracking?.workingRegion || '').toLowerCase();
    const cityRisk = {
      mumbai: 0.18,
      chennai: 0.16,
      delhi: 0.24,
      bangalore: 0.17,
      bengaluru: 0.17,
      hyderabad: 0.14,
      kolkata: 0.15,
      pune: 0.13
    }[city] || 0.1;

    const claims = worker?.riskProfile?.historicalClaims || {};
    const workHours = worker?.workInfo?.typicalWorkingHours || { start: '08:00', end: '20:00' };
    const startHour = parseInt(String(workHours.start).split(':')[0], 10) || 8;
    const endHour = parseInt(String(workHours.end).split(':')[0], 10) || 20;
    const workWindow = Math.max(1, endHour - startHour);

    return {
      rainfall: Number(snapshot?.weather?.rainfall || 0),
      windSpeed: Number(snapshot?.weather?.windSpeed || 0),
      temperature: Number(snapshot?.weather?.temperature || 28),
      humidity: Number(snapshot?.weather?.humidity || 55),
      aqi: Number(snapshot?.pollution?.aqi || 60),
      pm25: Number(snapshot?.pollution?.pm25 || 20),
      pm10: Number(snapshot?.pollution?.pm10 || 40),
      no2: Number(snapshot?.pollution?.no2 || 15),
      congestionLevel: Number(snapshot?.traffic?.congestionLevel || 3),
      averageSpeed: Number(snapshot?.traffic?.averageSpeed || 25),
      cityRisk,
      claimFrequency: Number(claims.totalClaims || 0),
      approvalRatio: claims.totalClaims ? Number(((claims.approvedClaims || 0) / claims.totalClaims).toFixed(2)) : 0.5,
      workWindowHours: workWindow,
      incomeVolatility: worker?.financialInfo?.weeklyIncomeRange?.min
        ? Number((((worker.financialInfo.weeklyIncomeRange.max || 0) - worker.financialInfo.weeklyIncomeRange.min) / worker.financialInfo.weeklyIncomeRange.min).toFixed(2))
        : 0.2
    };
  }

  async predictRiskWithPython(featureVector) {
    if (!fs.existsSync(this.mlPaths.riskScript)) {
      throw new Error('Risk ML script not found');
    }

    const pythonBinary = process.env.PYTHON_BIN || (process.platform === 'win32' ? 'python' : 'python3');
    const { stdout } = await execFileAsync(
      pythonBinary,
      [
        this.mlPaths.riskScript,
        '--predict',
        '--input',
        JSON.stringify(featureVector),
        '--model',
        this.mlPaths.riskModel
      ],
      {
        maxBuffer: 1024 * 1024 * 10,
        env: {
          ...process.env
        }
      }
    );

    return JSON.parse(stdout.trim());
  }

  async getWorkerRiskPrediction(worker) {
    try {
      const snapshot = await this.getEnvironmentalSnapshot(worker);
      const featureVector = this.buildRiskFeatureVector(worker, snapshot);

      let modelOutput;
      let source = 'heuristic-fallback';

      try {
        modelOutput = await this.predictRiskWithPython(featureVector);
        source = 'python-ml';
      } catch (error) {
        const weatherRisk = Math.min(1, (featureVector.rainfall / 40) + (featureVector.windSpeed / 120) + (featureVector.temperature > 38 ? 0.15 : 0));
        const pollutionRisk = Math.min(1, (featureVector.aqi / 500) + (featureVector.pm25 / 300));
        const trafficRisk = Math.min(1, (featureVector.congestionLevel / 10) + (featureVector.averageSpeed < 10 ? 0.2 : 0));
        const historyRisk = Math.min(1, (featureVector.claimFrequency / 12) + (featureVector.approvalRatio < 0.4 ? 0.15 : 0));

        const fallbackRiskScore = Math.min(1, (weatherRisk * 0.3) + (pollutionRisk * 0.25) + (trafficRisk * 0.25) + (historyRisk * 0.2));

        modelOutput = {
          riskScore: Number(fallbackRiskScore.toFixed(2)),
          riskLevel: this.getRiskLevel(fallbackRiskScore).toUpperCase(),
          predictedClaimsNextWeek: Math.max(0, Math.round(fallbackRiskScore * 10 + featureVector.claimFrequency * 0.25)),
          confidence: Number((0.7 + Math.abs(fallbackRiskScore - 0.5) * 0.4).toFixed(2)),
          premiumAdjustmentPercent: Math.max(-10, Math.min(35, Math.round(fallbackRiskScore * 35) - 8)),
          reason: 'Environmental and historical risk heuristic',
          modelSource: source
        };
      }

      const riskScore = Number(modelOutput.riskScore ?? modelOutput.risk_score ?? modelOutput.prediction ?? 0.4);
      const riskLevel = String(modelOutput.riskLevel ?? modelOutput.risk_level ?? this.getRiskLevel(riskScore)).toUpperCase();
      const predictedClaimsNextWeek = Number(modelOutput.predictedClaimsNextWeek ?? modelOutput.predicted_claims_next_week ?? Math.max(0, Math.round(riskScore * 10)));
      const confidence = Number(modelOutput.confidence ?? 0.75);
      const premiumAdjustmentPercent = Number(modelOutput.premiumAdjustmentPercent ?? modelOutput.premium_adjustment_percent ?? Math.max(-10, Math.min(35, Math.round(riskScore * 30) - 8)));

      return {
        riskScore: Number(riskScore.toFixed(2)),
        riskLevel,
        predictedClaimsNextWeek,
        confidence: Number(confidence.toFixed(2)),
        premiumAdjustmentPercent,
        reason: modelOutput.reason || 'ML-based weekly claim risk prediction',
        preventiveAlert: riskScore >= 0.7 ? 'Send proactive disruption alert and review premium' : null,
        featureVector,
        snapshot,
        modelSource: modelOutput.modelSource || source
      };
    } catch (error) {
      console.error('Error predicting worker risk:', error);
      return {
        riskScore: 0.4,
        riskLevel: 'MEDIUM',
        predictedClaimsNextWeek: 2,
        confidence: 0.65,
        premiumAdjustmentPercent: 5,
        reason: 'Fallback weekly risk estimate',
        preventiveAlert: null,
        modelSource: 'fallback'
      };
    }
  }

  async calculatePremiumWithForecast(basePremium, worker) {
    const baseRiskAssessment = await this.calculateBaseRiskScore(worker);
    const premiumBase = this.calculateDynamicPremium(basePremium, baseRiskAssessment.riskScore, worker);
    const weeklyPrediction = await this.getWorkerRiskPrediction(worker);
    const forecastMultiplier = 1 + (weeklyPrediction.premiumAdjustmentPercent / 100);
    const finalPremium = Math.max(5, Math.round(premiumBase.finalPremium * forecastMultiplier));

    return {
      ...premiumBase,
      basePremium,
      riskAssessment: baseRiskAssessment,
      weeklyPrediction,
      forecastMultiplier: Number(forecastMultiplier.toFixed(2)),
      finalPremium,
      riskAdjustedPremium: finalPremium,
      premiumRecommendation: weeklyPrediction.premiumAdjustmentPercent > 0
        ? 'Increase premium due to elevated forecast risk'
        : weeklyPrediction.premiumAdjustmentPercent < 0
          ? 'Offer discounted premium due to lower forecast risk'
          : 'Maintain current premium'
    };
  }

  // Calculate base risk score for a worker
  async calculateBaseRiskScore(worker, locationData = null) {
    try {
      let riskScore = 0.5; // Base risk score
      let riskFactors = {
        weather: 0,
        pollution: 0,
        traffic: 0,
        location: 0,
        historical: 0
      };

      // Location-based risk assessment
      if (locationData) {
        riskFactors.location = await this.calculateLocationRisk(worker, locationData);
      }

      // Historical risk assessment
      riskFactors.historical = this.calculateHistoricalRisk(worker);

      // Work pattern risk assessment
      const workPatternRisk = this.calculateWorkPatternRisk(worker);

      // Combine risk factors using weighted average
      const weights = {
        location: 0.3,
        historical: 0.3,
        workPattern: 0.2,
        demographic: 0.2
      };

      riskScore = (
        riskFactors.location * weights.location +
        riskFactors.historical * weights.historical +
        workPatternRisk * weights.workPattern +
        this.calculateDemographicRisk(worker) * weights.demographic
      );

      // Normalize to 0-1 scale
      riskScore = Math.max(0, Math.min(1, riskScore));

      return {
        riskScore: Math.round(riskScore * 100) / 100,
        riskFactors: {
          location: Math.round(riskFactors.location * 100) / 100,
          historical: Math.round(riskFactors.historical * 100) / 100,
          workPattern: Math.round(workPatternRisk * 100) / 100,
          demographic: Math.round(this.calculateDemographicRisk(worker) * 100) / 100
        },
        riskLevel: this.getRiskLevel(riskScore)
      };
    } catch (error) {
      console.error('Error calculating base risk score:', error);
      return { riskScore: 0.5, riskLevel: 'Medium' };
    }
  }

  // Calculate location-specific risk
  async calculateLocationRisk(worker, locationData) {
    try {
      let locationRisk = 0;
      const coordinates = worker.personalInfo.address.coordinates;

      // Get historical monitoring data for the location
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      
      const weatherData = await MonitoringData.findLatestForLocation('weather', coordinates, 24 * 60);
      const pollutionData = await MonitoringData.findLatestForLocation('pollution', coordinates, 24 * 60);
      const trafficData = await MonitoringData.findLatestForLocation('traffic', coordinates, 60); // 1 hour for traffic

      // Weather risk calculation
      if (weatherData && weatherData.length > 0) {
        const weather = weatherData[0].data.weather;
        let weatherRisk = 0;
        
        if (weather.rainfall > this.riskFactors.weather.rainfall.threshold) {
          weatherRisk += this.riskFactors.weather.rainfall.weight;
        }
        if (weather.windSpeed > this.riskFactors.weather.windSpeed.threshold) {
          weatherRisk += this.riskFactors.weather.windSpeed.weight;
        }
        if (weather.temperature > this.riskFactors.weather.temperature.threshold) {
          weatherRisk += this.riskFactors.weather.temperature.weight;
        }
        if (weather.humidity > this.riskFactors.weather.humidity.threshold) {
          weatherRisk += this.riskFactors.weather.humidity.weight;
        }
        
        locationRisk += weatherRisk * 0.4;
      }

      // Pollution risk calculation
      if (pollutionData && pollutionData.length > 0) {
        const pollution = pollutionData[0].data.pollution;
        let pollutionRisk = 0;
        
        if (pollution.aqi > this.riskFactors.pollution.aqi.threshold) {
          pollutionRisk += this.riskFactors.pollution.aqi.weight;
        }
        if (pollution.pm25 > this.riskFactors.pollution.pm25.threshold) {
          pollutionRisk += this.riskFactors.pollution.pm25.weight;
        }
        if (pollution.pm10 > this.riskFactors.pollution.pm10.threshold) {
          pollutionRisk += this.riskFactors.pollution.pm10.weight;
        }
        if (pollution.no2 > this.riskFactors.pollution.no2.threshold) {
          pollutionRisk += this.riskFactors.pollution.no2.weight;
        }
        
        locationRisk += pollutionRisk * 0.3;
      }

      // Traffic risk calculation
      if (trafficData && trafficData.length > 0) {
        const traffic = trafficData[0].data.traffic;
        let trafficRisk = 0;
        
        if (traffic.congestionLevel > this.riskFactors.traffic.congestionLevel.threshold) {
          trafficRisk += this.riskFactors.traffic.congestionLevel.weight;
        }
        if (traffic.averageSpeed < this.riskFactors.traffic.averageSpeed.threshold) {
          trafficRisk += this.riskFactors.traffic.averageSpeed.weight;
        }
        
        locationRisk += trafficRisk * 0.3;
      }

      return Math.min(1, locationRisk);
    } catch (error) {
      console.error('Error calculating location risk:', error);
      return 0.3; // Default moderate risk
    }
  }

  // Calculate historical risk based on past claims
  calculateHistoricalRisk(worker) {
    try {
      const claims = worker.riskProfile.historicalClaims;
      let historicalRisk = 0;

      // Claim frequency risk
      if (claims.totalClaims > 10) {
        historicalRisk += 0.4;
      } else if (claims.totalClaims > 5) {
        historicalRisk += 0.2;
      }

      // Claim approval ratio
      if (claims.totalClaims > 0) {
        const approvalRatio = claims.approvedClaims / claims.totalClaims;
        if (approvalRatio > 0.8) {
          historicalRisk += 0.3; // High approval ratio indicates legitimate claims
        } else if (approvalRatio < 0.3) {
          historicalRisk += 0.4; // Low approval ratio indicates potential fraud
        }
      }

      // Total payout amount risk
      if (claims.totalPayoutAmount > 10000) {
        historicalRisk += 0.3;
      }

      return Math.min(1, historicalRisk);
    } catch (error) {
      console.error('Error calculating historical risk:', error);
      return 0.2;
    }
  }

  // Calculate work pattern risk
  calculateWorkPatternRisk(worker) {
    try {
      let workRisk = 0;
      const workInfo = worker.workInfo;

      // Multiple platforms risk (more exposure)
      if (workInfo.platforms.length > 2) {
        workRisk += 0.2;
      }

      // Working hours risk (late night/early morning)
      const workHours = workInfo.typicalWorkingHours;
      const startHour = parseInt(workHours.start.split(':')[0]);
      const endHour = parseInt(workHours.end.split(':')[0]);

      if (startHour < 6 || endHour > 22) {
        workRisk += 0.3;
      }

      // Income volatility risk
      const incomeRange = worker.financialInfo.weeklyIncomeRange;
      const incomeVariation = (incomeRange.max - incomeRange.min) / incomeRange.min;
      
      if (incomeVariation > 0.5) {
        workRisk += 0.2;
      }

      return Math.min(1, workRisk);
    } catch (error) {
      console.error('Error calculating work pattern risk:', error);
      return 0.2;
    }
  }

  // Calculate demographic risk
  calculateDemographicRisk(worker) {
    try {
      let demographicRisk = 0;
      const age = worker.personalInfo.age;

      // Age-based risk
      if (age < 25 || age > 55) {
        demographicRisk += 0.2;
      }

      // Location-based demographic risk
      const city = worker.personalInfo.address.city.toLowerCase();
      const highRiskCities = ['mumbai', 'delhi', 'bangalore', 'kolkata', 'chennai'];
      
      if (highRiskCities.includes(city)) {
        demographicRisk += 0.1;
      }

      return Math.min(1, demographicRisk);
    } catch (error) {
      console.error('Error calculating demographic risk:', error);
      return 0.1;
    }
  }

  // Calculate dynamic premium based on risk score
  calculateDynamicPremium(basePremium, riskScore, workerData = null) {
    try {
      let premiumMultiplier = 1.0;

      // Risk-based adjustment
      if (riskScore > 0.8) {
        premiumMultiplier = 2.0; // Very high risk
      } else if (riskScore > 0.6) {
        premiumMultiplier = 1.5; // High risk
      } else if (riskScore > 0.4) {
        premiumMultiplier = 1.2; // Medium risk
      } else if (riskScore < 0.2) {
        premiumMultiplier = 0.8; // Low risk
      }

      // Apply discounts
      let discountMultiplier = 1.0;
      
      if (workerData) {
        // No-claims discount
        if (workerData.riskProfile.historicalClaims.totalClaims === 0) {
          discountMultiplier *= 0.9; // 10% discount
        }

        // Loyalty discount
        const monthsSinceRegistration = (Date.now() - workerData.metadata.registeredAt.getTime()) / (30 * 24 * 60 * 60 * 1000);
        if (monthsSinceRegistration > 12) {
          discountMultiplier *= 0.95; // 5% loyalty discount
        }

        // Referral discount
        if (workerData.metadata.referredBy) {
          discountMultiplier *= 0.95; // 5% referral discount
        }
      }

      const finalPremium = basePremium * premiumMultiplier * discountMultiplier;
      
      return {
        basePremium,
        riskAdjustedPremium: Math.round(basePremium * premiumMultiplier),
        finalPremium: Math.round(finalPremium),
        riskScore,
        premiumMultiplier: Math.round(premiumMultiplier * 100) / 100,
        discountMultiplier: Math.round(discountMultiplier * 100) / 100,
        totalDiscount: Math.round((1 - discountMultiplier) * 100)
      };
    } catch (error) {
      console.error('Error calculating dynamic premium:', error);
      return {
        basePremium,
        riskAdjustedPremium: basePremium,
        finalPremium: basePremium,
        riskScore: 0.5,
        premiumMultiplier: 1.0,
        discountMultiplier: 1.0,
        totalDiscount: 0
      };
    }
  }

  // Predict next week's risk using time series analysis
  async predictWeeklyRisk(workerCoordinates, historicalData = []) {
    try {
      // Get last 30 days of monitoring data
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      
      const weatherHistory = await MonitoringData.findByTimeRange(
        'weather', 
        'unknown', // We'll need to determine city from coordinates
        thirtyDaysAgo,
        new Date()
      );

      // Simple moving average prediction
      const predictions = {
        weather: 0.3,
        pollution: 0.4,
        traffic: 0.5,
        overall: 0.4
      };

      // If we have historical data, use it for better prediction
      if (weatherHistory.length > 0) {
        const recentWeatherRisk = weatherHistory.slice(-7).map(data => {
          const weather = data.data.weather;
          let risk = 0;
          
          if (weather.rainfall > 10) risk += 0.3;
          if (weather.windSpeed > 30) risk += 0.2;
          if (weather.temperature > 35) risk += 0.2;
          
          return risk;
        });

        predictions.weather = ss.mean(recentWeatherRisk);
      }

      // Overall risk prediction
      predictions.overall = (predictions.weather + predictions.pollution + predictions.traffic) / 3;

      return predictions;
    } catch (error) {
      console.error('Error predicting weekly risk:', error);
      return {
        weather: 0.3,
        pollution: 0.4,
        traffic: 0.5,
        overall: 0.4
      };
    }
  }

  // Get risk level category
  getRiskLevel(riskScore) {
    if (riskScore >= 0.8) return 'Very High';
    if (riskScore >= 0.6) return 'High';
    if (riskScore >= 0.4) return 'Medium';
    if (riskScore >= 0.2) return 'Low';
    return 'Very Low';
  }

  // Update worker risk profile
  async updateWorkerRiskProfile(workerId, newRiskData) {
    try {
      const Worker = require('../models').Worker;
      const worker = await Worker.findById(workerId);
      
      if (!worker) {
        throw new Error('Worker not found');
      }

      // Update risk factors
      worker.riskProfile.locationRiskFactors = {
        ...worker.riskProfile.locationRiskFactors,
        ...newRiskData.locationRiskFactors
      };

      worker.riskProfile.baseRiskScore = newRiskData.riskScore;
      worker.metadata.updatedAt = new Date();

      await worker.save();
      return worker;
    } catch (error) {
      console.error('Error updating worker risk profile:', error);
      throw error;
    }
  }
}

module.exports = new RiskAssessmentService();
