'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      let existingCols = {};
      try {
        existingCols = await queryInterface.describeTable('AdminCopilotConversations', { transaction });
      } catch (_) {
        existingCols = null;
      }

      if (!existingCols) {
        await queryInterface.createTable('AdminCopilotConversations', {
          id: { allowNull: false, autoIncrement: true, primaryKey: true, type: Sequelize.INTEGER },
          psychologistId: { type: Sequelize.INTEGER, allowNull: true },
          detectedName: { type: Sequelize.STRING, allowNull: true },
          rawPastedChat: { type: Sequelize.TEXT, allowNull: false },
          aiResponse: { type: Sequelize.TEXT, allowNull: false },
          contextSnapshot: { type: Sequelize.JSONB, allowNull: true },
          createdAt: { allowNull: false, type: Sequelize.DATE },
          updatedAt: { allowNull: false, type: Sequelize.DATE }
        }, { transaction });
        existingCols = await queryInterface.describeTable('AdminCopilotConversations', { transaction });
      }

      const columnsToAdd = [
        ['threadId', { type: Sequelize.UUID, allowNull: true }],
        ['entityType', { type: Sequelize.STRING(32), allowNull: false, defaultValue: 'psychologist' }],
        ['entityId', { type: Sequelize.INTEGER, allowNull: true }],
        ['entityKey', { type: Sequelize.STRING(120), allowNull: true }],
        ['operationMode', { type: Sequelize.STRING(32), allowNull: false, defaultValue: 'resposta' }],
        ['interactionCategory', { type: Sequelize.STRING(64), allowNull: true }],
        ['structuredOutput', { type: Sequelize.JSONB, allowNull: true }],
        ['feedbackStatus', { type: Sequelize.STRING(24), allowNull: false, defaultValue: 'draft' }],
        ['rejectionReason', { type: Sequelize.STRING(120), allowNull: true }],
        ['finalReply', { type: Sequelize.TEXT, allowNull: true }],
        ['promptVersion', { type: Sequelize.STRING(24), allowNull: true }],
        ['inputHash', { type: Sequelize.STRING(64), allowNull: true }],
        ['messageHashes', { type: Sequelize.JSONB, allowNull: true }],
        ['isLibraryExample', { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false }],
        ['adminId', { type: Sequelize.INTEGER, allowNull: true }]
      ];

      for (const [colName, colDef] of columnsToAdd) {
        if (!existingCols[colName]) {
          await queryInterface.addColumn('AdminCopilotConversations', colName, colDef, { transaction });
        }
      }

      const existingIndexes = await queryInterface.showIndex('AdminCopilotConversations', { transaction }).catch(() => []);
      const idxNames = new Set((existingIndexes || []).map(i => i.name));

      if (!idxNames.has('idx_copilot_conv_entity_created')) {
        await queryInterface.addIndex('AdminCopilotConversations', ['entityType', 'entityId', 'createdAt'], {
          name: 'idx_copilot_conv_entity_created',
          transaction
        });
      }
      if (!idxNames.has('idx_copilot_conv_thread_created')) {
        await queryInterface.addIndex('AdminCopilotConversations', ['threadId', 'createdAt'], {
          name: 'idx_copilot_conv_thread_created',
          transaction
        });
      }
      if (!idxNames.has('idx_copilot_conv_input_hash')) {
        await queryInterface.addIndex('AdminCopilotConversations', ['inputHash'], {
          name: 'idx_copilot_conv_input_hash',
          transaction
        });
      }

      let memExists = true;
      try {
        await queryInterface.describeTable('AdminCopilotMemories', { transaction });
      } catch (_) {
        memExists = false;
      }

      if (!memExists) {
        await queryInterface.createTable('AdminCopilotMemories', {
          id: { allowNull: false, autoIncrement: true, primaryKey: true, type: Sequelize.INTEGER },
          entityType: { type: Sequelize.STRING(32), allowNull: false, defaultValue: 'psychologist' },
          entityKey: { type: Sequelize.STRING(120), allowNull: false },
          entityId: { type: Sequelize.INTEGER, allowNull: true },
          rollingSummary: { type: Sequelize.TEXT, allowNull: true },
          confirmedFacts: { type: Sequelize.JSONB, allowNull: false, defaultValue: [] },
          clientStatements: { type: Sequelize.JSONB, allowNull: false, defaultValue: [] },
          recommendationsGiven: { type: Sequelize.JSONB, allowNull: false, defaultValue: [] },
          commitments: { type: Sequelize.JSONB, allowNull: false, defaultValue: [] },
          pendingItems: { type: Sequelize.JSONB, allowNull: false, defaultValue: [] },
          declaredExpectations: { type: Sequelize.JSONB, allowNull: false, defaultValue: [] },
          topicsHistory: { type: Sequelize.JSONB, allowNull: false, defaultValue: [] },
          lastInteractionAt: { type: Sequelize.DATE, allowNull: true },
          createdAt: { allowNull: false, type: Sequelize.DATE },
          updatedAt: { allowNull: false, type: Sequelize.DATE }
        }, { transaction });

        await queryInterface.addIndex('AdminCopilotMemories', ['entityType', 'entityKey'], {
          name: 'idx_copilot_memory_entity_unique',
          unique: true,
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
      await queryInterface.dropTable('AdminCopilotMemories', { transaction }).catch(() => {});
      await queryInterface.removeIndex('AdminCopilotConversations', 'idx_copilot_conv_input_hash', { transaction }).catch(() => {});
      await queryInterface.removeIndex('AdminCopilotConversations', 'idx_copilot_conv_thread_created', { transaction }).catch(() => {});
      await queryInterface.removeIndex('AdminCopilotConversations', 'idx_copilot_conv_entity_created', { transaction }).catch(() => {});

      const cols = [
        'adminId', 'isLibraryExample', 'messageHashes', 'inputHash',
        'promptVersion', 'finalReply', 'rejectionReason', 'feedbackStatus',
        'structuredOutput', 'interactionCategory', 'operationMode',
        'entityKey', 'entityId', 'entityType', 'threadId'
      ];
      for (const c of cols) {
        await queryInterface.removeColumn('AdminCopilotConversations', c, { transaction }).catch(() => {});
      }
      await transaction.commit();
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  }
};
