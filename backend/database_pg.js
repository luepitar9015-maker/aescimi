const { Pool } = require('pg');

const pool = new Pool({
    user: process.env.DB_USER || 'cimi',
    host: process.env.DB_HOST || '192.168.8.164',
    database: process.env.DB_NAME || 'sena_db',
    password: process.env.DB_PASSWORD || 'Aut0m4t1z4d0r2026%*',
    port: parseInt(process.env.DB_PORT || '5432', 10),
});

// SQLite-like compatibility wrapper
const db = {
    get: (sql, params, callback) => {
        // Convert ? to $1, $2, etc.
        let count = 0;
        const pgSql = sql.replace(/\?/g, () => `$${++count}`);
        pool.query(pgSql, params, (err, res) => {
            if (err) callback(err);
            else callback(null, res.rows[0]);
        });
    },
    all: (sql, params, callback) => {
        let count = 0;
        const pgSql = sql.replace(/\?/g, () => `$${++count}`);
        pool.query(pgSql, params, (err, res) => {
            if (err) callback(err);
            else callback(null, res.rows);
        });
    },
    run: (sql, params, callback) => {
        let count = 0;
        let pgSql = sql.replace(/\?/g, () => `$${++count}`);
        
        // Auto-append RETURNING id for INSERT if not present
        const isInsert = pgSql.trim().toUpperCase().startsWith('INSERT');
        if (isInsert && !pgSql.toUpperCase().includes('RETURNING')) {
            pgSql += ' RETURNING id';
        }

        pool.query(pgSql, params, function(err, res) {
            if (err) {
                if (callback) callback(err);
            } else {
                let lastID = null;
                if (isInsert && res.rows && res.rows[0]) {
                    lastID = res.rows[0].id;
                }
                if (callback) callback.call({ lastID: lastID, changes: res.rowCount }, null);
            }
        });
    },
    prepare: (sql) => {
        return {
            run: function(...args) {
                const callback = typeof args[args.length - 1] === 'function' ? args.pop() : null;
                // If the first argument is an array (params), use it directly
                const params = (args.length === 1 && Array.isArray(args[0])) ? args[0] : args;
                db.run(sql, params, callback);
            },
            finalize: (callback) => {
                if (typeof callback === 'function') callback();
            }
        };
    },
    serialize: (callback) => callback(),
    close: () => pool.end()
};

module.exports = db;
module.exports.pool = pool;
