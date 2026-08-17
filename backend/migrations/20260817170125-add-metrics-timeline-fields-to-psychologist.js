'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    // Add columns only if they do not already exist to make migration idempotent
    const table = await queryInterface.describeTable('Psychologists');
    if (!table.firstPaidAt) {
      await queryInterface.addColumn('Psychologists', 'firstPaidAt', {
        type: Sequelize.DATE,
        allowNull: true
      });
    }
    if (!table.canceledAt) {
      await queryInterface.addColumn('Psychologists', 'canceledAt', {
        type: Sequelize.DATE,
        allowNull: true
      });
    }
    if (!table.reactivatedAt) {
      await queryInterface.addColumn('Psychologists', 'reactivatedAt', {
        type: Sequelize.DATE,
        allowNull: true
      });
    }
    if (!table.lifetimeRevenue) {
      await queryInterface.addColumn('Psychologists', 'lifetimeRevenue', {
        type: Sequelize.FLOAT,
        allowNull: true,
        defaultValue: 0
      });
    }
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.removeColumn('Psychologists', 'firstPaidAt');
    await queryInterface.removeColumn('Psychologists', 'canceledAt');
    await queryInterface.removeColumn('Psychologists', 'reactivatedAt');
    await queryInterface.removeColumn('Psychologists', 'lifetimeRevenue');
  }
};
