'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('SystemSettings', 'cmo_sim_target_subs', {
      type: Sequelize.INTEGER,
      allowNull: true,
      defaultValue: 70,
    });
    await queryInterface.addColumn('SystemSettings', 'cmo_sim_target_months', {
      type: Sequelize.INTEGER,
      allowNull: true,
      defaultValue: 3,
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('SystemSettings', 'cmo_sim_target_subs');
    await queryInterface.removeColumn('SystemSettings', 'cmo_sim_target_months');
  },
};
