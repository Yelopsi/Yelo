'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Psychologist extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // Um Psicólogo pode ter muitas Avaliações (Reviews)
      this.hasMany(models.Review, {
        foreignKey: 'psychologistId',
        as: 'reviews'
      });

      // Um Psicólogo pode ser favoritado por muitos Pacientes (relação N:M)
      this.belongsToMany(models.Patient, {
        through: 'PatientFavorites', // Mesmo nome da tabela de junção
        as: 'favoritedBy'
      });

      // --- NOVO TRECHO (COLE ISTO AQUI) ---
      // Um Psicólogo pode ter muitos Artigos (Posts)
      // Usamos 'Post' (nome que demos no models/Post.js)
      if (models.Post) {
          this.hasMany(models.Post, { 
              foreignKey: 'psychologist_id', 
              as: 'posts' 
          });
      }
      // Associação com o Fórum
      if (models.ForumPost) {
          this.hasMany(models.ForumPost, {
              foreignKey: 'PsychologistId'
          });
      }
      // Associação com Comentários do Fórum
      if (models.ForumComment) {
          this.hasMany(models.ForumComment, {
              foreignKey: 'PsychologistId'
          });
      }
      // Associação com Votos em Comentários do Fórum
      if (models.ForumCommentVote) {
          this.hasMany(models.ForumCommentVote, {
              foreignKey: 'PsychologistId'
          });
      }
      // ------------------------------------
    }
  }
  Psychologist.init({
    // --- CAMPOS ANTIGOS (Mantidos) ---
    nome: {
      type: DataTypes.STRING,
      allowNull: false
    },
    crp: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true
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
    // --- NOVOS CAMPOS DE ENDEREÇO ---
    cep: {
      type: DataTypes.STRING,
      allowNull: true
    },
    cidade: {
      type: DataTypes.STRING,
      allowNull: true
    },
    estado: {
      type: DataTypes.STRING,
      allowNull: true
    },
    // -------------------------------
    fotoUrl: {
      type: DataTypes.STRING,
      allowNull: true
    },

    cpf: {
      type: DataTypes.STRING,
      allowNull: true, // Continua aceitando nulo (pois pode ser PJ)
      unique: true
    },
    // --- NOVO CAMPO ADICIONADO ---
    cnpj: {
      type: DataTypes.STRING,
      allowNull: true, // Aceita nulo (pois pode ser PF)
      unique: true
    },
    bio: {
      type: DataTypes.TEXT, // Usar TEXT para biografias mais longas
      allowNull: true
    },
    slug: {
      type: DataTypes.STRING,
      allowNull: true,
      unique: true
    },
    isAdmin: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      allowNull: false
    },
    // --- STATUS VIP / ISENTO ---
    is_exempt: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      allowNull: false
    },
    plano: {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: null, // Valores: 'ESSENTIAL', 'CLINICAL', 'REFERENCE'
    },
    status: {
      type: DataTypes.STRING,
      defaultValue: 'pending' // pending, active, inactive, suspended
    },
    // --- ADICIONE ESTE BLOCO NOVO ---
    cancelAtPeriodEnd: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    // --- CONTROLE DE ASSINATURA (NOVOS CAMPOS) ---
    planExpiresAt: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'Data limite do acesso. Usado para Trial e inadimplência.'
    },
    subscriptionId: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: 'ID da assinatura no Gateway de Pagamento (ex: sub_12345)'
    },
    // --- FIM CONTROLE DE ASSINATURA ---
    // --- CAMPOS NOVOS (Do Questionário) ---
    // (Os campos 'abordagem', 'especialidades', 'cidade', 'online' foram removidos)
    valor_sessao_numero: {
      type: DataTypes.FLOAT,
      allowNull: true
    },
    temas_atuacao: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      allowNull: true
    },
    abordagens_tecnicas: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      allowNull: true
    },
    genero_identidade: {
      type: DataTypes.STRING,
      allowNull: true
    },
    praticas_vivencias: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      allowNull: true
    },
    disponibilidade_periodo: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      allowNull: true
    },
    // --- NOVOS CAMPOS DE MATCH (AFINIDADE) ---
    publico_alvo: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      allowNull: true
    },
    estilo_terapia: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      allowNull: true
    },
    praticas_inclusivas: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      allowNull: true
    },

    // --- INÍCIO DO NOVO CAMPO ---
    modalidade: {
      type: DataTypes.JSONB, // Definido como JSONB para casar com a coluna criada no server.js
      allowNull: true,
      defaultValue: []
    },
    // --- FIM DO NOVO CAMPO ---

    linkedin_url: {
        type: DataTypes.STRING,
        allowNull: true
    },
    instagram_url: {
        type: DataTypes.STRING,
        allowNull: true
    },
    facebook_url: {
        type: DataTypes.STRING,
        allowNull: true
    },
    tiktok_url: {
        type: DataTypes.STRING,
        allowNull: true
    },
    x_url: {
        type: DataTypes.STRING,
        allowNull: true
    },
    // --- KPIs (DEFINITIVO) ---
    whatsapp_clicks: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        allowNull: false
    },
    profile_appearances: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        allowNull: false
    }
  }, {
    sequelize,
    modelName: 'Psychologist',
    paranoid: true, // <--- ISSO É O SEGREDO! Ativa o soft delete (deletedAt)
    timestamps: true, // Garante que createdAt e updatedAt existam
    indexes: [
        { name: 'idx_psychologists_status_plano', fields: ['status', 'plano'] },
        { name: 'idx_psychologists_status_created_at', fields: ['status', 'createdAt'] }
    ]
  });
  return Psychologist;
};