module.exports = {
  apps: [
    {
      name: "sena-backend",
      script: "index.js",
      cwd: "./backend",
      env: {
        NODE_ENV: "production",
      }
    },
    {
      name: "sena-frontend",
      script: "serve",
      env: {
        PM2_SERVE_PATH: './frontend/dist',
        PM2_SERVE_PORT: 5173,
        PM2_SERVE_SPA: 'true',
        PM2_SERVE_HOMEPAGE: '/index.html'
      }
    }
  ]
};
