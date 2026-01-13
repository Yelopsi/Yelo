'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class GamificationLog extends Model {
    static associate(models) {
      GamificationLog.belongsTo(models.Psychologist, { foreignKey: 'psychologistId' });
    }
  }
  GamificationLog.init({
    psychologistId: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    actionType: {
      type: DataTypes.STRING, // 'login', 'blog_post', 'forum_reply', etc.
      allowNull: false
    },
    points: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    metadata: {
      type: DataTypes.JSONB, // Para guardar ID do post, comentário, etc. (opcional)
      allowNull: true
    }
  }, {
    sequelize,
    modelName: 'GamificationLog',
    timestamps: true // Importante para verificar limites diários (createdAt)
  });
  return GamificationLog;
};