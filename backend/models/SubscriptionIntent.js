'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class SubscriptionIntent extends Model {
    static associate(models) {
      this.belongsTo(models.Psychologist, {
        foreignKey: 'psychologistId',
        as: 'psychologist'
      });
    }
  }
  SubscriptionIntent.init({
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4
    },
    psychologistId: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    idempotencyKey: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true
    },
    planId: {
      type: DataTypes.STRING,
      allowNull: false
    },
    billingType: {
      type: DataTypes.STRING,
      allowNull: false
    },
    asaasSubscriptionId: {
      type: DataTypes.STRING,
      allowNull: true
    },
    status: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'CREATING'
    },
    expiresAt: {
      type: DataTypes.DATE,
      allowNull: false
    }
  }, {
    sequelize,
    modelName: 'SubscriptionIntent',
    tableName: 'SubscriptionIntents',
    timestamps: true
  });
  return SubscriptionIntent;
};
