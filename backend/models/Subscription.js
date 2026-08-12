'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Subscription extends Model {
    static associate(models) {
      this.belongsTo(models.Psychologist, {
        foreignKey: 'psychologistId',
        as: 'psychologist'
      });
      this.hasMany(models.Payment, {
        foreignKey: 'subscriptionId',
        as: 'payments'
      });
    }
  }
  Subscription.init({
    id: {
      type: DataTypes.STRING,
      primaryKey: true
    },
    psychologistId: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    asaasCustomerId: {
      type: DataTypes.STRING,
      allowNull: false
    },
    plan: {
      type: DataTypes.STRING,
      allowNull: false
    },
    status: {
      type: DataTypes.STRING,
      allowNull: false
    },
    currentPeriodStart: {
      type: DataTypes.DATE,
      allowNull: true
    },
    currentPeriodEnd: {
      type: DataTypes.DATE,
      allowNull: true
    }
  }, {
    sequelize,
    modelName: 'Subscription',
    tableName: 'Subscriptions',
    timestamps: true
  });
  return Subscription;
};
