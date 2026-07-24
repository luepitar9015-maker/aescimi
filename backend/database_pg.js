require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const { Pool } = require('pg');
const { execSync } = require('child_process');

let dbHost = process.env.DB_HOST || '192.168.8.164';
const dbUser = process.env.DB_USER || 'cimi';
const dbPassword = process.env.DB_PASSWORD || 'Aut0m4t1z4d0r2026%*';
const dbName = process.env.DB_NAME || 'sena_db';
const dbPort = parseInt(process.env.DB_PORT || '5432', 10);

// Comprobación de conectividad síncrona con tiempo de espera corto (1s)
try {
    const checkCmd = `node -e "const net = require('net'); const s = new net.Socket(); s.setTimeout(800); s.connect(${dbPort}, '${dbHost}', () => { process.exit(0); }); s.on('error', () => { process.exit(1); }); s.on('timeout', () => { process.exit(1); });"`;
    execSync(checkCmd, { timeout: 1200 });
    console.log(`[DATABASE] Host principal ${dbHost} accesible en puerto ${dbPort}.`);
} catch (e) {
    console.warn(`[DATABASE] Host principal ${dbHost} no disponible. Conmutando a localhost...`);
    dbHost = 'localhost';
}

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
