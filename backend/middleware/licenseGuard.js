const crypto = require('crypto');
const express = require('express');
const { pool } = require('../database_pg');

// ============================================================================
// SISTEMA DE LICENCIAMIENTO CRIPTOGRÁFICO ASIMÉTRICO (Ed25519) - ESTRATEGIA 180
// ============================================================================

const PUBLIC_KEY_PEM = `-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEAMkIm0jK7spDC+lnYIwOtWZkVtKtpOcPqIhT7UxjY/3w=
-----END PUBLIC KEY-----`;

const KDF_SALT = 'ESTRATEGIA_180_SENA_V2_SALT_2026';
const PKCS8_ED25519_PREFIX = Buffer.from('302e020100300506032b657004220420', 'hex');

// Token inicial firmado con vigencia hasta 31/01/2027 (2027-01-31)
const INITIAL_SIGNED_TOKEN = 'EST180.eyJ2IjoxLCJpc3MiOiJFc3RyYXRlZ2lhIDE4MCIsImV4cCI6IjIwMjctMDEtMzEiLCJpYXQiOiIyMDI2LTExLTAyIn0.K9gpVQHlFL5ha0sSqxlj0lbP9ADK6LJ3ji5Di1a9wf4oddNn-XhJuU65r8_nhzp18GhCmC96fnCmbuRlJlsRAQ';

let cachedStatus = null;
let lastCheckTime = 0;
const CACHE_TTL_MS = 15000;

function getBogotaDateString() {
    try {
        return new Intl.DateTimeFormat('en-CA', {
            timeZone: 'America/Bogota',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        }).format(new Date());
    } catch (_) {
        return new Date().toISOString().split('T')[0];
    }
}

function verifyLicenseToken(tokenStr) {
    if (!tokenStr || typeof tokenStr !== 'string') {
        return {
            valid: false,
            expired: true,
            exp: null,
            reason: 'Licencia del sistema vencida. Debe ingresar con el Superusuario para activarlo.'
        };
    }

    const parts = tokenStr.trim().split('.');
    if (parts.length !== 3 || parts[0] !== 'EST180') {
        return {
            valid: false,
            expired: true,
            exp: null,
            reason: 'Licencia del sistema inválida o alterada. Debe ingresar con el Superusuario para activarlo.'
        };
    }

    const [, payloadB64, sigB64] = parts;

    try {
        const signatureValid = crypto.verify(
            null,
            Buffer.from(payloadB64, 'utf8'),
            PUBLIC_KEY_PEM,
            Buffer.from(sigB64, 'base64url')
        );

        if (!signatureValid) {
            return {
                valid: false,
                expired: true,
                exp: null,
                reason: 'Firma criptográfica inválida. Debe ingresar con el Superusuario para activarlo.'
            };
        }

        const payloadJson = Buffer.from(payloadB64, 'base64url').toString('utf8');
        const payload = JSON.parse(payloadJson);

        if (!payload.exp || !/^\d{4}-\d{2}-\d{2}$/.test(payload.exp)) {
            return {
                valid: false,
                expired: true,
                exp: null,
                reason: 'Fecha de licencia inválida. Debe ingresar con el Superusuario para activarlo.'
            };
        }

        const today = getBogotaDateString();

        if (payload.iat && today < payload.iat && today < '2026-10-01') {
            return {
                valid: false,
                expired: true,
                exp: payload.exp,
                reason: 'Inconsistencia en el reloj del servidor detectada. Debe ingresar con el Superusuario para activarlo.'
            };
        }

        const expTime = new Date(`${payload.exp}T23:59:59-05:00`).getTime();
        const nowTime = Date.now();
        const daysRemaining = Math.ceil((expTime - nowTime) / (1000 * 60 * 60 * 24));

        if (today > payload.exp) {
            return {
                valid: false,
                expired: true,
                exp: payload.exp,
                issuer: payload.iss || 'Estrategia 180',
                daysRemaining: 0,
                reason: 'Licencia del sistema vencida. Debe ingresar con el Superusuario para activarlo.'
            };
        }

        return {
            valid: true,
            expired: false,
            exp: payload.exp,
            iat: payload.iat,
            issuer: payload.iss || 'Estrategia 180',
            daysRemaining: Math.max(0, daysRemaining),
            reason: 'Licencia activa.'
        };
    } catch (err) {
        return {
            valid: false,
            expired: true,
            exp: null,
            reason: 'Certificado de licencia inválido. Debe ingresar con el Superusuario para activarlo.'
        };
    }
}

function signLicenseWithMasterKey(masterKey, expDate) {
    if (!masterKey || typeof masterKey !== 'string') {
        throw new Error('Debe ingresar la Clave Maestra de Autor.');
    }
    if (!expDate || !/^\d{4}-\d{2}-\d{2}$/.test(expDate)) {
        throw new Error('Formato de fecha inválido (use YYYY-MM-DD).');
    }

    const seed = crypto.scryptSync(masterKey.trim(), KDF_SALT, 32);
    const privateKey = crypto.createPrivateKey({
        key: Buffer.concat([PKCS8_ED25519_PREFIX, seed]),
        format: 'der',
        type: 'pkcs8'
    });
    const derivedPublicPem = crypto.createPublicKey(privateKey)
        .export({ type: 'spki', format: 'pem' })
        .trim();

    if (derivedPublicPem !== PUBLIC_KEY_PEM.trim()) {
        throw new Error('Clave Maestra de Autor incorrecta.');
    }

    const payloadObj = {
        v: 1,
        iss: 'Estrategia 180',
        exp: expDate,
        iat: getBogotaDateString()
    };

    const payloadB64 = Buffer.from(JSON.stringify(payloadObj), 'utf8').toString('base64url');
    const sigB64 = crypto.sign(null, Buffer.from(payloadB64, 'utf8'), privateKey).toString('base64url');

    return `EST180.${payloadB64}.${sigB64}`;
}

