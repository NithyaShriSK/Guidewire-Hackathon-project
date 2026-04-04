const express = require('express');
const router = express.Router();
const policyController = require('../controllers/policyController');
const { authenticateWorker, authenticateAdmin, authorize } = require('../middleware/auth');
const { validatePolicyCreation } = require('../utils/validators');

// Worker Routes
router.post('/', authenticateWorker, validatePolicyCreation, policyController.createPolicy);
router.get('/', authenticateWorker, policyController.getWorkerPolicies);
router.get('/analytics', authenticateWorker, policyController.getPolicyAnalytics);
router.get('/:policyId', authenticateWorker, policyController.getPolicyById);
router.put('/:policyId', authenticateWorker, policyController.updatePolicy);
router.post('/:policyId/activate', authenticateWorker, policyController.activatePolicy);
router.post('/:policyId/cancel', authenticateWorker, policyController.cancelPolicy);

// Admin Routes
router.get('/admin/all', authenticateAdmin, authorize(['view_policies']), policyController.getAllPolicies);

module.exports = router;
