'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.changeColumn('Subscriptions', 'plan', {
      type: Sequelize.TEXT,
      allowNull: false,
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.changeColumn('Subscriptions', 'plan', {
      type: Sequelize.STRING(50),
      allowNull: false,
    });
  },
};
