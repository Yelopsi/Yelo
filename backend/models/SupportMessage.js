module.exports = (sequelize, DataTypes) => {
  const SupportMessage = sequelize.define('SupportMessage', {
    psychologist_id: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    sender_type: {
      type: DataTypes.STRING, // 'admin' ou 'psychologist'
      allowNull: false
    },
    content: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    is_read: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    created_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW
    }
  }, {
    tableName: 'support_messages', // Nome exato da tabela que criamos no pgAdmin
    timestamps: false // Desativamos o padrão do Sequelize pois criamos a tabela manualmente
  });

  return SupportMessage;
};