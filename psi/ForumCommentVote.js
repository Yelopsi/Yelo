'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class ForumCommentVote extends Model {
    static associate(models) {
      ForumCommentVote.belongsTo(models.Psychologist);
      ForumCommentVote.belongsTo(models.ForumComment);
    }
  }
  ForumCommentVote.init({
    // Chaves estrangeiras são geradas automaticamente pelas associações
  }, {
    sequelize,
    modelName: 'ForumCommentVote',
  });
  return ForumCommentVote;
};