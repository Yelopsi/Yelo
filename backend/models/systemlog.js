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
    timestamps: true, // Habilita createdAt e updatedAt para alinhar com a tabela do banco
    indexes: [
        { name: 'idx_systemlogs_level_created_at', fields: ['level', 'createdAt'] },
        { name: 'idx_systemlogs_created_at', fields: ['createdAt'] },
        { name: 'idx_systemlogs_meta', fields: ['meta'], using: 'gin' }
    ]
  });
  return SystemLog;
};