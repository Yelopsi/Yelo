// backend/models/CommunityEvent.js
'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class CommunityEvent extends Model {}
  
  CommunityEvent.init({
    titulo: DataTypes.STRING,
    subtitulo: DataTypes.STRING,
    data_hora: DataTypes.STRING, // Ex: "15/12 às 19h"
    tipo: DataTypes.STRING,      // "Online" ou "Presencial"
    link_acao: DataTypes.STRING, // Link do Google Meet ou Sympla
    texto_botao: DataTypes.STRING,
    ativo: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
    }
  }, {
    sequelize,
    modelName: 'CommunityEvent',
  });
  
  return CommunityEvent;
};