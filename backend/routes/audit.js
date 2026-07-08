const express = require('express');
const router = express.Router();
const { requireAuth, requireAdmin } = require('../middleware/authMiddleware');
const { pool } = require('../database_pg');

// GET all audit logs (Administrative only)
router.get('/', requireAuth, requireAdmin, async (req, res) => {
    const page = parseInt(req.query.page || '1', 10);
    const limit = parseInt(req.query.limit || '50', 10);
    const offset = (page - 1) * limit;

    const userFilter = req.query.user || '';
    const actionFilter = req.query.action || '';
    const startDate = req.query.startDate || '';
    const endDate = req.query.endDate || '';

    try {
        let whereClauses = [];
        let params = [];
        let paramIndex = 1;

        if (userFilter) {
            whereClauses.push(`(user_name ILIKE $${paramIndex} OR user_role ILIKE $${paramIndex})`);
            params.push(`%${userFilter}%`);
            paramIndex++;
        }

        if (actionFilter) {
            whereClauses.push(`action ILIKE $${paramIndex}`);
            params.push(`%${actionFilter}%`);
            paramIndex++;
        }

        if (startDate) {
            whereClauses.push(`created_at >= $${paramIndex}`);
            params.push(startDate);
            paramIndex++;
        }

        if (endDate) {
            whereClauses.push(`created_at <= $${paramIndex}`);
            params.push(endDate);
            paramIndex++;
        }

        const whereSQL = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

        // Query total count
        const countQuery = `SELECT COUNT(*) FROM audit_logs ${whereSQL}`;
        const countRes = await pool.query(countQuery, params);
        const total = parseInt(countRes.rows[0].count, 10);

        // Query paginated data
        const dataParams = [...params, limit, offset];
        const dataQuery = `
            SELECT * FROM audit_logs 
            ${whereSQL} 
            ORDER BY created_at DESC 
            LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
        `;
        
        const dataRes = await pool.query(dataQuery, dataParams);

        res.json({
            data: dataRes.rows,
            pagination: {
                total,
                page,
                limit,
                pages: Math.ceil(total / limit)
            }
        });

    } catch (err) {
        console.error('[AUDITORÍA ROUTE] Error fetching logs:', err);
        res.status(500).json({ error: 'Error al obtener registros de auditoría.' });
    }
});

module.exports = router;
