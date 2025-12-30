'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Patient extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // Um Paciente pode ter muitas Avaliações (Reviews)
      this.hasMany(models.Review, {
        foreignKey: 'patientId',
        as: 'reviews'
      });

      // Um Paciente pode ter muitos Psicólogos favoritos (relação N:M)
      this.belongsToMany(models.Psychologist, {
        through: 'PatientFavorites', // Nome da tabela de junção
        as: 'favorites'
      });

      // Um Paciente pode ter muitas Perguntas
      this.hasMany(models.Question, {
        foreignKey: 'PatientId'
      });
    }
  }
  Patient.init({
    // --- CAMPOS ANTIGOS (Mantidos) ---
    nome: { // Mapeado do 'nome_completo' do formulário
      type: DataTypes.STRING,
      allowNull: false 
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true
    },
    senha: {
      type: DataTypes.STRING,
      allowNull: false
    },
    telefone: {
      type: DataTypes.STRING,
      allowNull: true
    },
    
    // --- CAMPOS NOVOS (Do Questionário) ---
    valor_sessao_faixa: {
      type: DataTypes.STRING,
      allowNull: true
    },
    temas_buscados: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      allowNull: true
    },
    abordagem_desejada: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      allowNull: true
    },
    genero_profissional: {
      type: DataTypes.STRING,
      allowNull: true
    },
    praticas_afirmativas: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      allowNull: true
    },
    disponibilidade_periodo: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      allowNull: true
    },
    
    // --- CAMPOS DE AUDITORIA E LGPD (Adicionados) ---
    ip_registro: {
      type: DataTypes.STRING,
      allowNull: true
    },
    termos_aceitos: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    marketing_aceito: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    }
  }, {
    sequelize,
    modelName: 'Patient',
    paranoid: true, // <--- ADICIONE ISTO (Cria a coluna deletedAt)
    timestamps: true,
    indexes: [
        { name: 'idx_patients_created_at', fields: ['createdAt'] }
    ]
  });
  return Patient;
};