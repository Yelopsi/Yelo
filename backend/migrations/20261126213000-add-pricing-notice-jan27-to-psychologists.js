'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const tableDesc = await queryInterface.describeTable('Psychologists').catch(() => ({}));
    if (!tableDesc.pricing_notice_jan27_status) {
      await queryInterface.addColumn('Psychologists', 'pricing_notice_jan27_status', {
        type: Sequelize.STRING,
        allowNull: true,
        defaultValue: null,
      });
    }
    if (!tableDesc.pricing_notice_jan27_snooze_until) {
      await queryInterface.addColumn('Psychologists', 'pricing_notice_jan27_snooze_until', {
        type: Sequelize.DATE,
        allowNull: true,
        defaultValue: null,
      });
    }
  },

  async down(queryInterface) {
    const tableDesc = await queryInterface.describeTable('Psychologists').catch(() => ({}));
    if (tableDesc.pricing_notice_jan27_status) {
      await queryInterface.removeColumn('Psychologists', 'pricing_notice_jan27_status');
    }
    if (tableDesc.pricing_notice_jan27_snooze_until) {
      await queryInterface.removeColumn('Psychologists', 'pricing_notice_jan27_snooze_until');
    }
  }
};
