'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class WaitingList extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // No momento, não precisa de associações.
    }
  }
  WaitingList.init({
    nome: {
      type: DataTypes.STRING,
      allowNull: false
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true, // Evita que o mesmo email seja adicionado várias vezes
      validate: {
        isEmail: true
      }
    },
    crp: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true // Evita que o mesmo CRP seja adicionado várias vezes
    },
    status: {
      type: DataTypes.STRING,
      defaultValue: 'pending' // pending, invited, registered
    },
    invitationToken: {
      type: DataTypes.STRING,
      allowNull: true
    },
    invitationExpiresAt: {
      type: DataTypes.DATE,
      allowNull: true
    },
    // Campos do perfil para análise de demanda
    valor_sessao_faixa: {
      type: DataTypes.STRING
    },
    temas_atuacao: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      allowNull: true
    },
    abordagens_tecnicas: {
      type: DataTypes.ARRAY(DataTypes.STRING)
    },
    genero_identidade: {
      type: DataTypes.STRING,
      allowNull: true
    },
    praticas_afirmativas: DataTypes.ARRAY(DataTypes.STRING)
  }, {
    sequelize,
    modelName: 'WaitingList',
  });
  return WaitingList;
};