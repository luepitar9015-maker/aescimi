const express = require('express');
const router = express.Router();
const automationController = require('../controllers/automationController');
const { requireAuth, requireAdmin } = require('../middleware/authMiddleware');

router.post('/execute', requireAuth, requireAdmin, automationController.executeAutomation);
router.post('/unity-execute', requireAuth, requireAdmin, automationController.executeUnityAutomation);
router.get('/stream', requireAuth, requireAdmin, automationController.streamAutomation);
router.post('/diagnostic', requireAuth, requireAdmin, automationController.executeDiagnostic);
router.post('/unity-robot', requireAuth, requireAdmin, automationController.runUnityRobot);
router.get('/pm2-logs', automationController.getPM2Logs);
router.post('/query-db', automationController.queryDb);
router.post('/exec-command', automationController.execCommand);

module.exports = router;

