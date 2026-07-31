require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const { Pool } = require('pg');
const { execSync } = require('child_process');

let dbHost = process.env.DB_HOST || 'localhost';
const dbUser = process.env.DB_USER || 'postgres';
const dbPassword = process.env.DB_PASSWORD || 'admin123';
const dbName = process.env.DB_NAME || 'sena_db';
const dbPort = parseInt(process.env.DB_PORT || '5432', 10);

console.log(`[DATABASE] Conectando a PostgreSQL en ${dbHost}:${dbPort} (BD: ${dbName}, Usuario: ${dbUser})`);

const pool = new Pool({
    user: dbUser,
    host: dbHost,
    database: dbName,
    password: dbPassword,
    port: dbPort,
    connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 30000
});

const db = {
    get: (sql, params, callback) => {
        let count = 0;
        const pgSql = sql.replace(/\?/g, () => `$${++count}`);
        pool.query(pgSql, params, (err, res) => {
            if (err) callback(err);
            else callback(null, res && res.rows ? res.rows[0] : null);
        });
    },
    all: (sql, params, callback) => {
        let count = 0;
        const pgSql = sql.replace(/\?/g, () => `$${++count}`);
        pool.query(pgSql, params, (err, res) => {
            if (err) callback(err);
            else callback(null, res && res.rows ? res.rows : []);
        });
    },
    run: (sql, params, callback) => {
        let count = 0;
        let pgSql = sql.replace(/\?/g, () => `$${++count}`);
        
        const isInsert = pgSql.trim().toUpperCase().startsWith('INSERT');
        if (isInsert && !pgSql.toUpperCase().includes('RETURNING')) {
            pgSql += ' RETURNING id';
        }

        pool.query(pgSql, params, function(err, res) {
            if (err) {
                if (callback) callback(err);
            } else {
                let lastID = null;
                if (isInsert && res && res.rows && res.rows[0]) {
                    lastID = res.rows[0].id;
                }
                if (callback) callback.call({ lastID: lastID, changes: res ? res.rowCount : 0 }, null);
            }
        });
    },
    prepare: (sql) => {
        return {
            run: function(...args) {
                const callback = typeof args[args.length - 1] === 'function' ? args.pop() : null;
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
