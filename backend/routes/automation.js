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

// Rutas del Bot Verificador Independiente OnBase + Desbloqueo Remoto + Alertas Móvil/PC
router.post('/verify-expedientes', requireAuth, setLongTimeout, automationController.verifyExpedientesOnBase);
router.get('/verification-report', requireAuth, automationController.getVerificationReport);
router.post('/toggle-auto-verify', requireAuth, automationController.toggleAutoVerify);
router.post('/unlock-bot', requireAuth, automationController.unlockBotSession);
router.post('/skip-verifier-wait', requireAuth, automationController.skipVerifierWait);
router.get('/alert-settings', requireAuth, automationController.getAlertSettings);
router.post('/alert-settings', requireAuth, automationController.saveAlertSettings);
router.post('/test-alert', requireAuth, automationController.sendTestAlert);
router.post('/clear-alerts', requireAuth, automationController.clearSystemAlerts);

module.exports = router;

