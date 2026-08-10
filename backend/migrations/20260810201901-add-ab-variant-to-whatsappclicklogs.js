'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const tableDescription = await queryInterface.describeTable('WhatsAppClickLogs');
    if (!tableDescription.ab_variant) {
      await queryInterface.addColumn('WhatsAppClickLogs', 'ab_variant', {
        type: Sequelize.STRING,
        allowNull: true
      });
    }
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('WhatsAppClickLogs', 'ab_variant');
  }
};
