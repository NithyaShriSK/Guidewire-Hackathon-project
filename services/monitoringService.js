const axios = require('axios');
const { MonitoringData, Policy, Worker } = require('../models');

class MonitoringService {
  constructor() {
    this.apiEndpoints = {
      weather: {
        openweather: {
          baseUrl: 'https://api.openweathermap.org/data/2.5',
          apiKey: process.env.WEATHER_API_KEY
        }
      },
      pollution: {
        openaq: {
          baseUrl: 'https://api.openaq.org/v2',
          apiKey: process.env.POLLUTION_API_KEY
        }
      },
      traffic: {
        google: {
          baseUrl: 'https://maps.googleapis.com/maps/api',
          apiKey: process.env.TRAFFIC_API_KEY
        }
      }
    };

    this.monitoringIntervals = new Map(); // Store active monitoring intervals
  }

  getWorkerKey(workerId) {
    return String(workerId);
  }

  buildMonitoringTargets(worker) {
    const targets = [];
    const currentLocation = worker?.locationTracking?.currentLocation;

    if (
      typeof currentLocation?.latitude === 'number' &&
      typeof currentLocation?.longitude === 'number'
    ) {
      targets.push({
        name: worker.locationTracking.workingRegion || 'Current Location',
        coordinates: {
          latitude: currentLocation.latitude,
          longitude: currentLocation.longitude,
          radius: 3
        },
        source: 'live_location'
      });
    }

    (worker?.workInfo?.preferredWorkingZones || []).forEach((zone) => {
      const duplicate = targets.some((target) => (
        Math.abs(target.coordinates.latitude - zone.coordinates.latitude) < 0.0001 &&
        Math.abs(target.coordinates.longitude - zone.coordinates.longitude) < 0.0001
      ));

      if (!duplicate) {
        targets.push({
          ...zone.toObject?.() || zone,
          source: 'preferred_zone'
        });
      }
    });

    if (
      targets.length === 0 &&
      typeof worker?.personalInfo?.address?.coordinates?.latitude === 'number' &&
      typeof worker?.personalInfo?.address?.coordinates?.longitude === 'number'
    ) {
      targets.push({
        name: worker.personalInfo.address.city || 'Home Location',
        coordinates: {
          latitude: worker.personalInfo.address.coordinates.latitude,
          longitude: worker.personalInfo.address.coordinates.longitude,
          radius: 5
        },
        source: 'home_address'
      });
    }

    return targets;
  }

  // Start monitoring for a worker
  async startWorkerMonitoring(workerId) {
    try {
      const workerKey = this.getWorkerKey(workerId);
      const worker = await Worker.findById(workerId);
      if (!worker) {
        throw new Error('Worker not found');
      }

      const isEligible = worker.status.accountStatus === 'active' &&
        worker.status.subscriptionStatus === 'active' &&
        worker.premium.currentWeekPaid;
      if (!isEligible) {
        console.log(`Worker ${workerId} is not eligible for autonomous insurance monitoring`);
        this.stopWorkerMonitoring(workerKey);
        return;
      }

      const activePolicies = await Policy.findActive(workerId);
      if (activePolicies.length === 0) {
        console.log(`No active policies found for worker ${workerId}`);
        return;
      }

      // Clear existing monitoring for this worker
      this.stopWorkerMonitoring(workerKey);

      // Start monitoring intervals
      const intervals = [];

      // Weather monitoring - every 15 minutes
      const weatherInterval = setInterval(() => {
        this.monitorWeatherForWorker(workerId);
      }, 15 * 60 * 1000);

      // Pollution monitoring - every 30 minutes
      const pollutionInterval = setInterval(() => {
        this.monitorPollutionForWorker(workerId);
      }, 30 * 60 * 1000);

      // Traffic monitoring - every 10 minutes during working hours
      const trafficInterval = setInterval(() => {
        this.monitorTrafficForWorker(workerId);
      }, 10 * 60 * 1000);

      intervals.push(weatherInterval, pollutionInterval, trafficInterval);
      this.monitoringIntervals.set(workerKey, intervals);

      // Initial monitoring
      await this.monitorWeatherForWorker(workerId);
      await this.monitorPollutionForWorker(workerId);
      await this.monitorTrafficForWorker(workerId);

      console.log(`Started monitoring for worker ${workerId}`);
    } catch (error) {
      console.error(`Error starting monitoring for worker ${workerId}:`, error);
    }
  }

