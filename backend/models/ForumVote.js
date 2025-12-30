'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class ForumVote extends Model {
    static associate(models) {
      ForumVote.belongsTo(models.Psychologist);
      ForumVote.belongsTo(models.ForumPost);
    }
  }
  ForumVote.init({
    // Apenas chaves estrangeiras (postId, psychologistId) serão adicionadas nas associações
  }, {
    sequelize,
    modelName: 'ForumVote',
  });
  return ForumVote;
};
