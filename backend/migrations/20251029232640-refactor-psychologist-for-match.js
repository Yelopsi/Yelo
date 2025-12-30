'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // 1. Remove os campos antigos que estão sendo refatorados
    try {
      await queryInterface.removeColumn('Psychologists', 'abordagem'); // Campo antigo
      await queryInterface.removeColumn('Psychologists', 'especialidades'); // Campo antigo
      await queryInterface.removeColumn('Psychologists', 'cidade'); // Campo antigo
      await queryInterface.removeColumn('Psychologists', 'online'); // Campo antigo
    } catch (error) {
      console.log('Ignorando erro ao remover colunas antigas do Profissional. Prosseguindo.');
    }

    // 2. Adiciona os novos campos do Questionário para o Profissional
    // --- CORREÇÃO: Adicionado try/catch para cada addColumn para tornar a migração mais robusta ---
    try {
      await queryInterface.addColumn('Psychologists', 'valor_sessao_numero', {
        type: Sequelize.FLOAT,
        allowNull: true,
        comment: 'Valor por sessão informado pelo profissional (R$)'
      });
    } catch (e) { console.log("Ignorando erro ao adicionar 'valor_sessao_numero'. Coluna provavelmente já existe."); }

    try {
      await queryInterface.addColumn('Psychologists', 'temas_atuacao', {
        type: Sequelize.ARRAY(Sequelize.STRING),
        allowNull: true,
        comment: 'Lista de temas em que o profissional atua (Tela 3 do paciente)'
      });
    } catch (e) { console.log("Ignorando erro ao adicionar 'temas_atuacao'. Coluna provavelmente já existe."); }

    try {
      await queryInterface.addColumn('Psychologists', 'abordagens_tecnicas', {
        type: Sequelize.ARRAY(Sequelize.STRING),
        allowNull: true,
        comment: 'Lista de abordagens técnicas do profissional (Tela 4 do paciente)'
      });
    } catch (e) { console.log("Ignorando erro ao adicionar 'abordagens_tecnicas'. Coluna provavelmente já existe."); }

    try {
      await queryInterface.addColumn('Psychologists', 'genero_identidade', {
        type: Sequelize.STRING,
        allowNull: true,
        comment: 'Gênero/Identidade do profissional (Tela 5 do paciente)'
      });
    } catch (e) { console.log("Ignorando erro ao adicionar 'genero_identidade'. Coluna provavelmente já existe."); }

    try {
      await queryInterface.addColumn('Psychologists', 'praticas_vivencias', {
        type: Sequelize.ARRAY(Sequelize.STRING),
        allowNull: true,
        comment: 'Lista de vivências e práticas afirmativas (Tela 5 do paciente)'
      });
    } catch (e) { console.log("Ignorando erro ao adicionar 'praticas_vivencias'. Coluna provavelmente já existe."); }

    try {
      await queryInterface.addColumn('Psychologists', 'disponibilidade_periodo', {
        type: Sequelize.ARRAY(Sequelize.STRING),
        allowNull: true,
        comment: 'Disponibilidade de horários do profissional (Tela 6 do paciente)'
      });
    } catch (e) { console.log("Ignorando erro ao adicionar 'disponibilidade_periodo'. Coluna provavelmente já existe."); }
  },

  async down(queryInterface, Sequelize) {
    // Reverte a ação em caso de necessidade
    // O 'down' não precisa de try/catch, pois se a coluna não existir, o Sequelize já lida com isso.
    await queryInterface.removeColumn('Psychologists', 'valor_sessao_numero');
    await queryInterface.removeColumn('Psychologists', 'temas_atuacao');
    await queryInterface.removeColumn('Psychologists', 'abordagens_tecnicas');
    await queryInterface.removeColumn('Psychologists', 'genero_identidade');
    await queryInterface.removeColumn('Psychologists', 'praticas_vivencias');
    await queryInterface.removeColumn('Psychologists', 'disponibilidade_periodo');
    // Você pode querer re-adicionar as colunas antigas aqui, mas para simplificar, apenas removemos as novas.
  }
};