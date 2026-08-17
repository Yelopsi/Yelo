'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.addColumn('Psychologists', 'firstPaidAt', {
      type: Sequelize.DATE,
      allowNull: true
    });
    await queryInterface.addColumn('Psychologists', 'canceledAt', {
      type: Sequelize.DATE,
      allowNull: true
    });
    await queryInterface.addColumn('Psychologists', 'reactivatedAt', {
      type: Sequelize.DATE,
      allowNull: true
    });
    await queryInterface.addColumn('Psychologists', 'lifetimeRevenue', {
      type: Sequelize.FLOAT,
      allowNull: true,
      defaultValue: 0
    });
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.removeColumn('Psychologists', 'firstPaidAt');
    await queryInterface.removeColumn('Psychologists', 'canceledAt');
    await queryInterface.removeColumn('Psychologists', 'reactivatedAt');
    await queryInterface.removeColumn('Psychologists', 'lifetimeRevenue');
  }
};
