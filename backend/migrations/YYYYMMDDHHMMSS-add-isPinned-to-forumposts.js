'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const tableInfo = await queryInterface.describeTable('ForumPosts');
    if (!tableInfo.isPinned) {
      await queryInterface.addColumn('ForumPosts', 'isPinned', {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      });
    }
  },

  down: async (queryInterface, Sequelize) => {
    const tableInfo = await queryInterface.describeTable('ForumPosts');
    if (tableInfo.isPinned) {
      await queryInterface.removeColumn('ForumPosts', 'isPinned');
    }
  }
};
