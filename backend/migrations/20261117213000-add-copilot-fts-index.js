'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      const cols = await queryInterface.describeTable('AdminCopilotConversations', { transaction });
      if (!cols.searchVector) {
        await queryInterface.sequelize.query(
          'ALTER TABLE "AdminCopilotConversations" ADD COLUMN IF NOT EXISTS "searchVector" tsvector;',
          { transaction }
        );
      }

      const indexes = await queryInterface.showIndex('AdminCopilotConversations', { transaction }).catch(() => []);
      const idxNames = new Set((indexes || []).map(i => i.name));
      if (!idxNames.has('idx_copilot_conv_search_fts')) {
        await queryInterface.sequelize.query(
          'CREATE INDEX IF NOT EXISTS idx_copilot_conv_search_fts ON "AdminCopilotConversations" USING GIN ("searchVector");',
          { transaction }
        );
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
      await queryInterface.sequelize.query('DROP INDEX IF EXISTS idx_copilot_conv_search_fts;', { transaction }).catch(() => {});
      await queryInterface.removeColumn('AdminCopilotConversations', 'searchVector', { transaction }).catch(() => {});
      await transaction.commit();
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  }
};
