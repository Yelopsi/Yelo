'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class ForumCommentVote extends Model {
    static associate(models) {
      // associations defined in index.js
    }
  }
  ForumCommentVote.init({
    // Apenas chaves estrangeiras, adicionadas nas associações
  }, {
    sequelize,
    modelName: 'ForumCommentVote',
  });
  return ForumCommentVote;
};