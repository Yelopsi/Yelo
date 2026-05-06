'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Adicionamos try/catch em cada coluna para evitar erros 
    // caso o banco já tenha criado a coluna no seu ambiente de desenvolvimento.
    try {
      await queryInterface.addColumn('Psychologists', 'razao_social', { type: Sequelize.STRING(255), allowNull: true });
    } catch (e) { console.log("Aviso: razao_social já existe."); }

    try {
      await queryInterface.addColumn('Psychologists', 'formacao_nivel', { type: Sequelize.STRING(255), allowNull: true });
    } catch (e) { console.log("Aviso: formacao_nivel já existe."); }

    try {
      await queryInterface.addColumn('Psychologists', 'formacao_desc', { type: Sequelize.TEXT, allowNull: true });
    } catch (e) { console.log("Aviso: formacao_desc já existe."); }

    try {
      await queryInterface.addColumn('Psychologists', 'ano_inicio_experiencia', { type: Sequelize.INTEGER, allowNull: true });
    } catch (e) { console.log("Aviso: ano_inicio_experiencia já existe."); }

    try {
      await queryInterface.addColumn('Psychologists', 'tipo_cobranca', { type: Sequelize.STRING(50), allowNull: true, defaultValue: 'sessao' });
    } catch (e) { console.log("Aviso: tipo_cobranca já existe."); }

    try {
      await queryInterface.addColumn('Psychologists', 'valor_mensal_numero', { type: Sequelize.FLOAT, allowNull: true });
    } catch (e) { console.log("Aviso: valor_mensal_numero já existe."); }
  },

  async down(queryInterface, Sequelize) {
    try {
      await queryInterface.removeColumn('Psychologists', 'razao_social');
      await queryInterface.removeColumn('Psychologists', 'formacao_nivel');
      await queryInterface.removeColumn('Psychologists', 'formacao_desc');
      await queryInterface.removeColumn('Psychologists', 'ano_inicio_experiencia');
      await queryInterface.removeColumn('Psychologists', 'tipo_cobranca');
      await queryInterface.removeColumn('Psychologists', 'valor_mensal_numero');
    } catch (e) {
      console.error('Erro no rollback:', e.message);
    }
  }
};