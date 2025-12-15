'use strict';

const fs = require('fs');
const path = require('path');
const Sequelize = require('sequelize');
const process = require('process');
const basename = path.basename(__filename);
const env = process.env.NODE_ENV || 'development';
const db = {};

// 1. TENTA CARREGAR A CONFIGURAÇÃO (JSON OU JS)
let config;
try {
    // Tenta primeiro o padrão JSON
    config = require(__dirname + '/../config/config.json')[env];
} catch (error) {
    try {
        // Se falhar, tenta o formato JS
        config = require(__dirname + '/../config/config.js')[env];
    } catch (err) {
        console.error("ERRO CRÍTICO: Não foi possível encontrar config/config.json nem config/config.js");
        process.exit(1);
    }
}

// 2. INICIALIZA A CONEXÃO
let sequelize;
if (config.use_env_variable) {
  sequelize = new Sequelize(process.env[config.use_env_variable], config);
} else {
  sequelize = new Sequelize(config.database, config.username, config.password, config);
}

// 3. CARREGA TODOS OS MODELS DA PASTA
fs
  .readdirSync(__dirname)
  .filter(file => {
    return (
      file.indexOf('.') !== 0 &&
      file !== basename &&
      file.slice(-3) === '.js' &&
      file.indexOf('.test.js') === -1
    );
  })
  .forEach(file => {
    const model = require(path.join(__dirname, file))(sequelize, Sequelize.DataTypes);
    db[model.name] = model;
  });

// 4. FAZ AS ASSOCIAÇÕES (HASMANY, BELONGSTO)
Object.keys(db).forEach(modelName => {
  if (db[modelName].associate) {
    db[modelName].associate(db);
  }
});

db.sequelize = sequelize;
db.Sequelize = Sequelize;

module.exports = db;