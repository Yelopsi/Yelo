'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class MatchEvent extends Model {
    static associate(models) {
      MatchEvent.belongsTo(models.Psychologist, { foreignKey: 'psychologistId', as: 'psychologist' });
      MatchEvent.belongsTo(models.Patient, { foreignKey: 'patientId', as: 'patient' });
    }
  }
  MatchEvent.init({
    psychologistId: DataTypes.INTEGER,
    patientId: DataTypes.INTEGER,
    matchTags: DataTypes.ARRAY(DataTypes.TEXT),
    matchScore: DataTypes.FLOAT,
    source: DataTypes.STRING,
    explainability_log: DataTypes.JSONB,
    ai_justification: DataTypes.TEXT
  }, {
    sequelize,
    modelName: 'MatchEvent',
  });
  return MatchEvent;
};
