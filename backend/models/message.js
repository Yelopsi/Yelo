'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Message extends Model {
    static associate(models) {
      this.belongsTo(models.Conversation, { foreignKey: 'conversationId' });
      // Associações polimórficas para remetente e destinatário
      this.belongsTo(models.Patient, { foreignKey: 'senderId', constraints: false, as: 'senderPatient' });
      this.belongsTo(models.Psychologist, { foreignKey: 'senderId', constraints: false, as: 'senderPsychologist' });
      this.belongsTo(models.Patient, { foreignKey: 'recipientId', constraints: false, as: 'recipientPatient' });
      this.belongsTo(models.Psychologist, { foreignKey: 'recipientId', constraints: false, as: 'recipientPsychologist' });
    }
  }
  Message.init({
    conversationId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    senderId: DataTypes.INTEGER,
    senderType: DataTypes.STRING, // 'patient' ou 'psychologist'
    recipientId: DataTypes.INTEGER,
    recipientType: DataTypes.STRING,
    content: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    isRead: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      allowNull: false
    }
  }, {
    sequelize,
    modelName: 'Message',
  });
  return Message;
};