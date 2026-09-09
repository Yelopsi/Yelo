'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class ManualAdMetric extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
    }
  }
  ManualAdMetric.init({
    dateStart: DataTypes.DATEONLY,
    dateEnd: DataTypes.DATEONLY,
    platform: DataTypes.STRING,
    campaignName: DataTypes.STRING,
    spend: DataTypes.DECIMAL,
    impressions: DataTypes.INTEGER,
    clicks: DataTypes.INTEGER,
    conversions: DataTypes.INTEGER
  }, {
    sequelize,
    modelName: 'ManualAdMetric',
  });
  return ManualAdMetric;
};