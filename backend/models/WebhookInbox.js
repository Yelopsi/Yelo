'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class WebhookInbox extends Model {
    static associate(models) {
      // Sem associações diretas no nível de banco por ser log transacional
    }
  }
  WebhookInbox.init({
    eventId: {
      type: DataTypes.STRING,
      primaryKey: true
    },
    status: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'PENDING'
    },
    payload: {
      type: DataTypes.JSONB,
      allowNull: false
    },
    attempts: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    lockedAt: {
      type: DataTypes.DATE,
      allowNull: true
    },
    processingStartedAt: {
      type: DataTypes.DATE,
      allowNull: true
    },
    processedAt: {
      type: DataTypes.DATE,
      allowNull: true
    },
    nextRetryAt: {
      type: DataTypes.DATE,
      allowNull: true
    },
    lastError: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    receivedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    }
  }, {
    sequelize,
    modelName: 'WebhookInbox',
    tableName: 'WebhookInbox',
    timestamps: false // Manually managed in receivedAt/processedAt
  });
  return WebhookInbox;
};
