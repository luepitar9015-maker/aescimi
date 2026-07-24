module.exports = {
  apps: [
    {
      // ── Backend ────────────────────────────────────────────────────────────
      // Node.js HTTP puro en puerto 80.
      // NPM (Nginx Proxy Manager) recibe solicitudes en 443 (HTTPS)
      // y las reenvía aquí como HTTP. NO se necesitan certificados SSL aquí.
      name: "sena-backend",
      script: "server.js",
      cwd: "./backend",
      instances: 1,
      autorestart: true,
      watch: false,
      env: {
        NODE_ENV: "production",
        PORT: 80,             // Puerto upstream que OpenResty / NPM usa como destino (80)
        BEHIND_PROXY: "true" // Corre detrás de proxy reverso (NPM)
      }
    },
    {
      // ── Presentación Independiente ──────────────────────────────────────────
      name: "sena-presentacion",
      script: "presentacion-server.js",
      cwd: "./backend",
      instances: 1,
      autorestart: true,
      watch: false,
      env: {
        NODE_ENV: "production",
        PORT: 3005
      }
    }
  ]
};
