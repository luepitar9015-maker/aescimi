// Configuration for SENA AES System
const path = require('path');

const config = {
    // Base storage path for document management
    STORAGE_BASE_PATH: 'C:\\Users\\Usuario\\OneDrive - Servicio Nacional de Aprendizaje\\CIMI',

    // Database path
    DB_PATH: path.resolve(__dirname, 'database.sqlite'),

    // Server configuration
    PORT: 3001,

    // JWT Secret
    JWT_SECRET: 'super_secret_key_sena_aes'
};

module.exports = config;
