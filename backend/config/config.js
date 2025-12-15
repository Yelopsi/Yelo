// backend/config/config.js

// As variáveis de ambiente agora são carregadas apenas no server.js

module.exports = {
  // Configuração de DESENVOLVIMENTO (o que você está usando agora)
  development: {
    username: process.env.DB_USER,     // Puxa do .env
    password: process.env.DB_PASSWORD, // Puxa do .env
    database: process.env.DB_NAME,     // Puxa do .env
    host: process.env.DB_HOST,         // Puxa do .env
    dialect: process.env.DB_DIALECT    // Puxa do .env (deve ser 'postgres')
  },

  // Configuração de TESTE (para testes automatizados no futuro)
  test: {
    username: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    host: process.env.DB_HOST,
    dialect: process.env.DB_DIALECT
  },

  // Configuração de PRODUÇÃO (quando você hospedar o site)
  production: {
  username: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  host: process.env.DB_HOST,
  dialect: process.env.DB_DIALECT,
  dialectOptions: {
    ssl: {
      require: true,
      rejectUnauthorized: false
    }
  }
}
}