'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class SystemLog extends Model {
    static associate(models) {
      // Nenhuma associação necessária por enquanto
    }
  }
  SystemLog.init({
    level: {
      type: DataTypes.STRING, // ex: 'info', 'warn', 'error'
      allowNull: false
    },
    message: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    meta: {
      type: DataTypes.JSONB // Para dados extras, como ID do usuário, IP, etc.
    }
  }, {
    sequelize,
    modelName: 'SystemLog',
    updatedAt: false // Logs são imutáveis
  });
  return SystemLog;
};