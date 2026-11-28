'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const tableDesc = await queryInterface.describeTable('Payments');
    if (!tableDesc.nfIssuedAt) {
      await queryInterface.addColumn('Payments', 'nfIssuedAt', {
        type: Sequelize.DATE,
        allowNull: true,
      });
    }
    if (!tableDesc.nfNumber) {
      await queryInterface.addColumn('Payments', 'nfNumber', {
        type: Sequelize.STRING(80),
        allowNull: true,
      });
    }
  },

  async down(queryInterface) {
    const tableDesc = await queryInterface.describeTable('Payments');
    if (tableDesc.nfNumber) {
      await queryInterface.removeColumn('Payments', 'nfNumber');
    }
    if (tableDesc.nfIssuedAt) {
      await queryInterface.removeColumn('Payments', 'nfIssuedAt');
    }
  },
};
