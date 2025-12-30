// backend/config/config.js

const path = require('path');

// Tenta carregar o .env da raiz do projeto (../../.env) e da pasta atual (.env)
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
require('dotenv').config();

module.exports = {
  // Configuração LOCAL (Seu computador)
  development: {
    username: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    host: process.env.DB_HOST,
    port: process.env.DB_PORT, // <--- ADICIONADO: Lê a porta 5433 do .env
    dialect: 'postgres',
  },

  // Configuração de TESTE
  test: {
    username: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    host: process.env.DB_HOST,
    port: process.env.DB_PORT, // <--- ADICIONADO
    dialect: 'postgres'
  },

  // Configuração de PRODUÇÃO (Render)
  production: {
    use_env_variable: 'DATABASE_URL', // <--- O SEGREDO: Usa a URL completa do Render
    dialect: 'postgres',
    dialectOptions: {
      ssl: {
        require: true,
        rejectUnauthorized: false // Necessário para o Render aceitar a conexão
      }
    }
  }
};