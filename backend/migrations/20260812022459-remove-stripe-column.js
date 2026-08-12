'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Drop legacy column stripeSubscriptionId if it exists
    const tableInfo = await queryInterface.describeTable('Psychologists');
    if (tableInfo.stripeSubscriptionId) {
        await queryInterface.removeColumn('Psychologists', 'stripeSubscriptionId');
    }
  },

  async down(queryInterface, Sequelize) {
    const tableInfo = await queryInterface.describeTable('Psychologists');
    if (!tableInfo.stripeSubscriptionId) {
        await queryInterface.addColumn('Psychologists', 'stripeSubscriptionId', {
            type: Sequelize.STRING,
            allowNull: true
        });
    }
  }
};
