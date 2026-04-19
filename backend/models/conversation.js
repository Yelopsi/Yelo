'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Conversation extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
      this.hasMany(models.Message, { foreignKey: 'conversationId' });
      this.belongsTo(models.Patient, { foreignKey: 'patientId' });
      this.belongsTo(models.Psychologist, { foreignKey: 'psychologistId' });
    }
  }
  Conversation.init({
    patientId: DataTypes.INTEGER,
    psychologistId: DataTypes.INTEGER,
    // --- CORREÇÃO: Adiciona o campo status que estava sendo removido ---
    status: {
      type: DataTypes.STRING,
      defaultValue: 'active' // active, archived
    }
  }, {
    sequelize,
    modelName: 'Conversation',
  });
  return Conversation;
};