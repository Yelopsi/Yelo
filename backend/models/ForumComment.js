'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class ForumComment extends Model {
    static associate(models) {
      ForumComment.belongsTo(models.Psychologist);
      ForumComment.belongsTo(models.ForumPost);
      ForumComment.hasMany(models.ForumComment, { as: 'Replies', foreignKey: 'parentId' });
      ForumComment.hasMany(models.ForumCommentVote);
    }
  }
  ForumComment.init({
      content: {
          type: DataTypes.TEXT,
          allowNull: false
      },
      isAnonymous: {
          type: DataTypes.BOOLEAN,
          defaultValue: false
      },
      // --- NOVOS CAMPOS ---
      likes: {
          type: DataTypes.INTEGER,
          defaultValue: 0
      },
      parentId: {
          type: DataTypes.INTEGER,
          allowNull: true // Nulo para comentários de nível superior
      }
  }, {
    sequelize,
    modelName: 'ForumComment',
  });
  return ForumComment;
};
