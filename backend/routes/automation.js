const express = require('express');
const router = express.Router();
const automationController = require('../controllers/automationController');

router.post('/execute', automationController.executeAutomation);
router.post('/unity-execute', automationController.executeUnityAutomation);
router.get('/stream', automationController.streamAutomation);
router.post('/diagnostic', automationController.executeDiagnostic);
router.post('/unity-robot', automationController.runUnityRobot);

module.exports = router;

