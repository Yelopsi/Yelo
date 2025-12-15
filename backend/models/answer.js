// backend/models/answer.js
const { Model, DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  class Answer extends Model {
    static associate(models) {
      // Uma resposta pertence a uma pergunta
      this.belongsTo(models.Question, { as: 'question', foreignKey: 'questionId' });
      // Uma resposta pertence a um psicólogo
      this.belongsTo(models.Psychologist, { as: 'psychologist', foreignKey: 'psychologistId' });
    }
  }

  Answer.init({
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    content: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    // questionId e psychologistId serão adicionados via associações
  }, {
    sequelize,
    modelName: 'Answer',
    tableName: 'answers',
    timestamps: true,
  });

  return Answer;
};