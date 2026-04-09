const express = require('express');
const router = express.Router();
const db = require('../database');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { requireAuth, requireAdmin } = require('../middleware/authMiddleware');

const SECRET_KEY = process.env.JWT_SECRET;

// Login
router.post('/login', (req, res) => {
    const { document_no, password } = req.body;
    console.log(`[AUTH] Login attempt for doc: ${document_no}`);
    require('fs').appendFileSync('login_debug.txt', `[AUTH] Recv doc: "${document_no}", pass: "${password}", length: ${password?.length}\n`);

    db.get("SELECT * FROM users WHERE document_no = ?", [document_no], (err, user) => {
        if (err) {
            console.error('[AUTH] DB Error:', err);
            return res.status(500).json({ error: 'Database error' });
        }
        if (!user) {
            console.warn('[AUTH] User not found');
            return res.status(401).json({ error: 'Usuario no encontrado' });
        }

        if (user.is_active === 0) {
            console.warn('[AUTH] User suspended');
            return res.status(401).json({ error: 'Su cuenta ha sido suspendida. Contacte al administrador.' });
        }

        console.log(`[AUTH] User found: ${user.full_name}, checking password...`);
        const validPassword = bcrypt.compareSync(password, user.password_hash);
        require('fs').appendFileSync('login_debug.txt', `[AUTH] validPassword=${validPassword}, hash=${user.password_hash}\n`);
        if (!validPassword) {
            console.warn('[AUTH] Invalid password');
            return res.status(401).json({ error: 'Contraseña incorrecta' });
        }

        console.log('[AUTH] Login successful');
        const token = jwt.sign({ id: user.id, role: user.role, name: user.full_name }, SECRET_KEY, { expiresIn: '8h' });

        res.json({ token, user: { id: user.id, name: user.full_name, role: user.role, mustChangePassword: user.must_change_password === 1 } });
    });
});

// Register (Admin only)
router.post('/register', requireAuth, requireAdmin, (req, res) => {
    const { full_name, area, position, document_no, password, email } = req.body;

    const salt = bcrypt.genSaltSync(10);
    const hash = bcrypt.hashSync(password, salt);

    const stmt = db.prepare("INSERT INTO users (full_name, area, position, document_no, password_hash, email) VALUES (?, ?, ?, ?, ?, ?)");

    stmt.run(full_name, area, position, document_no, hash, email, function (err) {
        if (err) {
            return res.status(400).json({ error: 'Error registrando usuario (posible duplicado)' });
        }
        res.json({ message: 'Usuario registrado exitosamente', id: this.lastID });
    });
    stmt.finalize();
});

module.exports = router;