  // Stop monitoring for a worker
  stopWorkerMonitoring(workerId) {
    const workerKey = this.getWorkerKey(workerId);
    const intervals = this.monitoringIntervals.get(workerKey);
    if (intervals) {
      intervals.forEach(interval => clearInterval(interval));
      this.monitoringIntervals.delete(workerKey);
      console.log(`Stopped monitoring for worker ${workerId}`);
    }
  }

  // Monitor weather for worker
  async monitorWeatherForWorker(workerId) {
    try {
      const worker = await Worker.findById(workerId).populate('workInfo.preferredWorkingZones');
      if (!worker) return;

      const zones = this.buildMonitoringTargets(worker);

      for (const zone of zones) {
        const weatherData = await this.fetchWeatherData(zone.coordinates);
        if (weatherData) {
          await this.saveMonitoringData('weather', weatherData, zone);
          
          // Check for weather triggers
          await this.checkWeatherTriggers(workerId, weatherData, zone);
        }
      }
    } catch (error) {
      console.error(`Error monitoring weather for worker ${workerId}:`, error);
    }
  }

  // Monitor pollution for worker
  async monitorPollutionForWorker(workerId) {
    try {
      const worker = await Worker.findById(workerId).populate('workInfo.preferredWorkingZones');
      if (!worker) return;

      const zones = this.buildMonitoringTargets(worker);

      for (const zone of zones) {
        const pollutionData = await this.fetchPollutionData(zone.coordinates);
        if (pollutionData) {
          await this.saveMonitoringData('pollution', pollutionData, zone);
          
          // Check for pollution triggers
          await this.checkPollutionTriggers(workerId, pollutionData, zone);
        }
      }
    } catch (error) {
      console.error(`Error monitoring pollution for worker ${workerId}:`, error);
    }
  }

  // Monitor traffic for worker
  async monitorTrafficForWorker(workerId) {
    try {
      const worker = await Worker.findById(workerId).populate('workInfo.preferredWorkingZones');
      if (!worker) return;

      // Check if it's working hours
      const now = new Date();
      const currentHour = now.getHours();
      const workHours = worker.workInfo.typicalWorkingHours;
      const startHour = parseInt(workHours.start.split(':')[0]);
      const endHour = parseInt(workHours.end.split(':')[0]);

      if (currentHour < startHour || currentHour > endHour) {
        return; // Not working hours
      }

      const zones = this.buildMonitoringTargets(worker);

      for (const zone of zones) {
        const trafficData = await this.fetchTrafficData(zone.coordinates);
        if (trafficData) {
          await this.saveMonitoringData('traffic', trafficData, zone);
          
          // Check for traffic triggers
          await this.checkTrafficTriggers(workerId, trafficData, zone);
        }
      }
    } catch (error) {
      console.error(`Error monitoring traffic for worker ${workerId}:`, error);
    }
  }

  // Fetch weather data from OpenWeatherMap
  async fetchWeatherData(coordinates) {
    try {
      const { latitude, longitude } = coordinates;
      const apiKey = this.apiEndpoints.weather.openweather.apiKey;
      
      const response = await axios.get(
        `${this.apiEndpoints.weather.openweather.baseUrl}/weather`,
        {
          params: {
            lat: latitude,
            lon: longitude,
            appid: apiKey,
            units: 'metric'
          },
          timeout: 10000
        }
      );

      const weather = response.data;
      
      return {
        source: {
          type: 'weather',
          provider: 'openweather',
          apiEndpoint: '/weather',
          region: {
            coordinates: { latitude, longitude },
            city: weather.name
          }
        },
        data: {
          weather: {
            temperature: weather.main.temp,
            humidity: weather.main.humidity,
            pressure: weather.main.pressure,
            windSpeed: weather.wind?.speed || 0,
            windDirection: weather.wind?.deg || 0,
            rainfall: weather.rain?.['1h'] || 0,
            visibility: weather.visibility / 1000, // Convert to km
            conditions: weather.weather[0].description,
            cloudCover: weather.clouds.all
          }
        },
        metadata: {
          timestamp: new Date(),
          dataQuality: {
            completeness: 0.9,
            accuracy: 0.8,
            timeliness: 0.95,
            confidence: 0.85
          },
          apiResponseTime: response.headers['x-response-time'] || 0
        }
      };
    } catch (error) {
      console.error('Error fetching weather data:', error.message);
      return null;
    }
  }

