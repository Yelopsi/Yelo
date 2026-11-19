'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      let tableExists = true;
      try {
        await queryInterface.describeTable('AdminCopilotFollowUps', { transaction });
      } catch (_) {
        tableExists = false;
      }

      if (!tableExists) {
        await queryInterface.createTable('AdminCopilotFollowUps', {
          id: {
            allowNull: false,
            autoIncrement: true,
            primaryKey: true,
            type: Sequelize.INTEGER
          },
          psychologistId: {
            type: Sequelize.INTEGER,
            allowNull: false
          },
          conversationId: {
            type: Sequelize.INTEGER,
            allowNull: true
          },
          parentFollowUpId: {
            type: Sequelize.INTEGER,
            allowNull: true
          },
          subType: {
            type: Sequelize.STRING(40),
            allowNull: false
          },
          reason: {
            type: Sequelize.STRING(280),
            allowNull: false
          },
          contextSummary: {
            type: Sequelize.TEXT,
            allowNull: true
          },
          dueAt: {
            type: Sequelize.DATE,
            allowNull: false
          },
          status: {
            type: Sequelize.STRING(24),
            allowNull: false,
            defaultValue: 'scheduled'
          },
          autoSchedulePerformanceEval: {
            type: Sequelize.BOOLEAN,
            allowNull: false,
            defaultValue: false
          },
          evaluationDelayDays: {
            type: Sequelize.INTEGER,
            allowNull: false,
            defaultValue: 14
          },
          baselineMetrics: {
            type: Sequelize.JSONB,
            allowNull: true
          },
          outcomeMetrics: {
            type: Sequelize.JSONB,
            allowNull: true
          },
          resolvedReason: {
            type: Sequelize.STRING(220),
            allowNull: true
          },
          sentMessage: {
            type: Sequelize.TEXT,
            allowNull: true
          },
          completedAt: {
            type: Sequelize.DATE,
            allowNull: true
          },
          adminId: {
            type: Sequelize.INTEGER,
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
        }, { transaction });
      }

      const existingIndexes = await queryInterface.showIndex('AdminCopilotFollowUps', { transaction }).catch(() => []);
      const idxNames = new Set((existingIndexes || []).map(i => i.name));

      if (!idxNames.has('idx_copilot_followups_status_due')) {
        await queryInterface.addIndex('AdminCopilotFollowUps', ['status', 'dueAt'], {
          name: 'idx_copilot_followups_status_due',
          transaction
        });
      }
      if (!idxNames.has('idx_copilot_followups_psi_status')) {
        await queryInterface.addIndex('AdminCopilotFollowUps', ['psychologistId', 'status'], {
          name: 'idx_copilot_followups_psi_status',
          transaction
        });
      }
      if (!idxNames.has('idx_copilot_followups_parent')) {
        await queryInterface.addIndex('AdminCopilotFollowUps', ['parentFollowUpId'], {
          name: 'idx_copilot_followups_parent',
          transaction
        });
      }

      await transaction.commit();
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  },

  down: async (queryInterface) => {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      await queryInterface.dropTable('AdminCopilotFollowUps', { transaction }).catch(() => {});
      await transaction.commit();
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  }
};
