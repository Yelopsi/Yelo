'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class AdminCopilotConversation extends Model {
    static associate(models) {
      if (models.Psychologist) {
        AdminCopilotConversation.belongsTo(models.Psychologist, {
          foreignKey: 'psychologistId',
          as: 'psychologist'
        });
      }
    }
  }

  AdminCopilotConversation.init({
    psychologistId: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    detectedName: {
      type: DataTypes.STRING,
      allowNull: true
    },
    rawPastedChat: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    aiResponse: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    contextSnapshot: {
      type: DataTypes.JSONB,
      allowNull: true
    },
    threadId: {
      type: DataTypes.UUID,
      allowNull: true
    },
    entityType: {
      type: DataTypes.STRING(32),
      allowNull: false,
      defaultValue: 'psychologist'
    },
    entityId: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    entityKey: {
      type: DataTypes.STRING(120),
      allowNull: true
    },
    operationMode: {
      type: DataTypes.STRING(32),
      allowNull: false,
      defaultValue: 'resposta'
    },
    interactionCategory: {
      type: DataTypes.STRING(64),
      allowNull: true
    },
    structuredOutput: {
      type: DataTypes.JSONB,
      allowNull: true
    },
    feedbackStatus: {
      type: DataTypes.STRING(24),
      allowNull: false,
      defaultValue: 'draft'
    },
    rejectionReason: {
      type: DataTypes.STRING(120),
      allowNull: true
    },
    finalReply: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    promptVersion: {
      type: DataTypes.STRING(24),
      allowNull: true
    },
    inputHash: {
      type: DataTypes.STRING(64),
      allowNull: true
    },
    messageHashes: {
      type: DataTypes.JSONB,
      allowNull: true
    },
    isLibraryExample: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    },
    adminId: {
      type: DataTypes.INTEGER,
      allowNull: true
    }
  }, {
    sequelize,
    modelName: 'AdminCopilotConversation',
    tableName: 'AdminCopilotConversations',
    timestamps: true
  });

  return AdminCopilotConversation;
};