  // Fetch pollution data from OpenAQ
  async fetchPollutionData(coordinates) {
    try {
      const { latitude, longitude } = coordinates;
      
      const response = await axios.get(
        `${this.apiEndpoints.pollution.openaq.baseUrl}/measurements`,
        {
          params: {
            coordinates: `${latitude},${longitude}`,
            radius: 10000, // 10km radius
            limit: 100,
            order_by: 'datetime',
            sort: 'desc'
          },
          timeout: 10000
        }
      );

      const measurements = response.data.results;
      if (measurements.length === 0) {
        return null;
      }

      // Get latest measurements for each parameter
      const latestData = {};
      measurements.forEach(measurement => {
        if (!latestData[measurement.parameter] || 
            new Date(measurement.datetime) > new Date(latestData[measurement.parameter].datetime)) {
          latestData[measurement.parameter] = measurement;
        }
      });

      // Calculate AQI if not provided
      const pm25 = latestData.pm25?.value || 0;
      const pm10 = latestData.pm10?.value || 0;
      const no2 = latestData.no2?.value || 0;
      const so2 = latestData.so2?.value || 0;
      const co = latestData.co?.value || 0;
      
      // Simple AQI calculation (simplified)
      const aqi = Math.max(
        this.calculateAQI(pm25, 'pm25'),
        this.calculateAQI(pm10, 'pm10'),
        this.calculateAQI(no2, 'no2'),
        this.calculateAQI(so2, 'so2')
      );

      return {
        source: {
          type: 'pollution',
          provider: 'openaq',
          apiEndpoint: '/measurements',
          region: {
            coordinates: { latitude, longitude },
            city: 'Unknown' // OpenAQ doesn't provide city name
          }
        },
        data: {
          pollution: {
            aqi,
            pm25,
            pm10,
            no2,
            so2,
            co,
            dominantPollutant: this.getDominantPollutant(latestData),
            healthImplications: this.getHealthImplications(aqi),
            sensitiveGroups: this.getSensitiveGroups(aqi)
          }
        },
        metadata: {
          timestamp: new Date(),
          dataQuality: {
            completeness: 0.7,
            accuracy: 0.75,
            timeliness: 0.9,
            confidence: 0.8
          },
          apiResponseTime: response.headers['x-response-time'] || 0
        }
      };
    } catch (error) {
      console.error('Error fetching pollution data:', error.message);
      return null;
    }
  }

  // Fetch traffic data from Google Maps API
  async fetchTrafficData(coordinates) {
    try {
      const { latitude, longitude } = coordinates;
      const apiKey = this.apiEndpoints.traffic.google.apiKey;
      
      // Get traffic layer data
      const response = await axios.get(
        `${this.apiEndpoints.traffic.google.baseUrl}/distancematrix/json`,
        {
          params: {
            origins: `${latitude},${longitude}`,
            destinations: `${latitude + 0.01},${longitude + 0.01}`, // Small distance for local traffic
            departure_time: 'now',
            traffic_model: 'best_guess',
            key: apiKey
          },
          timeout: 10000
        }
      );

      const data = response.data;
      if (data.status !== 'OK' || data.rows[0].elements[0].status !== 'OK') {
        return null;
      }

      const element = data.rows[0].elements[0];
      const duration = element.duration;
      const durationInTraffic = element.duration_in_traffic;
      
      // Calculate congestion level based on traffic delay
      const delayRatio = durationInTraffic.value / duration.value;
      const congestionLevel = Math.min(10, Math.max(1, (delayRatio - 1) * 10));
      
      // Calculate average speed (rough estimation)
      const distance = 1.4; // ~1.4km for 0.01 degree difference
      const averageSpeed = (distance / durationInTraffic.value) * 3600; // km/hr

      return {
        source: {
          type: 'traffic',
          provider: 'google',
          apiEndpoint: '/distancematrix',
          region: {
            coordinates: { latitude, longitude },
            city: 'Unknown'
          }
        },
        data: {
          traffic: {
            congestionLevel: Math.round(congestionLevel * 10) / 10,
            averageSpeed: Math.round(averageSpeed * 10) / 10,
            trafficVolume: congestionLevel > 7 ? 'high' : congestionLevel > 4 ? 'medium' : 'low',
            incidents: [], // Would need separate API call for incidents
            publicTransportStatus: {
              buses: 'normal',
              metro: 'normal',
              trains: 'normal'
            }
          }
        },
        metadata: {
          timestamp: new Date(),
          dataQuality: {
            completeness: 0.8,
            accuracy: 0.85,
            timeliness: 0.95,
            confidence: 0.9
          },
          apiResponseTime: response.headers['x-response-time'] || 0
        }
      };
    } catch (error) {
      console.error('Error fetching traffic data:', error.message);
      return null;
    }
  }

  // Save monitoring data to database
  async saveMonitoringData(type, data, zone) {
    try {
      const monitoringData = new MonitoringData({
        ...data,
        'source.region': {
          ...data.source.region,
          state: 'Unknown', // Would need geocoding API
          country: 'IN'
        }
      });

      await monitoringData.save();
      return monitoringData;
    } catch (error) {
      console.error('Error saving monitoring data:', error);
      return null;
    }
  }

