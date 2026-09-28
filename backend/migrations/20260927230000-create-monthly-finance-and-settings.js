'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      await queryInterface.addColumn('SystemSettings', 'tax_variable_rate', {
        type: Sequelize.DECIMAL(5, 4),
        allowNull: true,
        defaultValue: null
      }, { transaction });
      
      await queryInterface.addColumn('SystemSettings', 'tax_fixed_monthly', {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: true,
        defaultValue: null
      }, { transaction });

      await queryInterface.addColumn('SystemSettings', 'required_cash_reserve', {
        type: Sequelize.DECIMAL(12, 2),
        allowNull: true,
        defaultValue: null
      }, { transaction });

      await queryInterface.createTable('YeloMonthlyFinances', {
        id: { allowNull: false, autoIncrement: true, primaryKey: true, type: Sequelize.INTEGER },
        monthYear: { type: Sequelize.STRING, allowNull: false, unique: true },
        closingCashBalance: { type: Sequelize.DECIMAL(12, 2), allowNull: true },
        opexIsComplete: { type: Sequelize.BOOLEAN, defaultValue: false },
        appliedTaxVariableRate: { type: Sequelize.DECIMAL(5, 4), allowNull: true },
        appliedTaxFixedMonthly: { type: Sequelize.DECIMAL(10, 2), allowNull: true },
        appliedRequiredCashReserve: { type: Sequelize.DECIMAL(12, 2), allowNull: true },
        isClosed: { type: Sequelize.BOOLEAN, defaultValue: false },
        closedAt: { type: Sequelize.DATE, allowNull: true },
        createdAt: { allowNull: false, type: Sequelize.DATE },
        updatedAt: { allowNull: false, type: Sequelize.DATE }
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
      await queryInterface.dropTable('YeloMonthlyFinances', { transaction });
      await queryInterface.removeColumn('SystemSettings', 'tax_variable_rate', { transaction });
      await queryInterface.removeColumn('SystemSettings', 'tax_fixed_monthly', { transaction });
      await queryInterface.removeColumn('SystemSettings', 'required_cash_reserve', { transaction });
      await transaction.commit();
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  }
};
