'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const tableInfo = await queryInterface.describeTable('Psychologists');

    if (!tableInfo.free_session_active) {
      await queryInterface.addColumn('Psychologists', 'free_session_active', {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false
      });
    }

    if (!tableInfo.free_session_time) {
      await queryInterface.addColumn('Psychologists', 'free_session_time', {
        type: Sequelize.STRING,
        allowNull: true
      });
    }

    if (!tableInfo.profile_paused) {
      await queryInterface.addColumn('Psychologists', 'profile_paused', {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false
      });
    }
  },

  async down(queryInterface, Sequelize) {
    const tableInfo = await queryInterface.describeTable('Psychologists');

    if (tableInfo.free_session_active) {
      await queryInterface.removeColumn('Psychologists', 'free_session_active');
    }
    if (tableInfo.free_session_time) {
      await queryInterface.removeColumn('Psychologists', 'free_session_time');
    }
    if (tableInfo.profile_paused) {
      await queryInterface.removeColumn('Psychologists', 'profile_paused');
    }
  }
};
