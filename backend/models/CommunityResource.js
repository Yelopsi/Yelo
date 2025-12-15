'use strict';
const { Model } = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class CommunityResource extends Model {}
  CommunityResource.init({
    link_intervisao: DataTypes.STRING,
    link_biblioteca: DataTypes.STRING,
    link_cursos: DataTypes.STRING
  }, { sequelize, modelName: 'CommunityResource' });
  return CommunityResource;
};