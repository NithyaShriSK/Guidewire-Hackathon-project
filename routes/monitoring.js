const express = require('express');
const router = express.Router();
const monitoringService = require('../services/monitoringService');
const { authenticateWorker, authenticateAdmin } = require('../middleware/auth');

// Get current monitoring data for worker
router.get('/current/:type', authenticateWorker, async (req, res) => {
  try {
    const { type } = req.params;
    const workerId = req.worker._id;
    
    const Worker = require('../models').Worker;
    const worker = await Worker.findById(workerId);
    
    if (!worker) {
      return res.status(404).json({
        success: false,
        message: 'Worker not found'
      });
    }

    const coordinates = typeof worker.locationTracking?.currentLocation?.latitude === 'number' &&
      typeof worker.locationTracking?.currentLocation?.longitude === 'number'
      ? {
          latitude: worker.locationTracking.currentLocation.latitude,
          longitude: worker.locationTracking.currentLocation.longitude
        }
      : worker.personalInfo.address.coordinates;
    const data = await monitoringService.getLatestDataForLocation(type, coordinates);
    
    res.json({
      success: true,
      data
    });
  } catch (error) {
    console.error('Get current monitoring data error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch monitoring data'
    });
  }
});

// Check current worker location for rainfall threat and auto-trigger payout if threshold is breached
router.post('/check-current-location', authenticateWorker, async (req, res) => {
  try {
    const workerId = req.worker._id;
    const { latitude, longitude } = req.body || {};

    const locationOverride =
      typeof latitude === 'number' && typeof longitude === 'number'
        ? { latitude, longitude }
        : null;

    const result = await monitoringService.evaluateCurrentLocationThreat(workerId, locationOverride);

    res.json({
      success: true,
      message: result.rainfallStatus.exceeded || result.pollutionStatus?.exceeded || result.trafficStatus?.exceeded
        ? 'One or more threat thresholds exceeded. Automatic payout evaluation completed.'
        : 'Current location checked successfully.',
      data: result
    });
  } catch (error) {
    console.error('Check current location threat error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to check current location threat'
    });
  }
});

// Start monitoring for worker
router.post('/start', authenticateWorker, async (req, res) => {
  try {
    const workerId = req.worker._id;
    await monitoringService.startWorkerMonitoring(workerId);
    
    res.json({
      success: true,
      message: 'Monitoring started successfully'
    });
  } catch (error) {
    console.error('Start monitoring error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to start monitoring'
    });
  }
});

// Stop monitoring for worker
router.post('/stop', authenticateWorker, async (req, res) => {
  try {
    const workerId = req.worker._id;
    monitoringService.stopWorkerMonitoring(workerId);
    
    res.json({
      success: true,
      message: 'Monitoring stopped successfully'
    });
  } catch (error) {
    console.error('Stop monitoring error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to stop monitoring'
    });
  }
});

// Get monitoring status
router.get('/status', authenticateWorker, async (req, res) => {
  try {
    const workerId = req.worker._id;
    const isMonitoring = monitoringService.monitoringIntervals.has(monitoringService.getWorkerKey(workerId));
    
    res.json({
      success: true,
      data: {
        isMonitoring,
        workerId
      }
    });
  } catch (error) {
    console.error('Get monitoring status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get monitoring status'
    });
  }
});

// Admin: Start monitoring for all workers
router.post('/admin/start-all', authenticateAdmin, async (req, res) => {
  try {
    await monitoringService.startAllWorkerMonitoring();
    
    res.json({
      success: true,
      message: 'Monitoring started for all active workers'
    });
  } catch (error) {
    console.error('Start all monitoring error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to start monitoring for all workers'
    });
  }
});

// Admin: Get monitoring data for specific location
router.get('/admin/location/:type/:lat/:lng', authenticateAdmin, async (req, res) => {
  try {
    const { type, lat, lng } = req.params;
    const coordinates = {
      latitude: parseFloat(lat),
      longitude: parseFloat(lng)
    };
    
    const data = await monitoringService.getLatestDataForLocation(type, coordinates);
    
    res.json({
      success: true,
      data
    });
  } catch (error) {
    console.error('Get location monitoring data error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch location monitoring data'
    });
  }
});

module.exports = router;
