module.exports = {
  apps: [
    {
      // ── Backend (Optimizado para 8 GB RAM y lotes masivos de 4,000+ expedientes) ──
      name: "sena-backend",
      script: "server.js",
      cwd: "./backend",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      max_memory_restart: "3500M",
      node_args: "--max-old-space-size=3072",
      watch: false,
      env: {
        NODE_ENV: "production",
        PORT: 80,
        BEHIND_PROXY: "true",
        TMPDIR: "/mnt/almacen/.puppeteer_tmp",
        TMP: "/mnt/almacen/.puppeteer_tmp",
        TEMP: "/mnt/almacen/.puppeteer_tmp"
      }
    },
    {
      // ── Presentación Independiente ──────────────────────────────────────────
      name: "sena-presentacion",
      script: "presentacion-server.js",
      cwd: "./backend",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      max_memory_restart: "400M",
      watch: false,
      env: {
        NODE_ENV: "production",
        PORT: 3005
      }
    }
  ]
};
