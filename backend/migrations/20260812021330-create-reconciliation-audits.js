'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('ReconciliationAudits', {
      id: {
        allowNull: false,
        primaryKey: true,
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4
      },
      reconciliationRunId: {
        type: Sequelize.STRING,
        allowNull: false
      },
      entityType: {
        type: Sequelize.ENUM('SUBSCRIPTION', 'PAYMENT', 'INTENT', 'PSYCHOLOGIST'),
        allowNull: false
      },
      entityId: {
        type: Sequelize.STRING,
        allowNull: false
      },
      differenceType: {
        type: Sequelize.STRING,
        allowNull: false
      },
      asaasState: {
        type: Sequelize.JSONB,
        allowNull: true
      },
      yeloState: {
        type: Sequelize.JSONB,
        allowNull: true
      },
      severity: {
        type: Sequelize.ENUM('CRITICAL', 'HIGH', 'MEDIUM', 'LOW'),
        allowNull: false
      },
      resolvedAt: {
        type: Sequelize.DATE,
        allowNull: true
      },
      resolution: {
        type: Sequelize.TEXT,
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

    // Indice composto para evitar duplicação em execuções concorrentes (Idempotência)
    // Uma auditoria em aberto (resolvedAt IS NULL) para o mesmo entityId/Type não deve ser reportada 2x
    await queryInterface.addIndex('ReconciliationAudits', ['entityType', 'entityId', 'differenceType'], {
      unique: true,
      where: {
        resolvedAt: null
      },
      name: 'idx_unique_active_audit'
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('ReconciliationAudits');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_ReconciliationAudits_entityType";');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_ReconciliationAudits_severity";');
  }
};
