const { MonitoringData } = require('../models');
const { Matrix, solve } = require('ml-matrix');
const { LinearRegression } = require('ml-regression');
const ss = require('simple-statistics');

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
