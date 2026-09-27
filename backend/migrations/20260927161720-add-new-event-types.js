'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Add new values to existing ENUM
    await queryInterface.sequelize.query('ALTER TYPE "enum_PaymentFinancialEvents_eventType" ADD VALUE IF NOT EXISTS \'PAYMENT_CONFIRMED\';');
    await queryInterface.sequelize.query('ALTER TYPE "enum_PaymentFinancialEvents_eventType" ADD VALUE IF NOT EXISTS \'PAYMENT_CREDITED\';');
  },

  down: async (queryInterface, Sequelize) => {
    // Cannot easily remove enum values in postgres, doing nothing on rollback.
  }
};
