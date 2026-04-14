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
        PORT: 80,            // Puerto upstream que NPM usa como destino
        BEHIND_PROXY: "true" // Corre detrás de proxy reverso (NPM)
      }
    }
    // sena-frontend eliminado: Express sirve el dist/ via static + catch-all
  ]
};
