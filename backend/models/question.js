const { Model, DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  class Question extends Model {
    static associate(models) {
      // Associação: Uma Pergunta tem muitas Respostas
      this.hasMany(models.Answer, { as: 'answers', foreignKey: 'questionId' });
      // Associação CRÍTICA: Uma Pergunta PERTENCE a um Paciente
      this.belongsTo(models.Patient, { foreignKey: 'PatientId' });
    }
  }

  Question.init({
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    title: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    content: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    status: {
      type: DataTypes.ENUM('pending_review', 'approved', 'answered', 'rejected'),
      defaultValue: 'pending_review',
      allowNull: false,
    },
  }, {
    sequelize,
    modelName: 'Question',
    tableName: 'questions',
    timestamps: true,
  });

  return Question;
};