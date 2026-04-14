module.exports = {
  apps: [
    {
      // ── Backend ───────────────────────────────────────────────────
      // Node.js corre HTTP en puerto 3000.
      // Nginx proxy inverso recibe en 80/443 y reenvía aquí.
      name: "sena-backend",
      script: "server.js",
      cwd: "./backend",
      instances: 1,
      autorestart: true,
      watch: false,
      env: {
        NODE_ENV: "production",
        PORT: 3000,          // Puerto interno HTTP (Nginx maneja el externo)
        BEHIND_PROXY: "true" // Indica que corre detrás de proxy reverso
      }
    }
    // sena-frontend eliminado: el backend Express sirve el dist/ directamente
    // via app.use(express.static('../frontend/dist')) y el catch-all de React Router
  ]
};
