'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      await queryInterface.addColumn('SystemSettings', 'cmo_sim_start_date', {
        type: Sequelize.DATE,
        allowNull: true
      }, { transaction });

      await queryInterface.addColumn('SystemSettings', 'cmo_sim_start_subs', {
        type: Sequelize.INTEGER,
        allowNull: true
      }, { transaction });

      await queryInterface.addColumn('SystemSettings', 'cmo_sim_reinvest_rate', {
        type: Sequelize.INTEGER,
        defaultValue: 100,
        allowNull: false
      }, { transaction });

      await queryInterface.addColumn('SystemSettings', 'cmo_sim_extra_cash', {
        type: Sequelize.DECIMAL(10, 2),
        defaultValue: 0,
        allowNull: false
      }, { transaction });

      await queryInterface.addColumn('SystemSettings', 'cmo_sim_curiosity_goal', {
        type: Sequelize.INTEGER,
        allowNull: true
      }, { transaction });

      await transaction.commit();
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  },

  down: async (queryInterface, Sequelize) => {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      await queryInterface.removeColumn('SystemSettings', 'cmo_sim_start_date', { transaction });
      await queryInterface.removeColumn('SystemSettings', 'cmo_sim_start_subs', { transaction });
      await queryInterface.removeColumn('SystemSettings', 'cmo_sim_reinvest_rate', { transaction });
      await queryInterface.removeColumn('SystemSettings', 'cmo_sim_extra_cash', { transaction });
      await queryInterface.removeColumn('SystemSettings', 'cmo_sim_curiosity_goal', { transaction });
      await transaction.commit();
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  }
};
