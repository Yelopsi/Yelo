const { Model, DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  class AiQuestionDraft extends Model {
    static associate(models) {
      // Associação opcional: Um rascunho pertence a um Paciente (normalmente o Anônimo)
      this.belongsTo(models.Patient, { foreignKey: 'PatientId' });
    }
  }

  AiQuestionDraft.init({
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    title: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    content: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    meta_description: {
      type: DataTypes.TEXT,
      allowNull: true, // Para armazenar o JSON original da resposta da IA se necessário, ou tags
    },
    status: {
      type: DataTypes.ENUM('pending', 'approved', 'rejected'),
      defaultValue: 'pending',
      allowNull: false,
    },
  }, {
    sequelize,
    modelName: 'AiQuestionDraft',
    tableName: 'ai_question_drafts',
    timestamps: true,
  });

  return AiQuestionDraft;
};