  // Check for weather triggers
  async checkWeatherTriggers(workerId, weatherData, zone) {
    try {
      const activePolicies = await Policy.findActive(workerId);
      const weather = weatherData.data.weather;
      const triggeredClaims = [];

      for (const policy of activePolicies) {
        const coveredRisks = policy.coverage.coveredRisks.filter(risk => 
          risk.type === 'extreme_weather' && risk.isActive
        );

        for (const risk of coveredRisks) {
          const thresholds = risk.thresholds.weather;
          
          if (weather.rainfall > thresholds.rainfall ||
              weather.windSpeed > thresholds.windSpeed ||
              weather.temperature > thresholds.temperature) {
            
            // Trigger claim
            const claim = await this.triggerClaim(policy._id, {
              type: 'extreme_weather',
              location: zone.coordinates,
              detectedValues: { weather },
              thresholds
            });

            if (claim) {
              triggeredClaims.push({
                policyId: policy._id,
                policyNumber: policy.policyNumber,
                claimId: claim._id,
                payoutAmount: claim.financial?.payoutAmount || 0,
                rainfall: weather.rainfall,
                threshold: thresholds.rainfall
              });
            }
          }
        }
      }

      return triggeredClaims;
    } catch (error) {
      console.error('Error checking weather triggers:', error);
      return [];
    }
  }

  // Check for pollution triggers
  async checkPollutionTriggers(workerId, pollutionData, zone) {
    try {
      const activePolicies = await Policy.findActive(workerId);
      const pollution = pollutionData.data.pollution;

      for (const policy of activePolicies) {
        const coveredRisks = policy.coverage.coveredRisks.filter(risk => 
          risk.type === 'high_pollution' && risk.isActive
        );

        for (const risk of coveredRisks) {
          const thresholds = risk.thresholds.pollution;
          
          if (pollution.aqi > thresholds.aqi ||
              pollution.pm25 > thresholds.pm25) {
            
            // Trigger claim
            await this.triggerClaim(policy._id, {
              type: 'high_pollution',
              location: zone.coordinates,
              detectedValues: { pollution },
              thresholds
            });
          }
        }
      }
    } catch (error) {
      console.error('Error checking pollution triggers:', error);
    }
  }

  // Check for traffic triggers
  async checkTrafficTriggers(workerId, trafficData, zone) {
    try {
      const activePolicies = await Policy.findActive(workerId);
      const traffic = trafficData.data.traffic;

      for (const policy of activePolicies) {
        const coveredRisks = policy.coverage.coveredRisks.filter(risk => 
          risk.type === 'traffic_congestion' && risk.isActive
        );

        for (const risk of coveredRisks) {
          const thresholds = risk.thresholds.traffic;
          
          if (traffic.congestionLevel > thresholds.congestionLevel ||
              traffic.averageSpeed < thresholds.averageSpeed) {
            
            // Trigger claim
            await this.triggerClaim(policy._id, {
              type: 'traffic_congestion',
              location: zone.coordinates,
              detectedValues: { traffic },
              thresholds
            });
          }
        }
      }
    } catch (error) {
      console.error('Error checking traffic triggers:', error);
    }
  }

  // Trigger claim (will be implemented in claims service)
  async triggerClaim(policyId, triggerData) {
    try {
      // Import claim service to avoid circular dependency
      const claimService = require('./claimService');
      return await claimService.createAutomatedClaim(policyId, triggerData);
    } catch (error) {
      console.error('Error triggering claim:', error);
      return null;
    }
  }

