'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    const tableInfo = await queryInterface.describeTable('Psychologists');
    if (!tableInfo.is_exempt) {
      await queryInterface.addColumn('Psychologists', 'is_exempt', {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
        allowNull: false,
        comment: 'Indica se o usuário tem isenção de pagamento (VIP/Pro-bono)'
      });
    }
  },

  async down (queryInterface, Sequelize) {
    const tableInfo = await queryInterface.describeTable('Psychologists');
    if (tableInfo.is_exempt) {
      await queryInterface.removeColumn('Psychologists', 'is_exempt');
    }
  }
};