'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      const cols = await queryInterface.describeTable('posts', { transaction });

      if (!cols.status) {
        await queryInterface.addColumn('posts', 'status', {
          type: Sequelize.STRING(24),
          allowNull: false,
          defaultValue: 'published'
        }, { transaction });
      }

      if (!cols.scheduled_for) {
        await queryInterface.addColumn('posts', 'scheduled_for', {
          type: Sequelize.DATE,
          allowNull: true
        }, { transaction });
      }

      const existingIndexes = await queryInterface.showIndex('posts', { transaction }).catch(() => []);
      const idxNames = new Set((existingIndexes || []).map(i => i.name));

      if (!idxNames.has('idx_posts_status_scheduled_for')) {
        await queryInterface.addIndex('posts', ['status', 'scheduled_for'], {
          name: 'idx_posts_status_scheduled_for',
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
      await queryInterface.removeIndex('posts', 'idx_posts_status_scheduled_for', { transaction }).catch(() => {});
      const cols = await queryInterface.describeTable('posts', { transaction }).catch(() => ({}));
      if (cols.scheduled_for) {
        await queryInterface.removeColumn('posts', 'scheduled_for', { transaction });
      }
      if (cols.status) {
        await queryInterface.removeColumn('posts', 'status', { transaction });
      }
      await transaction.commit();
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  }
};
