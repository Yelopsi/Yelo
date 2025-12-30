'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class ForumPost extends Model {
    static associate(models) {
      ForumPost.belongsTo(models.Psychologist);
      ForumPost.hasMany(models.ForumComment);
      ForumPost.hasMany(models.ForumVote);
    }
  }
  ForumPost.init({
      title: {
          type: DataTypes.STRING,
          allowNull: false
      },
      content: {
          type: DataTypes.TEXT,
          allowNull: false
      },
      category: {
          type: DataTypes.STRING,
          allowNull: false
      },
      isAnonymous: {
          type: DataTypes.BOOLEAN,
          defaultValue: false
      },
      votes: {
          type: DataTypes.INTEGER,
          defaultValue: 0
      },
      status: {
          type: DataTypes.STRING,
          defaultValue: 'active' // e.g., 'active', 'hidden', 'archived'
      }
  }, {
    sequelize,
    modelName: 'ForumPost',
    // ADICIONE AQUI:
    indexes: [
        // Adiciona um índice na coluna 'status' (se ela existir) e 'category'
        {
          name: 'idx_forumposts_category_status', // Nome do índice
          fields: ['category', 'status'] // Você pode criar índices compostos
        }
    ]
  });
  return ForumPost;
};
