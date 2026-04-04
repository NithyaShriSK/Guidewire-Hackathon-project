const mongoose = require('mongoose');

const monitoringDataSchema = new mongoose.Schema({
  source: {
    type: { type: String, enum: ['weather', 'pollution', 'traffic', 'civil_unrest'], required: true },
    provider: { type: String, required: true }, // openweather, openaq, google, etc.
    apiEndpoint: { type: String, required: true },
    region: {
      country: { type: String, default: 'IN' },
      state: { type: String, required: true },
      city: { type: String, required: true },
      coordinates: {
        latitude: { type: Number, required: true },
        longitude: { type: Number, required: true }
      }
    }
  },
  
  data: {
    weather: {
      temperature: { type: Number }, // °C
      humidity: { type: Number }, // %
      pressure: { type: Number }, // hPa
      windSpeed: { type: Number }, // km/hr
      windDirection: { type: Number }, // degrees
      rainfall: { type: Number }, // mm/hr
      visibility: { type: Number }, // km
      uvIndex: { type: Number },
      cloudCover: { type: Number }, // %
      conditions: { type: String }, // clear, rain, storm, etc.
      alerts: [{
        type: { type: String, enum: ['warning', 'watch', 'advisory'] },
        title: { type: String },
        description: { type: String },
        severity: { type: String, enum: ['minor', 'moderate', 'severe', 'extreme'] },
        startTime: { type: Date },
        endTime: { type: Date }
      }]
    },
    
    pollution: {
      aqi: { type: Number }, // Air Quality Index
      pm25: { type: Number }, // μg/m³
      pm10: { type: Number }, // μg/m³
      no2: { type: Number }, // μg/m³
      so2: { type: Number }, // μg/m³
      co: { type: Number }, // μg/m³
      o3: { type: Number }, // μg/m³
      dominantPollutant: { type: String },
      healthImplications: { type: String },
      sensitiveGroups: { type: String }
    },
    
    traffic: {
      congestionLevel: { type: Number }, // 1-10 scale
      averageSpeed: { type: Number }, // km/hr
      trafficVolume: { type: Number }, // vehicles per hour
      incidents: [{
        type: { type: String, enum: ['accident', 'construction', 'road_closure', 'weather_related'] },
        severity: { type: String, enum: ['minor', 'moderate', 'major'] },
        location: { type: String },
        description: { type: String },
        estimatedDelay: { type: Number }, // minutes
        startTime: { type: Date },
        endTime: { type: Date },
        affectedRoutes: [String]
      }],
      publicTransportStatus: {
        buses: { type: String, enum: ['normal', 'delayed', 'suspended'] },
        metro: { type: String, enum: ['normal', 'delayed', 'suspended'] },
        trains: { type: String, enum: ['normal', 'delayed', 'suspended'] }
      }
    },
    
    civilUnrest: {
      severity: { type: Number }, // 1-10 scale
      type: { type: String }, // protest, strike, curfew, etc.
      affectedAreas: [String],
      restrictions: [{
        type: { type: String, enum: ['movement', 'assembly', 'commercial', 'internet'] },
        description: { type: String },
        startTime: { type: Date },
        endTime: { type: Date },
        affectedZones: [String]
      }],
      safetyLevel: { type: String, enum: ['safe', 'caution', 'dangerous'] },
      officialAdvisories: [{
        source: { type: String },
        message: { type: String },
        timestamp: { type: Date },
        priority: { type: String, enum: ['low', 'medium', 'high', 'critical'] }
      }]
    }
  },
  
  metadata: {
    timestamp: { type: Date, required: true },
    dataQuality: {
      completeness: { type: Number, min: 0, max: 1 }, // 0-1 scale
      accuracy: { type: Number, min: 0, max: 1 }, // 0-1 scale
      timeliness: { type: Number, min: 0, max: 1 }, // 0-1 scale
      confidence: { type: Number, min: 0, max: 1 } // 0-1 scale
    },
    processingTime: { type: Number }, // milliseconds
    apiResponseTime: { type: Number }, // milliseconds
    retryCount: { type: Number, default: 0 },
    lastSuccessfulFetch: { type: Date },
    nextScheduledFetch: { type: Date }
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for performance
monitoringDataSchema.index({ 'source.type': 1, 'metadata.timestamp': -1 });
monitoringDataSchema.index({ 'source.region.coordinates': '2dsphere' });
monitoringDataSchema.index({ 'source.region.city': 1, 'metadata.timestamp': -1 });
monitoringDataSchema.index({ 'source.provider': 1 });
monitoringDataSchema.index({ 'metadata.timestamp': -1 });

// Compound index for efficient queries
monitoringDataSchema.index({ 
  'source.type': 1, 
  'source.region.city': 1, 
  'metadata.timestamp': -1 
});

// TTL index to automatically delete old data (90 days)
monitoringDataSchema.index({ 'metadata.timestamp': 1 }, { expireAfterSeconds: 7776000 });

// Virtual for age of data
monitoringDataSchema.virtual('dataAge').get(function() {
  return Date.now() - this.metadata.timestamp.getTime();
});

// Virtual for isRecent
monitoringDataSchema.virtual('isRecent').get(function() {
  const fiveMinutesAgo = Date.now() - (5 * 60 * 1000);
  return this.metadata.timestamp.getTime() > fiveMinutesAgo;
});

// Static method to find latest data for location
monitoringDataSchema.statics.findLatestForLocation = function(type, coordinates, maxAgeMinutes = 30) {
  const maxAge = new Date(Date.now() - (maxAgeMinutes * 60 * 1000));
  
  return this.find({
    'source.type': type,
    'source.region.coordinates': {
      $near: {
        $geometry: {
          type: 'Point',
          coordinates: [coordinates.longitude, coordinates.latitude]
        },
        $maxDistance: 10000 // 10km
      }
    },
    'metadata.timestamp': { $gte: maxAge }
  }).sort({ 'metadata.timestamp': -1 }).limit(1);
};

// Static method to find data for time range
monitoringDataSchema.statics.findByTimeRange = function(type, city, startDate, endDate) {
  return this.find({
    'source.type': type,
    'source.region.city': city,
    'metadata.timestamp': {
      $gte: startDate,
      $lte: endDate
    }
  }).sort({ 'metadata.timestamp': 1 });
};

// Static method to get aggregated data for location
monitoringDataSchema.statics.getAggregatedForLocation = function(type, coordinates, hours = 24) {
  const startDate = new Date(Date.now() - (hours * 60 * 60 * 1000));
  
  return this.aggregate([
    {
      $match: {
        'source.type': type,
        'source.region.coordinates': {
          $near: {
            $geometry: {
              type: 'Point',
              coordinates: [coordinates.longitude, coordinates.latitude]
            },
            $maxDistance: 10000 // 10km
          }
        },
        'metadata.timestamp': { $gte: startDate }
      }
    },
    {
      $group: {
        _id: null,
        avgTemperature: { $avg: '$data.weather.temperature' },
        maxTemperature: { $max: '$data.weather.temperature' },
        minTemperature: { $min: '$data.weather.temperature' },
        avgAQI: { $avg: '$data.pollution.aqi' },
        maxAQI: { $max: '$data.pollution.aqi' },
        avgCongestion: { $avg: '$data.traffic.congestionLevel' },
        dataPoints: { $sum: 1 },
        lastUpdate: { $max: '$metadata.timestamp' }
      }
    }
  ]);
};

module.exports = mongoose.model('MonitoringData', monitoringDataSchema);
