'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class ForumReport extends Model {
    static associate(models) {
      ForumReport.belongsTo(models.Psychologist, { as: 'Reporter', foreignKey: 'reporterId' });
    }
  }
  ForumReport.init({
    type: {
        type: DataTypes.STRING, // 'post' ou 'comment'
        allowNull: false
    },
    itemId: {
        type: DataTypes.INTEGER, // ID do post ou comentário
        allowNull: false
    },
    status: { type: DataTypes.STRING, defaultValue: 'pending' } // pending, resolved, dismissed
  }, {
    sequelize,
    modelName: 'ForumReport',
  });
  return ForumReport;
};