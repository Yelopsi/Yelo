'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class ReconciliationAudit extends Model {
    static associate(models) {
      // define association here if needed
    }
  }
  ReconciliationAudit.init({
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      allowNull: false
    },
    reconciliationRunId: {
      type: DataTypes.STRING,
      allowNull: false
    },
    entityType: {
      type: DataTypes.ENUM('SUBSCRIPTION', 'PAYMENT', 'INTENT', 'PSYCHOLOGIST'),
      allowNull: false
    },
    entityId: {
      type: DataTypes.STRING,
      allowNull: false
    },
    differenceType: {
      type: DataTypes.STRING,
      allowNull: false
    },
    asaasState: {
      type: DataTypes.JSONB,
      allowNull: true
    },
    yeloState: {
      type: DataTypes.JSONB,
      allowNull: true
    },
    severity: {
      type: DataTypes.ENUM('CRITICAL', 'HIGH', 'MEDIUM', 'LOW'),
      allowNull: false
    },
    resolvedAt: {
      type: DataTypes.DATE,
      allowNull: true
    },
    resolution: {
      type: DataTypes.TEXT,
      allowNull: true
    }
  }, {
    sequelize,
    modelName: 'ReconciliationAudit',
    tableName: 'ReconciliationAudits',
  });
  return ReconciliationAudit;
};
