'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('PaymentFinancialEvents', {
      id: {
        allowNull: false,
        primaryKey: true,
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4
      },
      paymentId: {
        type: Sequelize.STRING,
        allowNull: false,
        references: {
          model: 'Payments',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT'
      },
      externalEventId: {
        type: Sequelize.STRING,
        allowNull: false
      },
      eventType: {
        type: Sequelize.ENUM('PAYMENT_RECEIVED', 'REFUND', 'CHARGEBACK'),
        allowNull: false
      },
      grossAmount: {
        type: Sequelize.DECIMAL(12, 2),
        allowNull: false
      },
      feeAmount: {
        type: Sequelize.DECIMAL(12, 2),
        allowNull: true
      },
      netCashAmount: {
        type: Sequelize.DECIMAL(12, 2),
        allowNull: true
      },
      cashDeltaAmount: {
        type: Sequelize.DECIMAL(12, 2),
        allowNull: true
      },
      eventDate: {
        type: Sequelize.DATEONLY,
        allowNull: false
      },
      eventOccurredAt: {
        type: Sequelize.DATE,
        allowNull: true
      },
      sourceMetadata: {
        type: Sequelize.JSONB,
        allowNull: true
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE
      }
    });

    // Indexes
    await queryInterface.addIndex('PaymentFinancialEvents', ['paymentId', 'externalEventId', 'eventType'], {
      unique: true,
      name: 'unique_payment_financial_event'
    });
    await queryInterface.addIndex('PaymentFinancialEvents', ['paymentId']);
    await queryInterface.addIndex('PaymentFinancialEvents', ['eventDate']);
    await queryInterface.addIndex('PaymentFinancialEvents', ['eventType']);
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('PaymentFinancialEvents');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_PaymentFinancialEvents_eventType";');
  }
};
