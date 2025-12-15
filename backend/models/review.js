'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Review extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
      this.belongsTo(models.Patient, { as: 'patient', foreignKey: 'patientId' });
      this.belongsTo(models.Psychologist, { as: 'psychologist', foreignKey: 'psychologistId' });
    }
  }
  Review.init({
    patientId: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    psychologistId: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    rating: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: { min: 1, max: 5 }
    },
    comment: DataTypes.TEXT,
    status: {
      type: DataTypes.STRING,
      defaultValue: 'pending', // 'pending', 'approved', 'rejected'
      allowNull: false
    }
  }, {
    sequelize,
    modelName: 'Review',
  });
  return Review;
};