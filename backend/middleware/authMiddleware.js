const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
    console.error('[FATAL] JWT_SECRET environment variable is not set. The server cannot start securely.');
    process.exit(1);
}

/**
 * requireAuth - Verifica que la petición tenga un JWT válido.
 * Retorna 401 si no hay token o es inválido/expirado.
 */
const requireAuth = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    console.log(`[AUTH MIDDLEWARE] Path: ${req.path}, Method: ${req.method}, AuthHeader: ${authHeader ? 'PRESENT (starts with ' + authHeader.substring(0, 15) + '...)' : 'MISSING'}`);
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        console.log('[AUTH MIDDLEWARE] REJECTED - Missing token or AuthHeader');
        return res.status(401).json({ error: 'Acceso no autorizado. Se requiere autenticación.' });
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        next();
    } catch (err) {
        if (err.name === 'TokenExpiredError') {
            return res.status(401).json({ error: 'Sesión expirada. Por favor, inicie sesión nuevamente.' });
        }
        return res.status(401).json({ error: 'Token inválido.' });
    }
};

/**
 * requireAdmin - Verifica que el usuario autenticado sea admin o superadmin.
 * Debe usarse DESPUÉS de requireAuth.
 */
const requireAdmin = (req, res, next) => {
    if (!req.user || (req.user.role !== 'admin' && req.user.role !== 'superadmin')) {
        return res.status(403).json({ error: 'Acceso denegado. Se requiere rol de administrador.' });
    }
    next();
};

/**
 * requireSuperAdmin - Verifica que el usuario sea superadmin.
 * Debe usarse DESPUÉS de requireAuth.
 */
const requireSuperAdmin = (req, res, next) => {
    if (!req.user || req.user.role !== 'superadmin') {
        return res.status(403).json({ error: 'Acceso denegado. Se requiere rol de superadministrador.' });
    }
    next();
};

module.exports = { requireAuth, requireAdmin, requireSuperAdmin };
