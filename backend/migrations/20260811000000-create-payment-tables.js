'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // 1. SubscriptionIntents
    await queryInterface.createTable('SubscriptionIntents', {
      id: {
        type: Sequelize.UUID,
        primaryKey: true,
        defaultValue: Sequelize.UUIDV4
      },
      psychologistId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'Psychologists', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      idempotencyKey: {
        type: Sequelize.STRING(255),
        allowNull: false,
        unique: true
      },
      planId: {
        type: Sequelize.STRING(50),
        allowNull: false
      },
      billingType: {
        type: Sequelize.STRING(50),
        allowNull: false
      },
      asaasSubscriptionId: {
        type: Sequelize.STRING(255),
        allowNull: true
      },
      status: {
        type: Sequelize.STRING(50),
        allowNull: false,
        defaultValue: 'CREATING'
      },
      expiresAt: {
        type: Sequelize.DATE,
        allowNull: false
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    // Partial Unique Index on SubscriptionIntents to prevent multiple active intents
    await queryInterface.addIndex('SubscriptionIntents', ['psychologistId'], {
      name: 'idx_single_active_intent',
      unique: true,
      where: {
        status: ['CREATING', 'SENT_TO_ASAAS', 'RECONCILIATION_REQUIRED']
      }
    });

    // 2. WebhookInbox
    await queryInterface.createTable('WebhookInbox', {
      eventId: {
        type: Sequelize.STRING(255),
        primaryKey: true
      },
      status: {
        type: Sequelize.STRING(50),
        allowNull: false,
        defaultValue: 'PENDING'
      },
      payload: {
        type: Sequelize.JSONB,
        allowNull: false
      },
      attempts: {
        type: Sequelize.INTEGER,
        defaultValue: 0
      },
      lockedAt: {
        type: Sequelize.DATE,
        allowNull: true
      },
      processingStartedAt: {
        type: Sequelize.DATE,
        allowNull: true
      },
      processedAt: {
        type: Sequelize.DATE,
        allowNull: true
      },
      nextRetryAt: {
        type: Sequelize.DATE,
        allowNull: true
      },
      lastError: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      receivedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    // 3. Subscriptions
    await queryInterface.createTable('Subscriptions', {
      id: {
        type: Sequelize.STRING(255),
        primaryKey: true
      },
      psychologistId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'Psychologists', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      asaasCustomerId: {
        type: Sequelize.STRING(255),
        allowNull: false
      },
      plan: {
        type: Sequelize.STRING(50),
        allowNull: false
      },
      status: {
        type: Sequelize.STRING(50),
        allowNull: false
      },
      currentPeriodStart: {
        type: Sequelize.DATE,
        allowNull: true
      },
      currentPeriodEnd: {
        type: Sequelize.DATE,
        allowNull: true
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    // 4. Payments
    await queryInterface.createTable('Payments', {
      id: {
        type: Sequelize.STRING(255),
        primaryKey: true
      },
      subscriptionId: {
        type: Sequelize.STRING(255),
        allowNull: true,
        references: { model: 'Subscriptions', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      psychologistId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'Psychologists', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      status: {
        type: Sequelize.STRING(50),
        allowNull: false
      },
      value: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false
      },
      billingType: {
        type: Sequelize.STRING(50),
        allowNull: false
      },
      dueDate: {
        type: Sequelize.DATEONLY,
        allowNull: false
      },
      paymentDate: {
        type: Sequelize.DATE,
        allowNull: true
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('Payments');
    await queryInterface.dropTable('Subscriptions');
    await queryInterface.dropTable('WebhookInbox');
    await queryInterface.removeIndex('SubscriptionIntents', 'idx_single_active_intent');
    await queryInterface.dropTable('SubscriptionIntents');
  }
};
