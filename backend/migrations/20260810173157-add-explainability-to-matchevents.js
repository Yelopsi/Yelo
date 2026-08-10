'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // A tabela MatchEvents pode ter sido criada dinamicamente no matchController.
    // Vamos garantir que ela exista ou alterá-la caso já exista.
    await queryInterface.addColumn('MatchEvents', 'explainability_log', {
      type: Sequelize.JSONB,
      allowNull: true
    }).catch(() => console.log('Coluna explainability_log já existe ou tabela não encontrada.'));

    await queryInterface.addColumn('MatchEvents', 'ai_justification', {
      type: Sequelize.TEXT,
      allowNull: true
    }).catch(() => console.log('Coluna ai_justification já existe ou tabela não encontrada.'));
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('MatchEvents', 'explainability_log').catch(() => {});
    await queryInterface.removeColumn('MatchEvents', 'ai_justification').catch(() => {});
  }
};
