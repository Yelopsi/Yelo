'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class PatientOnboardingLink extends Model {
    static associate(models) {
      if (models.Psychologist) {
        this.belongsTo(models.Psychologist, {
          foreignKey: 'psychologistId',
          as: 'psychologist'
        });
      }
      if (models.Patient) {
        this.belongsTo(models.Patient, {
          foreignKey: 'patientId',
          as: 'patient'
        });
      }
    }
  }
  
  PatientOnboardingLink.init({
    token: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true
    },
    psychologistId: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    patientId: {
      type: DataTypes.INTEGER,
      allowNull: true // True because old links won't have it
    },
    patientName: {
      type: DataTypes.STRING,
      allowNull: false
    },
    status: {
      type: DataTypes.STRING,
      defaultValue: 'pending', // pending, signed
      allowNull: false
    },
    contractText: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    pixKey: {
      type: DataTypes.STRING,
      allowNull: true
    },
    patientData: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: {} // { cpf, dob, emergencyContact }
    },
    signedAt: {
      type: DataTypes.DATE,
      allowNull: true
    },
    ipAddress: {
      type: DataTypes.STRING,
      allowNull: true
    },
    userAgent: {
      type: DataTypes.STRING,
      allowNull: true
    }
  }, {
    sequelize,
    modelName: 'PatientOnboardingLink',
    timestamps: true,
    indexes: [
      { name: 'idx_onboarding_token', fields: ['token'] },
      { name: 'idx_onboarding_psychologist_id', fields: ['psychologistId'] }
    ]
  });
  return PatientOnboardingLink;
};
