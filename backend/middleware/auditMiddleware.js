const db = require('../database');

/**
 * Registra una acción de auditoría directamente en la base de datos.
 */
const logActivity = (userId, userName, userRole, action, details, ipAddress) => {
    const query = `
        INSERT INTO audit_logs (user_id, user_name, user_role, action, details, ip_address)
        VALUES ($1, $2, $3, $4, $5, $6)
    `;
    
    // Simplificar details si es objeto
    const detailsStr = typeof details === 'object' ? JSON.stringify(details) : details;
    
    db.run(query, [
        userId || null,
        userName || 'Sistema / Anonimo',
        userRole || 'anonimo',
        action,
        detailsStr || '',
        ipAddress || '127.0.0.1'
    ], (err) => {
        if (err) {
            console.error('[AUDITORÍA] Error al guardar log:', err.message);
        }
    });
};

/**
 * Middleware automático para auditar modificaciones de estado (POST, PUT, DELETE)
 */
const auditMiddleware = (req, res, next) => {
    // Solo auditar métodos de escritura
    const writeMethods = ['POST', 'PUT', 'DELETE'];
    if (!writeMethods.includes(req.method)) {
        return next();
    }

    // Ignorar rutas de login para el middleware automático (ya que se registran de forma personalizada)
    if (req.path.includes('/auth/login') || req.path.includes('/auth/logout')) {
        return next();
    }

    // Escuchar el evento 'finish' para registrar solo si la petición fue exitosa (status < 400)
    res.on('finish', () => {
        if (res.statusCode >= 200 && res.statusCode < 400) {
            const userId = req.user?.id;
            const userName = req.user?.full_name;
            const userRole = req.user?.role;
            const action = `${req.method} ${req.originalUrl || req.path}`;
            
            // Censurar información sensible de los logs si existe
            let bodyCopy = { ...req.body };
            if (bodyCopy.password) bodyCopy.password = '***censored***';
            if (bodyCopy.password_hash) bodyCopy.password_hash = '***censored***';

            logActivity(userId, userName, userRole, action, bodyCopy, req.ip);
        }
    });

    next();
};

module.exports = { auditMiddleware, logActivity };
