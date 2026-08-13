'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Adiciona a coluna meta_description na tabela posts, se não existir
    const tableInfo = await queryInterface.describeTable('posts').catch(() => null);
    if (tableInfo && !tableInfo.meta_description) {
      await queryInterface.addColumn('posts', 'meta_description', {
        type: Sequelize.TEXT,
        allowNull: true
      });
    }
    
    // Adiciona fallback para a tabela com P maiúsculo (Posts) para garantir segurança, já que as queries usam "Posts" e "posts" no backend
    const tableInfoUpper = await queryInterface.describeTable('Posts').catch(() => null);
    if (tableInfoUpper && !tableInfoUpper.meta_description) {
      await queryInterface.addColumn('Posts', 'meta_description', {
        type: Sequelize.TEXT,
        allowNull: true
      });
    }
  },

  down: async (queryInterface, Sequelize) => {
    const tableInfo = await queryInterface.describeTable('posts').catch(() => null);
    if (tableInfo && tableInfo.meta_description) {
      await queryInterface.removeColumn('posts', 'meta_description');
    }
    
    const tableInfoUpper = await queryInterface.describeTable('Posts').catch(() => null);
    if (tableInfoUpper && tableInfoUpper.meta_description) {
      await queryInterface.removeColumn('Posts', 'meta_description');
    }
  }
};
