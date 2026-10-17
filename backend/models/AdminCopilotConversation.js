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
    }
  }, {
    sequelize,
    modelName: 'AdminCopilotConversation',
    tableName: 'AdminCopilotConversations',
    timestamps: true
  });

  return AdminCopilotConversation;
};