  async evaluateCurrentLocationThreat(workerId, overrideCoordinates = null) {
    try {
      const worker = await Worker.findById(workerId);
      if (!worker) {
        throw new Error('Worker not found');
      }

      const coordinates = overrideCoordinates || worker.locationTracking?.currentLocation || worker.personalInfo?.address?.coordinates;

      if (
        typeof coordinates?.latitude !== 'number' ||
        typeof coordinates?.longitude !== 'number'
      ) {
        throw new Error('Worker location is unavailable');
      }

      const zone = {
        name: worker.locationTracking?.workingRegion || worker.locationTracking?.currentLocation?.city || 'Current Location',
        coordinates: {
          latitude: coordinates.latitude,
          longitude: coordinates.longitude,
          radius: 3
        },
        source: 'live_location'
      };

      const weatherData = await this.fetchWeatherData(zone.coordinates);
      if (!weatherData) {
        throw new Error('Unable to fetch weather data for current location');
      }

      await this.saveMonitoringData('weather', weatherData, zone);

      const weather = weatherData.data.weather;
      const activePolicies = await Policy.findActive(workerId);
      const rainfallThresholds = activePolicies
        .flatMap((policy) => policy.coverage.coveredRisks
          .filter((risk) => risk.type === 'extreme_weather' && risk.isActive)
          .map((risk) => ({
            policyId: policy._id,
            policyNumber: policy.policyNumber,
            rainfallThreshold: risk.thresholds?.weather?.rainfall ?? 15
          })));

      const lowestRainfallThreshold = rainfallThresholds.length > 0
        ? Math.min(...rainfallThresholds.map((item) => item.rainfallThreshold))
        : null;

      const triggeredClaims = await this.checkWeatherTriggers(workerId, weatherData, zone);

      return {
        location: {
          latitude: zone.coordinates.latitude,
          longitude: zone.coordinates.longitude,
          name: zone.name
        },
        weather,
        rainfallThresholds,
        rainfallStatus: {
          exceeded: lowestRainfallThreshold !== null ? weather.rainfall > lowestRainfallThreshold : false,
          currentRainfall: weather.rainfall,
          threshold: lowestRainfallThreshold,
          shortfall: lowestRainfallThreshold !== null
            ? Math.max(0, lowestRainfallThreshold - weather.rainfall)
            : null
        },
        triggeredClaims
      };
    } catch (error) {
      console.error('Error evaluating current location threat:', error);
      throw error;
    }
  }

  // Helper methods for AQI calculation
  calculateAQI(concentration, pollutant) {
    // Simplified AQI calculation
    const breakpoints = {
      pm25: [0, 12, 35.4, 55.4, 150.4, 250.4, 350.4],
      pm10: [0, 54, 154, 254, 354, 424, 504],
      no2: [0, 53, 100, 360, 649, 1249, 1649],
      so2: [0, 35, 75, 185, 303, 604, 804]
    };

    const aqiBreakpoints = [0, 50, 100, 150, 200, 300, 400];
    const pollutantBreakpoints = breakpoints[pollutant];

    for (let i = 0; i < pollutantBreakpoints.length - 1; i++) {
      if (concentration >= pollutantBreakpoints[i] && concentration <= pollutantBreakpoints[i + 1]) {
        const aqiLow = aqiBreakpoints[i];
        const aqiHigh = aqiBreakpoints[i + 1];
        const concLow = pollutantBreakpoints[i];
        const concHigh = pollutantBreakpoints[i + 1];
        
        return Math.round(((aqiHigh - aqiLow) / (concHigh - concLow)) * (concentration - concLow) + aqiLow);
      }
    }
    
    return 500; // Hazardous
  }

  getDominantPollutant(latestData) {
    let dominant = 'pm25';
    let maxValue = 0;
    
    Object.entries(latestData).forEach(([param, data]) => {
      if (data.value > maxValue) {
        maxValue = data.value;
        dominant = param;
      }
    });
    
    return dominant;
  }

  getHealthImplications(aqi) {
    if (aqi <= 50) return 'Air quality is satisfactory';
    if (aqi <= 100) return 'Air quality is acceptable';
    if (aqi <= 150) return 'Members of sensitive groups may experience health effects';
    if (aqi <= 200) return 'Everyone may begin to experience health effects';
    if (aqi <= 300) return 'Health warnings of emergency conditions';
    return 'Emergency conditions: everyone is likely to be affected';
  }

  getSensitiveGroups(aqi) {
    if (aqi <= 100) return 'None';
    if (aqi <= 150) return 'People with respiratory diseases';
    if (aqi <= 200) return 'Children, elderly, people with respiratory diseases';
    return 'Everyone';
  }

  // Get latest monitoring data for a location
  async getLatestDataForLocation(type, coordinates, maxAgeMinutes = 30) {
    try {
      return await MonitoringData.findLatestForLocation(type, coordinates, maxAgeMinutes);
    } catch (error) {
      console.error('Error getting latest data:', error);
      return null;
    }
  }

  // Start monitoring for all active workers
  async startAllWorkerMonitoring() {
    try {
      const activeWorkers = await Worker.find({
        'status.accountStatus': 'active',
        'status.subscriptionStatus': 'active',
        'premium.currentWeekPaid': true
      });
      
      for (const worker of activeWorkers) {
        await this.startWorkerMonitoring(worker._id);
      }
      
      console.log(`Started monitoring for ${activeWorkers.length} active workers`);
    } catch (error) {
      console.error('Error starting all worker monitoring:', error);
    }
  }
}

module.exports = new MonitoringService();
