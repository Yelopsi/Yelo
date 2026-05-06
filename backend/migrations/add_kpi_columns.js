'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const table = 'Psychologists';

    try {
      console.log("➕ Criando coluna 'whatsapp_clicks'...");
      await queryInterface.addColumn(table, 'whatsapp_clicks', {
        type: Sequelize.INTEGER,
        defaultValue: 0,
        allowNull: false
      });
      console.log("✅ Sucesso!");
    } catch (error) {
      console.log("ℹ️ Coluna 'whatsapp_clicks' já existe ou erro:", error.message);
    }

    try {
      console.log("➕ Criando coluna 'profile_appearances'...");
      await queryInterface.addColumn(table, 'profile_appearances', {
        type: Sequelize.INTEGER,
        defaultValue: 0,
        allowNull: false
      });
      console.log("✅ Sucesso!");
    } catch (error) {
      console.log("ℹ️ Coluna 'profile_appearances' já existe ou erro:", error.message);
    }
  },

  async down(queryInterface, Sequelize) {
    const table = 'Psychologists';
    await queryInterface.removeColumn(table, 'whatsapp_clicks');
    await queryInterface.removeColumn(table, 'profile_appearances');
  }
};