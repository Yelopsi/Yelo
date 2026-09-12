'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    const tableInfo = await queryInterface.describeTable('SystemSettings');
    if (!tableInfo.max_subscribers_record) {
      await queryInterface.addColumn('SystemSettings', 'max_subscribers_record', {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 16
      });
    }
  },

  async down (queryInterface, Sequelize) {
    const tableInfo = await queryInterface.describeTable('SystemSettings');
    if (tableInfo.max_subscribers_record) {
      await queryInterface.removeColumn('SystemSettings', 'max_subscribers_record');
    }
  }
};
