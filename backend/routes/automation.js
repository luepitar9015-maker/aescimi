const express = require('express');
const router = express.Router();
const automationController = require('../controllers/automationController');
const { requireAuth, requireAdmin } = require('../middleware/authMiddleware');

const setLongTimeout = (req, res, next) => {
    req.setTimeout(600000);
    res.setTimeout(600000);
    next();
};

router.post('/execute', requireAuth, requireAdmin, setLongTimeout, automationController.executeAutomation);
router.get('/status', requireAuth, requireAdmin, automationController.getAutomationStatus);
router.get('/frame', requireAuth, requireAdmin, automationController.getAutomationFrame);
router.post('/unity-execute', requireAuth, requireAdmin, setLongTimeout, automationController.executeUnityAutomation);
router.get('/stream', requireAuth, requireAdmin, automationController.streamAutomation);
router.post('/diagnostic', requireAuth, requireAdmin, automationController.executeDiagnostic);
router.post('/unity-robot', requireAuth, requireAdmin, automationController.runUnityRobot);
router.get('/pm2-logs', automationController.getPM2Logs);

// Rutas de Interacción Manual
router.post('/click', requireAuth, requireAdmin, automationController.clickActivePage);
router.post('/type', requireAuth, requireAdmin, automationController.typeActivePage);
router.post('/press-key', requireAuth, requireAdmin, automationController.pressKeyActivePage);
router.post('/kill', requireAuth, requireAdmin, automationController.killActiveAutomation);

module.exports = router;

