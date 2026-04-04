const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authenticateWorker, authenticateAdmin, optionalAuth } = require('../middleware/auth');
const {
  validateWorkerRegistration,
  validateWorkerLogin,
  validateWorkInfo,
  validateFinancialInfo,
  validateAdminRegistration,
  validateAdminLogin
} = require('../utils/validators');

// Worker Routes
router.post('/worker/register', validateWorkerRegistration, authController.registerWorker);
router.post('/worker/login', validateWorkerLogin, authController.loginWorker);
router.put('/worker/work-info', authenticateWorker, validateWorkInfo, authController.updateWorkInfo);
router.put('/worker/financial-info', authenticateWorker, validateFinancialInfo, authController.updateFinancialInfo);
router.post('/worker/complete-onboarding', authenticateWorker, authController.completeOnboarding);

// Admin Routes
router.post('/admin/register', validateAdminRegistration, authController.registerAdmin);
router.post('/admin/login', validateAdminLogin, authController.loginAdmin);

// Common Routes
router.get('/profile', optionalAuth, authController.getCurrentProfile);

module.exports = router;
