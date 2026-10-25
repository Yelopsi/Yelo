'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class AdminAdjustment extends Model {
    static associate(models) {
      // Sem associações obrigatórias por enquanto
    }
  }

  AdminAdjustment.init({
    title: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    target_page: {
      type: DataTypes.STRING(255),
      allowNull: false,
      defaultValue: 'Geral'
    },
    file_path: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    category: {
      type: DataTypes.STRING(100),
      allowNull: false,
      defaultValue: 'Melhoria'
    },
    environment: {
      type: DataTypes.STRING(50),
      allowNull: false,
      defaultValue: 'geral' // 'admin' | 'psicologo' | 'paciente' | 'publico' | 'geral'
    },
    device: {
      type: DataTypes.STRING(50),
      allowNull: false,
      defaultValue: 'todos' // 'todos' | 'mobile' | 'desktop'
    },
    image_url: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    priority: {
      type: DataTypes.STRING(50),
      allowNull: false,
      defaultValue: 'media'
    },
    status: {
      type: DataTypes.STRING(50),
      allowNull: false,
      defaultValue: 'pendente'
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    order: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    completedAt: {
      type: DataTypes.DATE,
      allowNull: true
    }
  }, {
    sequelize,
    modelName: 'AdminAdjustment',
    tableName: 'AdminAdjustments',
    timestamps: true
  });

  return AdminAdjustment;
};
