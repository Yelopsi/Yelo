'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class AdminCopilotMemory extends Model {
    static associate() {
      // Polimórfico via (entityType, entityKey) para suportar psychologist, lead, waiting_list e unregistered
    }
  }

  AdminCopilotMemory.init({
    entityType: {
      type: DataTypes.STRING(32),
      allowNull: false,
      defaultValue: 'psychologist'
    },
    entityKey: {
      type: DataTypes.STRING(120),
      allowNull: false
    },
    entityId: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    rollingSummary: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    confirmedFacts: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: []
    },
    clientStatements: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: []
    },
    recommendationsGiven: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: []
    },
    commitments: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: []
    },
    pendingItems: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: []
    },
    declaredExpectations: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: []
    },
    topicsHistory: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: []
    },
    lastInteractionAt: {
      type: DataTypes.DATE,
      allowNull: true
    }
  }, {
    sequelize,
    modelName: 'AdminCopilotMemory',
    tableName: 'AdminCopilotMemories',
    timestamps: true,
    indexes: [
      {
        name: 'idx_copilot_memory_entity_unique',
        unique: true,
        fields: ['entityType', 'entityKey']
      }
    ]
  });

  return AdminCopilotMemory;
};
