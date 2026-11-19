'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class AdminCopilotFollowUp extends Model {
    static associate(models) {
      if (models.Psychologist) {
        AdminCopilotFollowUp.belongsTo(models.Psychologist, {
          foreignKey: 'psychologistId',
          as: 'psychologist'
        });
      }
    }
  }

  AdminCopilotFollowUp.init({
    psychologistId: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    conversationId: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    parentFollowUpId: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    subType: {
      type: DataTypes.STRING(40),
      allowNull: false
    },
    reason: {
      type: DataTypes.STRING(280),
      allowNull: false
    },
    contextSummary: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    dueAt: {
      type: DataTypes.DATE,
      allowNull: false
    },
    status: {
      type: DataTypes.STRING(24),
      allowNull: false,
      defaultValue: 'scheduled'
    },
    autoSchedulePerformanceEval: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    },
    evaluationDelayDays: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 14
    },
    baselineMetrics: {
      type: DataTypes.JSONB,
      allowNull: true
    },
    outcomeMetrics: {
      type: DataTypes.JSONB,
      allowNull: true
    },
    resolvedReason: {
      type: DataTypes.STRING(220),
      allowNull: true
    },
    sentMessage: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    completedAt: {
      type: DataTypes.DATE,
      allowNull: true
    },
    adminId: {
      type: DataTypes.INTEGER,
      allowNull: true
    }
  }, {
    sequelize,
    modelName: 'AdminCopilotFollowUp',
    tableName: 'AdminCopilotFollowUps',
    timestamps: true,
    indexes: [
      {
        name: 'idx_copilot_followups_status_due',
        fields: ['status', 'dueAt']
      },
      {
        name: 'idx_copilot_followups_psi_status',
        fields: ['psychologistId', 'status']
      },
      {
        name: 'idx_copilot_followups_parent',
        fields: ['parentFollowUpId']
      }
    ]
  });

  return AdminCopilotFollowUp;
};