async function initLicenseSystem() {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS system_settings (
                key   TEXT PRIMARY KEY NOT NULL,
                value TEXT,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        const res = await pool.query("SELECT value FROM system_settings WHERE key = 'system_license_token'");
        const existingToken = res.rows[0]?.value;

        if (!existingToken) {
            await pool.query(
                `INSERT INTO system_settings (key, value, updated_at)
                 VALUES ('system_license_token', $1, CURRENT_TIMESTAMP)
                 ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = CURRENT_TIMESTAMP`,
                [INITIAL_SIGNED_TOKEN]
            );
            await pool.query(
                `INSERT INTO system_settings (key, value, updated_at)
                 VALUES ('system_expiration_date', '2027-01-31', CURRENT_TIMESTAMP)
                 ON CONFLICT (key) DO UPDATE SET value = '2027-01-31', updated_at = CURRENT_TIMESTAMP`
            );
        } else {
            const check = verifyLicenseToken(existingToken);
            if (check.exp) {
                await pool.query(
                    `INSERT INTO system_settings (key, value, updated_at)
                     VALUES ('system_expiration_date', $1, CURRENT_TIMESTAMP)
                     ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = CURRENT_TIMESTAMP`,
                    [check.exp]
                );
            }
        }
    } catch (err) {
        console.error('[LICENSE] Error inicializando licencia:', err.message);
    }
}

async function getCurrentLicenseStatus(forceRefresh = false) {
    const now = Date.now();
    if (!forceRefresh && cachedStatus && (now - lastCheckTime < CACHE_TTL_MS)) {
        return cachedStatus;
    }

    try {
        const res = await pool.query("SELECT value FROM system_settings WHERE key = 'system_license_token'");
        const tokenStr = res.rows[0]?.value || '';
        const status = verifyLicenseToken(tokenStr);
        cachedStatus = status;
        lastCheckTime = now;
        return status;
    } catch (err) {
        return {
            valid: false,
            expired: true,
            exp: null,
            reason: 'Error verificando la licencia del sistema.'
        };
    }
}

/**
 * Middleware: cuando la licencia está vencida, solo permite el acceso al Superusuario
 * para que pueda entrar al módulo de Superusuario y activarla.
 */
async function enforceLicense(req, res, next) {
    if (req.path.startsWith('/api/license') || req.path.startsWith('/api/auth')) {
        return next();
    }
    if (!req.path.startsWith('/api')) {
        return next();
    }

    const status = await getCurrentLicenseStatus();
    if (!status.valid) {
        // Si está vencida, únicamente el superadmin puede navegar al módulo de superusuario para activarla
        if (req.user && req.user.role === 'superadmin') {
            return next();
        }
        return res.status(403).json({
            error: 'Licencia del sistema vencida. Debe ingresar con el Superusuario para activarlo.',
            licenseExpired: true,
            exp: status.exp
        });
    }

    next();
}

const licenseRouter = express.Router();

licenseRouter.get('/status', async (req, res) => {
    const status = await getCurrentLicenseStatus(true);
    res.json(status);
});

licenseRouter.post('/activate', async (req, res) => {
    try {
        if (!req.user || req.user.role !== 'superadmin') {
            return res.status(403).json({
                error: 'Acceso denegado. Debe ingresar con el Superusuario para activar la licencia.'
            });
        }

        const { token, masterKey, expirationDate } = req.body;
        let finalToken = '';

        if (token && typeof token === 'string' && token.trim().startsWith('EST180.')) {
            finalToken = token.trim();
        } else if (masterKey && expirationDate) {
            finalToken = signLicenseWithMasterKey(masterKey, expirationDate);
        } else {
            return res.status(400).json({
                error: 'Debe proporcionar un Token firmado (EST180...) o su Clave Maestra junto con la fecha.'
            });
        }

        const check = verifyLicenseToken(finalToken);
        if (!check.valid) {
            return res.status(400).json({
                error: check.reason || 'El token proporcionado está vencido o su firma no es válida.'
            });
        }

        await pool.query(
            `INSERT INTO system_settings (key, value, updated_at)
             VALUES ('system_license_token', $1, CURRENT_TIMESTAMP)
             ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = CURRENT_TIMESTAMP`,
            [finalToken]
        );
        await pool.query(
            `INSERT INTO system_settings (key, value, updated_at)
             VALUES ('system_expiration_date', $1, CURRENT_TIMESTAMP)
             ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = CURRENT_TIMESTAMP`,
            [check.exp]
        );

        cachedStatus = check;
        lastCheckTime = Date.now();

        res.json({
            success: true,
            message: `Licencia activada exitosamente hasta el ${check.exp}.`,
            status: check,
            token: finalToken
        });
    } catch (err) {
        res.status(403).json({ error: err.message || 'No se pudo activar la licencia.' });
    }
});

module.exports = {
    initLicenseSystem,
    getCurrentLicenseStatus,
    enforceLicense,
    licenseRouter,
    verifyLicenseToken,
    signLicenseWithMasterKey
};
