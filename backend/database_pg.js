const { Pool } = require('pg');

const primaryHost = process.env.DB_HOST || '192.168.8.164';
const dbUser = process.env.DB_USER || 'cimi';
const dbPassword = process.env.DB_PASSWORD || 'Aut0m4t1z4d0r2026%*';
const dbName = process.env.DB_NAME || 'sena_db';
const dbPort = parseInt(process.env.DB_PORT || '5432', 10);

const candidateHosts = [primaryHost, '192.168.8.164', 'localhost', '127.0.0.1', '192.168.8.165'].filter((h, i, arr) => h && arr.indexOf(h) === i);

let activePool = new Pool({
    user: dbUser,
    host: primaryHost,
    database: dbName,
    password: dbPassword,
    port: dbPort,
    connectionTimeoutMillis: 3000,
    idleTimeoutMillis: 30000
});

// Auto-descubrimiento y conmutación por error (Failover) de base de datos
(async () => {
    for (const host of candidateHosts) {
        try {
            const testPool = new Pool({
                user: dbUser,
                host,
                database: dbName,
                password: dbPassword,
                port: dbPort,
                connectionTimeoutMillis: 3000
            });
            await testPool.query('SELECT 1');
            console.log(`[PG DATABASE] ✅ Conectado exitosamente a PostgreSQL en host: ${host}`);
            activePool = testPool;
            break;
        } catch (e) {
            console.warn(`[PG DATABASE] ⚠ No se pudo conectar a ${host}: ${e.message}`);
        }
    }
})();

function queryActive(text, params, cb) {
    activePool.query(text, params, cb);
}

const db = {
    get: (sql, params, callback) => {
        let count = 0;
        const pgSql = sql.replace(/\?/g, () => `$${++count}`);
        queryActive(pgSql, params, (err, res) => {
            if (err) callback(err);
            else callback(null, res ? res.rows[0] : null);
        });
    },
    all: (sql, params, callback) => {
        let count = 0;
        const pgSql = sql.replace(/\?/g, () => `$${++count}`);
        queryActive(pgSql, params, (err, res) => {
            if (err) callback(err);
            else callback(null, res ? res.rows : []);
        });
    },
    run: (sql, params, callback) => {
        let count = 0;
        let pgSql = sql.replace(/\?/g, () => `$${++count}`);
        
        const isInsert = pgSql.trim().toUpperCase().startsWith('INSERT');
        if (isInsert && !pgSql.toUpperCase().includes('RETURNING')) {
            pgSql += ' RETURNING id';
        }

        queryActive(pgSql, params, function(err, res) {
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
    close: () => activePool.end()
};

module.exports = db;
module.exports.pool = new Proxy({}, {
    get: (target, prop) => {
        const val = activePool[prop];
        return typeof val === 'function' ? val.bind(activePool) : val;
    }
});
